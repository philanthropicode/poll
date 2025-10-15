// functions/src/api.ts
// Tiny read API for H3 aggregates + admin backfill callable
// Install deps: firebase-functions, firebase-admin, h3-js

import { onRequest, HttpsError, onCall } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { initializeApp } from 'firebase-admin/app';
import { polygonToCells, cellToBoundary } from 'h3-js';

initializeApp();
const db = getFirestore();

// ----------------------
// READ API: /api/polls/:pollId/h3Agg
// Query params: questionId, west, south, east, north, res (defaults to 8)
// Security: read-only; consider adding Auth check if needed.
export const getH3Agg = onRequest({ region: 'us-central1', cors: true }, async (req, res) => {
  try {
    const pollId = String(req.path.split('/').filter(Boolean).pop());
    const { questionId, west, south, east, north, res: resStr } = (req.query as Record<string, string>);
    if (!questionId) throw new HttpsError('invalid-argument', 'questionId required');

    const bounds = {
      west: Number(west), south: Number(south), east: Number(east), north: Number(north)
    };
    if ([bounds.west, bounds.south, bounds.east, bounds.north].some((n) => !Number.isFinite(n))) {
      throw new HttpsError('invalid-argument', 'bounds required');
    }
    const reso = Number(resStr ?? 8);

    // Build a rectangle polygon (lng,lat) and fill with H3 cells
    const rect = [
      [bounds.west, bounds.south],
      [bounds.east, bounds.south],
      [bounds.east, bounds.north],
      [bounds.west, bounds.north],
      [bounds.west, bounds.south],
    ];
    const cells = polygonToCells([rect], reso, false);

    // Batch fetch the exact docs by id using documentId() in queries of 30
    const aggs: Array<{ h3: string; sum: number }> = [];
    for (let i = 0; i < cells.length; i += 30) {
      const slice = cells.slice(i, i + 30);
      const snap = await db.collection(`polls/${pollId}/h3Agg`).where('__name__', 'in', slice).get();
      snap.forEach((doc) => {
        const data = doc.data() as any;
        const s = data?.stats?.[questionId];
        if (s && typeof s.sum === 'number') aggs.push({ h3: doc.id, sum: s.sum });
      });
    }

    res.json({ aggs });
  } catch (e: any) {
    const code = e?.code && typeof e.code === 'string' ? e.code : 'internal';
    res.status(code === 'invalid-argument' ? 400 : 500).json({ error: String(e.message || e) });
  }
});

// ----------------------
// ADMIN BACKFILL (tiny): recompute aggregates for one poll
// Callable: requires admin; add your own allowlist or custom claims check
export const backfillPollAggs = onCall({ region: 'us-central1' }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required');
  // TODO: replace with your org/admin check
  const isAdmin = req.auth?.token?.admin === true || (process.env.ALLOW_ADMINS || '').split(',').includes(uid);
  if (!isAdmin) throw new HttpsError('permission-denied', 'Admin only');

  const pollId: string = req.data?.pollId;
  if (!pollId) throw new HttpsError('invalid-argument', 'pollId required');

  // Collect into an in-memory map: agg[h3][questionId] = counters
  type C = { sum: number; posSum: number; negSum: number; posCount: number; negCount: number; zeroCount: number };
  const agg: Record<string, { stats: Record<string, C>; totalRespondents: number }> = {};

  const subs = await db.collectionGroup('submissions').where('pollId', '==', pollId).where('submitted', '==', true).get();
  subs.forEach((d) => {
    const s = d.data() as any;
    const h3 = s.h3?.id || s.h3r8 || s.h3Id || null; // support legacy
    const reso = s.h3?.res ?? 8;
    if (!h3) return;

    const cell = (agg[h3] ||= { stats: {}, totalRespondents: 0 });
    cell.totalRespondents += 1;

    const answers = (s.answers || {}) as Record<string, number>;
    for (const [q, raw] of Object.entries(answers)) {
      const v = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
      const c = (cell.stats[q] ||= { sum: 0, posSum: 0, negSum: 0, posCount: 0, negCount: 0, zeroCount: 0 });
      c.sum += v;
      if (v > 0) { c.posSum += v; c.posCount += 1; }
      else if (v < 0) { c.negSum += v; c.negCount += 1; }
      else { c.zeroCount += 1; }
    }
  });

  // Write results (batch in chunks)
  const writes: Promise<any>[] = [];
  const now = FieldValue.serverTimestamp();
  const col = db.collection(`polls/${pollId}/h3Agg`);
  for (const [h3, data] of Object.entries(agg)) {
    writes.push(col.doc(h3).set({ stats: data.stats, totalRespondents: data.totalRespondents, updatedAt: now }, { merge: true }));
  }
  await Promise.all(writes);

  return { ok: true, cells: Object.keys(agg).length };
});