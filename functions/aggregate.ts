// functions/src/aggregate.ts (excerpt): update to use geo.h3 {id,res} and keep r8 as default

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { geoToH3 } from 'h3-js';
import { validateSubmission } from './guards';

const db2 = getFirestore();

function computeH3(lat: number, lng: number, res = 8): { id: string; res: number } {
  return { id: geoToH3(lat, lng, res), res };
}

export const onSubmissionWrite = onDocumentWritten({ document: 'polls/{pollId}/submissions/{uid}', region: 'us-central1' }, async (event) => {
  const { pollId } = event.params as { pollId: string };
  const before = event.data?.before?.data() as any | undefined;
  const after = event.data?.after?.data() as any | undefined;

  try { if (after) validateSubmission(after); } catch (e) { console.warn('Submission rejected by guard', e); return; }

  const wasSubmitted = !!before?.submitted;
  const isSubmitted = !!after?.submitted;
  if (!wasSubmitted && !isSubmitted) return;

  // Resolve H3s. Prefer explicit s.h3 {id,res}; else profile.geo.h3; else compute r8.
  const getH3From = (s: any | undefined) => {
    if (!s) return null;
    if (s.h3 && s.h3.id && Number.isFinite(s.h3.res)) return s.h3 as { id: string; res: number };
    if (s.profileH3 && s.profileH3.id && Number.isFinite(s.profileH3.res)) return s.profileH3; // if client copies it in
    if (s.location && Number.isFinite(s.location.lat) && Number.isFinite(s.location.lng)) return computeH3(s.location.lat, s.location.lng, 8);
    return null;
  };

  const beforeH3 = wasSubmitted ? getH3From(before) : null;
  const afterH3 = isSubmitted ? getH3From(after) : null;

  // ... (rest of aggregation logic from previous canvas, replacing .h3r8 strings with .h3.id)
});














// functions/src/aggregate.ts
// Cloud Functions v2 (Node 18+), Firestore onWrite trigger to maintain per‑H3, per‑question aggregates
// Install: npm i firebase-functions firebase-admin h3-js
// Enable in index.ts: export { onSubmissionWrite } from './aggregate';

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, Transaction } from 'firebase-admin/firestore';
import { geoToH3 } from 'h3-js';

initializeApp();
const db = getFirestore();

/**
 * Data model assumptions for a submission document at
 *   polls/{pollId}/submissions/{uid}
 *
 * Submissions are only counted when `submitted === true`.
 * If users edit and re‑submit, we delta the aggregates (old -> new).
 *
 * {
 *   submitted: boolean,
 *   answers: { [questionId: string]: number }, // positive, negative or zero
 *   location: { lat: number, lng: number },    // user's point
 *   h3r8?: string,                              // optional cache of h3 index (computed here if missing)
 *   submittedAt: FirebaseTimestamp,
 *   updatedAt: FirebaseTimestamp
 * }
 */

type Answers = Record<string, number | null | undefined>;

function coerce(val: any): number {
  const n = typeof val === 'number' ? val : Number(val);
  return Number.isFinite(n) ? n : 0;
}

function computeH3(lat: number, lng: number, res = 8): string {
  return geoToH3(lat, lng, res);
}

function diffAnswers(oldA: Answers | undefined, newA: Answers | undefined) {
  const keys = new Set<string>([...(oldA ? Object.keys(oldA) : []), ...(newA ? Object.keys(newA) : [])]);
  const delta: Record<string, number> = {};
  for (const k of keys) {
    const before = coerce(oldA?.[k]);
    const after = coerce(newA?.[k]);
    const d = after - before;
    if (d !== 0) delta[k] = d;
  }
  return delta; // per‑question numeric delta
}

function classify(val: number) {
  return val > 0 ? 'pos' : val < 0 ? 'neg' : 'zero';
}

/** Build per‑question counters from a full answer set */
function countersFromAnswers(answers: Answers) {
  const byQ: Record<string, { sum: number, posSum: number, negSum: number, posCount: number, negCount: number, zeroCount: number }> = {};
  for (const [q, vRaw] of Object.entries(answers || {})) {
    const v = coerce(vRaw);
    const c = (byQ[q] ||= { sum: 0, posSum: 0, negSum: 0, posCount: 0, negCount: 0, zeroCount: 0 });
    c.sum += v;
    if (v > 0) { c.posSum += v; c.posCount += 1; }
    else if (v < 0) { c.negSum += v; c.negCount += 1; }
    else { c.zeroCount += 1; }
  }
  return byQ;
}

/** Build per‑question counters from a per‑question delta.
 * We also need to adjust counts if a value crossed sign or to/from zero.
 * To do this robustly during updates, we compute full old vs new answers when available.
 */
function countersFromOldNew(oldA: Answers | undefined, newA: Answers | undefined) {
  const result: Record<string, { sum: number, posSum: number, negSum: number, posCount: number, negCount: number, zeroCount: number }> = {};
  const keys = new Set<string>([...(oldA ? Object.keys(oldA) : []), ...(newA ? Object.keys(newA) : [])]);
  for (const k of keys) {
    const before = coerce(oldA?.[k]);
    const after = coerce(newA?.[k]);
    if (!(before === after && before === 0)) {
      const r = (result[k] ||= { sum: 0, posSum: 0, negSum: 0, posCount: 0, negCount: 0, zeroCount: 0 });
      // sum always changes by (after - before)
      r.sum += after - before;
      // counts and sign sums change if sign buckets changed
      const bClass = classify(before);
      const aClass = classify(after);
      if (bClass !== aClass) {
        if (bClass === 'pos') { r.posCount -= 1; r.posSum -= before; }
        if (bClass === 'neg') { r.negCount -= 1; r.negSum -= before; }
        if (bClass === 'zero') { r.zeroCount -= 1; }
        if (aClass === 'pos') { r.posCount += 1; r.posSum += after; }
        if (aClass === 'neg') { r.negCount += 1; r.negSum += after; }
        if (aClass === 'zero') { r.zeroCount += 1; }
      } else {
        // same bucket; only the bucket sum changes
        if (aClass === 'pos') r.posSum += after - before;
        if (aClass === 'neg') r.negSum += after - before;
        // zero bucket: only counts matter when crossing in/out, already handled
      }
    }
  }
  return result;
}

/** Firestore doc layout for aggregates (per H3 cell):
 * polls/{pollId}/h3Agg/{h3}
 * {
 *   stats: {
 *     [questionId]: { sum, posSum, negSum, posCount, negCount, zeroCount }
 *   },
 *   totalRespondents: number,    // users who have a submitted doc in this H3
 *   updatedAt: serverTimestamp,
 * }
 */

export const onSubmissionWrite = onDocumentWritten(
  {
    document: 'polls/{pollId}/submissions/{uid}',
    region: 'us-central1',
    retry: false,
  },
  async (event) => {
    const { pollId } = event.params as { pollId: string };
    const before = event.data?.before?.data() as any | undefined;
    const after = event.data?.after?.data() as any | undefined;

    // We only care about transitions that affect `submitted === true`
    const wasSubmitted = !!before?.submitted;
    const isSubmitted = !!after?.submitted;

    // If neither before nor after is submitted, nothing to do.
    if (!wasSubmitted && !isSubmitted) return;

    // Determine H3 cells for before/after (in case user moved)
    const beforeH3 = wasSubmitted && before?.location ? (before.h3r8 || computeH3(before.location.lat, before.location.lng, 8)) : null;
    const afterH3 = isSubmitted && after?.location ? (after.h3r8 || computeH3(after.location.lat, after.location.lng, 8)) : null;

    const batch = db.batch();

    // Helper: apply counter deltas to a specific H3 aggregate doc
    const applyToH3 = (h3: string, deltaCounters: ReturnType<typeof countersFromOldNew>, respondentDelta: number) => {
      const aggRef = db.doc(`polls/${pollId}/h3Agg/${h3}`);
      const updates: Record<string, any> = {
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (respondentDelta !== 0) {
        updates['totalRespondents'] = FieldValue.increment(respondentDelta);
      }
      // For each question, increment subfields
      for (const [q, c] of Object.entries(deltaCounters)) {
        if (!c) continue;
        const base = `stats.${q}`; // use map path to avoid exploding indexes
        if (c.sum) updates[`${base}.sum`] = FieldValue.increment(c.sum);
        if (c.posSum) updates[`${base}.posSum`] = FieldValue.increment(c.posSum);
        if (c.negSum) updates[`${base}.negSum`] = FieldValue.increment(c.negSum);
        if (c.posCount) updates[`${base}.posCount`] = FieldValue.increment(c.posCount);
        if (c.negCount) updates[`${base}.negCount`] = FieldValue.increment(c.negCount);
        if (c.zeroCount) updates[`${base}.zeroCount`] = FieldValue.increment(c.zeroCount);
      }
      batch.set(aggRef, updates, { merge: true });
    };

    if (!wasSubmitted && isSubmitted) {
      // New submission counted
      if (!afterH3) return; // cannot aggregate without location
      const counters = countersFromAnswers(after?.answers || {});
      applyToH3(afterH3, counters as any, +1);
    } else if (wasSubmitted && !isSubmitted) {
      // Submission became un‑submitted (rare); subtract everything
      if (!beforeH3) return;
      const counters = countersFromAnswers(before?.answers || {});
      // negate all counters
      for (const c of Object.values(counters)) {
        c.sum *= -1; c.posSum *= -1; c.negSum *= -1; c.posCount *= -1; c.negCount *= -1; c.zeroCount *= -1;
      }
      applyToH3(beforeH3, counters as any, -1);
    } else {
      // Both submitted. Could be edits to answers and/or location changed.
      const sameCell = beforeH3 && afterH3 && beforeH3 === afterH3;
      const countersDelta = countersFromOldNew(before?.answers || {}, after?.answers || {});

      if (sameCell && afterH3) {
        // Increment within same H3
        applyToH3(afterH3, countersDelta, 0);
      } else {
        // Moved cells: subtract from old, add to new; respondents count moves but net 0
        if (beforeH3) {
          // subtract old answers
          const neg = countersFromAnswers(before?.answers || {});
          for (const c of Object.values(neg)) {
            c.sum *= -1; c.posSum *= -1; c.negSum *= -1; c.posCount *= -1; c.negCount *= -1; c.zeroCount *= -1;
          }
          applyToH3(beforeH3, neg as any, -1);
        }
        if (afterH3) {
          const pos = countersFromAnswers(after?.answers || {});
          applyToH3(afterH3, pos as any, +1);
        }
      }
    }

    await batch.commit();

    // Optionally backfill the h3r8 cache on the submission doc (without retriggering heavy work)
    if (isSubmitted && after && !after.h3r8 && after.location) {
      await db.doc(event.data!.after!.ref.path).set({ h3r8: afterH3 }, { merge: true });
    }
  }
);
