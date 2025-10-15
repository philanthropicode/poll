
```
// functions/src/index.ts
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { defineSecret, onCall } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { geoToH3, cellToParent } from "h3-js";

initializeApp();
const db = getFirestore();

// =============== CONFIG =====================
const RESOLUTIONS = [9, 8, 7]; // H3 pyramid levels
const ROLLUP_INTERVAL = "every 3 hours";
const TIMEZONE = "America/New_York";
const ALLOW_ADMINS = (process.env.ALLOW_ADMINS || "").split(",");

// =============== HELPERS ====================
function computeH3(lat: number, lng: number, res = 8) {
  return { id: geoToH3(lat, lng, res), res };
}

async function markPollDirty(pollId: string) {
  await db.doc(`polls/${pollId}`).set({
    meta: {
      dirty: true,
      lastSubmissionAt: FieldValue.serverTimestamp(),
    },
  }, { merge: true });
}

// =============== VALIDATION =================
function validateSubmission(s: any) {
  if (!s || typeof s !== "object") throw new Error("Invalid submission");
  if (!("pollId" in s) || !("questionId" in s) || !("userId" in s))
    throw new Error("Missing required fields");
  if (s.submitted && (!s.location || !Number.isFinite(s.location.lat) || !Number.isFinite(s.location.lng)))
    throw new Error("Missing location");
  if (s.submitted && (!s.value || typeof s.value !== "number"))
    throw new Error("Invalid value");
}

// =============== SUBMISSION ONWRITE =================
export const onSubmissionWrite = onDocumentWritten(
  { document: "submissionsLatest/{submissionId}", region: "us-central1" },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    const pollId = after?.pollId || before?.pollId;
    if (!pollId) return;

    try {
      if (after) validateSubmission(after);
    } catch (e) {
      console.warn("Rejected invalid submission:", e);
      return;
    }

    await markPollDirty(pollId);
  }
);

// =============== ROLLUP CORE =================
function countersFromValue(v: number) {
  return {
    sum: v,
    posSum: v > 0 ? v : 0,
    negSum: v < 0 ? v : 0,
    posCount: v > 0 ? 1 : 0,
    negCount: v < 0 ? 1 : 0,
    zeroCount: v === 0 ? 1 : 0,
  };
}

async function rollupPoll(pollId: string) {
  const subs = await db.collection("submissionsLatest")
    .where("pollId", "==", pollId)
    .where("submitted", "==", true)
    .get();

  const agg: Record<number, Record<string, any>> = {};
  subs.forEach((d) => {
    const s = d.data();
    const { lat, lng } = s.location || {};
    if (!lat || !lng) return;
    const base = computeH3(lat, lng, 9);
    const parent8 = cellToParent(base.id, 8);
    const parent7 = cellToParent(base.id, 7);
    const entries = [
      [9, base.id],
      [8, parent8],
      [7, parent7],
    ];
    const val = typeof s.value === "number" ? s.value : 0;
    const c = countersFromValue(val);

    for (const [res, h3] of entries) {
      const layer = (agg[res] ||= {});
      const cell = (layer[h3] ||= { stats: {}, totalRespondents: 0 });
      cell.totalRespondents += 1;
      const q = s.questionId;
      const stat = (cell.stats[q] ||= {
        sum: 0, posSum: 0, negSum: 0,
        posCount: 0, negCount: 0, zeroCount: 0,
      });
      for (const k in c) stat[k] += (c as any)[k];
    }
  });

  // Clear existing
  for (const res of RESOLUTIONS) {
    const snap = await db.collection(`polls/${pollId}/h3Agg_r${res}`).get();
    const batch = db.batch();
    snap.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }

  // Write new
  const now = FieldValue.serverTimestamp();
  for (const res of RESOLUTIONS) {
    const col = db.collection(`polls/${pollId}/h3Agg_r${res}`);
    const layer = agg[res] || {};
    const writes = Object.entries(layer).map(([h3, data]) =>
      col.doc(h3).set({ ...data, updatedAt: now }, { merge: true })
    );
    await Promise.all(writes);
  }

  await db.doc(`polls/${pollId}`).set({
    meta: { dirty: false, lastRolledAt: FieldValue.serverTimestamp() },
  }, { merge: true });

  return { cells: Object.values(agg).reduce((a, l) => a + Object.keys(l).length, 0) };
}

// =============== SCHEDULED ROLLUP =================
export const scheduledRollup = onSchedule(
  { schedule: ROLLUP_INTERVAL, timeZone: TIMEZONE },
  async () => {
    const dirty = await db.collection("polls").where("meta.dirty", "==", true).get();
    for (const d of dirty.docs) {
      try {
        const pollId = d.id;
        console.log("Rolling up poll", pollId);
        await rollupPoll(pollId);
      } catch (e) {
        console.error("Rollup failed:", d.id, e);
      }
    }
  }
);

// =============== ADMIN CALLABLE ROLLUP ==============
export const rollupNow = onCall({ region: "us-central1" }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new Error("unauthenticated");
  const isAdmin = req.auth?.token?.admin === true || ALLOW_ADMINS.includes(uid);
  if (!isAdmin) throw new Error("permission-denied");
  const pollId = req.data?.pollId;
  if (!pollId) throw new Error("invalid-argument: pollId required");
  return await rollupPoll(pollId);
});

// =============== READ API ==========================
export const getH3Agg = onCall({ region: "us-central1" }, async (req) => {
  const { pollId, questionId, res = 8 } = req.data || {};
  if (!pollId || !questionId) throw new Error("invalid-argument");
  const col = db.collection(`polls/${pollId}/h3Agg_r${res}`);
  const snap = await col.get();
  const aggs: any[] = [];
  snap.forEach((d) => {
    const s = d.data().stats?.[questionId];
    if (s && typeof s.sum === "number") aggs.push({ h3: d.id, sum: s.sum });
  });
  return { aggs };
});

// =============== SAVE USER ADDRESS =================
const MAPBOX_TOKEN = defineSecret("MAPBOX_TOKEN");

export const saveUserAddress = onCall(
  { region: "us-central1", cors: true, secrets: [MAPBOX_TOKEN] },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new Error("unauthenticated");
    const { line1 = "", line2 = "", city, state, zip } = req.data || {};
    if (!city || !state || !zip) throw new Error("invalid-argument: city, state, zip required");

    // Mock geocode (replace with real API call)
    const lat = 39.2904, lng = -76.6122; // placeholder
    const reso = 8;
    const h3id = geoToH3(lat, lng, reso);

    await db.doc(`profiles/${uid}`).set({
      address: { line1, line2, city, state, zip },
      geo: { lat, lng, h3: { id: h3id, res: reso }, source: "mapbox", updatedAt: FieldValue.serverTimestamp() },
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return { ok: true, h3: { id: h3id, res: reso }, lat, lng };
  }
);
```


```
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() { return request.auth != null; }
    function pollDoc(pollId) { return get(/databases/$(database)/documents/polls/$(pollId)); }
    function isOwner(pollId) { return isSignedIn() && pollDoc(pollId).data.createdBy == request.auth.uid; }
    function isAdmin() { return isSignedIn() && request.auth.token.admin == true; }
    function pollOpen(pollId) {
      let p = pollDoc(pollId);
      return !('dueAt' in p.data) || request.time < p.data.dueAt;
    }
    function isPollAdmin(pollId) {
      let p = pollDoc(pollId);
      let ownerOrGlobal = isAdmin() || (isSignedIn() && p.data.createdBy == request.auth.uid);
      let arrayListed = ('admins' in p.data) && p.data.admins.hasAny([request.auth.uid]);
      let mapListed = ('adminsMap' in p.data) && (request.auth.uid in p.data.adminsMap);
      return ownerOrGlobal || arrayListed || mapListed;
    }

    // --- Polls ---
    match /polls/{pollId} {
      allow read: if true;
      allow create: if isSignedIn();
      allow update: if isOwner(pollId);

      match /questions/{questionId} {
        allow read: if true;
        allow create, update, delete: if isOwner(pollId) && pollOpen(pollId);
      }

      match /h3Agg_r{res}/{h3} {
        allow read: if true;
        allow write: if false;
      }
    }

    // --- Submissions (Latest Only) ---
    match /submissionsLatest/{id} {
      allow read: if isSignedIn() &&
                  (resource.data.userId == request.auth.uid || isPollAdmin(resource.data.pollId));

      allow create: if isSignedIn()
        && request.resource.data.userId == request.auth.uid
        && id == (request.resource.data.pollId + '__' + request.auth.uid + '__' + request.resource.data.questionId)
        && pollOpen(request.resource.data.pollId);

      allow update: if isSignedIn()
        && resource.data.userId == request.auth.uid
        && id == (resource.data.pollId + '__' + request.auth.uid + '__' + resource.data.questionId)
        && pollOpen(resource.data.pollId);

      allow delete: if false;
    }

    // --- Profiles ---
    match /profiles/{uid} {
      allow read: if isSignedIn() && request.auth.uid == uid;
      allow create, update: if isSignedIn()
        && request.auth.uid == uid
        && !('geo' in request.resource.data)
        && !('lat' in request.resource.data)
        && !('lng' in request.resource.data)
        && !('h3r8' in request.resource.data);
    }
  }
}
```


```
// firestore.indexes.json
{
  "indexes": [
    {
      "collectionGroup": "submissionsLatest",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "pollId", "order": "ASCENDING" },
        { "fieldPath": "questionId", "order": "ASCENDING" }
      ]
    }
  ],
  "fieldOverrides": [
    {
      "collectionGroup": "h3Agg_r7",
      "fieldPath": "stats",
      "indexes": [],
      "shouldIndex": false
    },
    {
      "collectionGroup": "h3Agg_r8",
      "fieldPath": "stats",
      "indexes": [],
      "shouldIndex": false
    },
    {
      "collectionGroup": "h3Agg_r9",
      "fieldPath": "stats",
      "indexes": [],
      "shouldIndex": false
    }
  ]
}
```


```
// functions/src/guards.ts
// Minimal data guards for client-written submissionsLatest docs.
// Use on the server (Cloud Functions) before marking a poll dirty.

export function validateSubmissionLatest(doc: any) {
  if (!doc || typeof doc !== "object") throw new Error("Invalid submission");
  const need = ["pollId", "questionId", "userId", "submitted", "updatedAt"];
  for (const k of need) if (!(k in doc)) throw new Error(`Missing field: ${k}`);

  if (doc.submitted) {
    if (!doc.location || !Number.isFinite(doc.location.lat) || !Number.isFinite(doc.location.lng)) {
      throw new Error("Missing/invalid location");
    }
    if (!Number.isFinite(doc.value)) {
      throw new Error("Invalid numeric value");
    }
  }

  // Optional: clamp ranges if you use a bounded scale.
  // const v = Number(doc.value);
  // if (v < -100 || v > 100) throw new Error("Out-of-range value");
}
```

```
// functions/src/profile.ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { geoToH3 } from "h3-js";

const MAPBOX_TOKEN = defineSecret("MAPBOX_TOKEN"); // set via: firebase functions:secrets:set MAPBOX_TOKEN

// NOTE: Replace the stubbed geocode call with a real fetch to Mapbox or your provider.
async function geocodeUSAddress(_addr: { line1?: string; line2?: string; city: string; state: string; zip: string }) {
  // Implement real geocoding here (use MAPBOX_TOKEN.value()).
  // Stub: Baltimore downtown
  return { lat: 39.2904, lng: -76.6122 };
}

export const saveUserAddress = onCall({ region: "us-central1", cors: true, secrets: [MAPBOX_TOKEN] }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required");

  const { line1 = "", line2 = "", city, state, zip } = (req.data || {}) as {
    line1?: string; line2?: string; city?: string; state?: string; zip?: string;
  };

  if (!city || !state || !zip) throw new HttpsError("invalid-argument", "city, state, and zip are required");

  const { lat, lng } = await geocodeUSAddress({ line1, line2, city, state, zip });
  const res = 8;                      // default; you can vary by density later
  const h3id = geoToH3(lat, lng, res);

  const db = getFirestore();
  await db.doc(`profiles/${uid}`).set({
    address: { line1, line2, city, state, zip },
    geo: {
      lat, lng,
      h3: { id: h3id, res },
      source: "mapbox",
      updatedAt: FieldValue.serverTimestamp(),
    },
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return { ok: true, h3: { id: h3id, res }, lat, lng };
});
```


```
// functions/src/aggregate.ts
// Submission write hook (top-level 'submissionsLatest') that marks polls "dirty".
// We do NOT increment aggregates per-write; aggregates are rebuilt on a schedule/admin trigger.

import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { validateSubmissionLatest } from "./guards";

const db = getFirestore();

export async function markPollDirty(pollId: string) {
  await db.doc(`polls/${pollId}`).set({
    meta: { dirty: true, lastSubmissionAt: FieldValue.serverTimestamp() }
  }, { merge: true });
}

export const onSubmissionWrite = onDocumentWritten(
  { document: "submissionsLatest/{submissionId}", region: "us-central1" },
  async (event) => {
    const before = event.data?.before?.data();
    const after  = event.data?.after?.data();
    const pollId = after?.pollId || before?.pollId;
    if (!pollId) return;

    try {
      if (after) validateSubmissionLatest(after);
    } catch (e) {
      console.warn("Invalid submission; ignoring aggregation mark:", e);
      return;
    }

    await markPollDirty(pollId);
  }
);
```


```
// functions/src/api.ts
// Read API for map aggregates, plus scheduled/admin rollups (recompute from latest-only docs)

import { onRequest, HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { geoToH3, cellToParent } from "h3-js";

const db = getFirestore();
const RESOLUTIONS = [9, 8, 7];
const TIMEZONE = "America/New_York";
const ALLOW_ADMINS = (process.env.ALLOW_ADMINS || "").split(",");

// ---- rollup helpers ----
function countersFromValue(v: number) {
  return {
    sum: v,
    posSum: v > 0 ? v : 0,
    negSum: v < 0 ? v : 0,
    posCount: v > 0 ? 1 : 0,
    negCount: v < 0 ? 1 : 0,
    zeroCount: v === 0 ? 1 : 0,
  };
}

async function clearAggCollections(pollId: string) {
  for (const r of RESOLUTIONS) {
    const snap = await db.collection(`polls/${pollId}/h3Agg_r${r}`).get();
    const batch = db.batch();
    snap.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
}

async function writeAggLayer(pollId: string, res: number, layer: Record<string, any>) {
  const col = db.collection(`polls/${pollId}/h3Agg_r${res}`);
  const now = FieldValue.serverTimestamp();
  const writes: Promise<any>[] = [];
  for (const [h3, data] of Object.entries(layer)) {
    writes.push(col.doc(h3).set({ ...data, updatedAt: now }, { merge: true }));
  }
  await Promise.all(writes);
}

async function rollupPoll(pollId: string) {
  // Build aggregates from "latest only" submissions for this poll
  const snap = await db.collection("submissionsLatest")
    .where("pollId", "==", pollId)
    .where("submitted", "==", true)
    .get();

  const agg: Record<number, Record<string, any>> = {};

  snap.forEach((d) => {
    const s: any = d.data();
    if (!s?.location || !Number.isFinite(s.location.lat) || !Number.isFinite(s.location.lng)) return;
    const { lat, lng } = s.location;

    // finest h3 (r9) and parents
    const r9 = geoToH3(lat, lng, 9);
    const r8 = cellToParent(r9, 8);
    const r7 = cellToParent(r9, 7);
    const entries: Array<[number, string]> = [[9, r9], [8, r8], [7, r7]];

    const v = Number.isFinite(s.value) ? s.value : 0;
    const c = countersFromValue(v);
    const qid = s.questionId;

    for (const [res, h3] of entries) {
      const layer = (agg[res] ||= {});
      const cell = (layer[h3] ||= { stats: {}, totalRespondents: 0 });
      cell.totalRespondents += 1;
      const stat = (cell.stats[qid] ||= { sum: 0, posSum: 0, negSum: 0, posCount: 0, negCount: 0, zeroCount: 0 });
      stat.sum += c.sum;
      stat.posSum += c.posSum;
      stat.negSum += c.negSum;
      stat.posCount += c.posCount;
      stat.negCount += c.negCount;
      stat.zeroCount += c.zeroCount;
    }
  });

  await clearAggCollections(pollId);
  for (const r of RESOLUTIONS) {
    await writeAggLayer(pollId, r, agg[r] || {});
  }

  await db.doc(`polls/${pollId}`).set({ meta: { dirty: false, lastRolledAt: FieldValue.serverTimestamp() } }, { merge: true });

  const cells = Object.values(agg).reduce((n, layer) => n + Object.keys(layer || {}).length, 0);
  return { ok: true, cells };
}

// ---- READ API (HTTP): /api/polls/:pollId/h3Agg?questionId=Q&res=8 ----
export const getH3Agg = onRequest({ region: "us-central1", cors: true }, async (req, res) => {
  try {
    const urlParts = req.path.split("/").filter(Boolean);
    const pollIdx = urlParts.findIndex((p) => p === "polls");
    const pollId = pollIdx >= 0 ? urlParts[pollIdx + 1] : undefined;
    const questionId = String((req.query as any).questionId || "");
    const resStr = String((req.query as any).res || "8");
    if (!pollId || !questionId) throw new HttpsError("invalid-argument", "pollId & questionId required");

    const r = Number(resStr);
    const col = db.collection(`polls/${pollId}/h3Agg_r${r}`);
    const snap = await col.get();
    const out: Array<{ h3: string; sum: number }> = [];
    snap.forEach((d) => {
      const s = (d.data() as any)?.stats?.[questionId];
      if (s && typeof s.sum === "number") out.push({ h3: d.id, sum: s.sum });
    });
    res.json({ aggs: out });
  } catch (e: any) {
    const code = e?.code === "invalid-argument" ? 400 : 500;
    res.status(code).json({ error: e?.message || String(e) });
  }
});

// ---- Scheduled rollup: every 3 hours ----
export const scheduledRollup = onSchedule({ schedule: "every 3 hours", timeZone: TIMEZONE }, async () => {
  const dirty = await db.collection("polls").where("meta.dirty", "==", true).get();
  for (const p of dirty.docs) {
    try { await rollupPoll(p.id); } catch (e) { console.error("Rollup failed", p.id, e); }
  }
});

// ---- Admin callable: roll up a poll now ----
export const rollupNow = onCall({ region: "us-central1" }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in");
  const isAdmin = req.auth?.token?.admin === true || ALLOW_ADMINS.includes(uid);
  if (!isAdmin) throw new HttpsError("permission-denied", "Admin only");

  const pollId = String(req.data?.pollId || "");
  if (!pollId) throw new HttpsError("invalid-argument", "pollId required");

  return await rollupPoll(pollId);
});
```

```
// functions/src/index.js
// Legacy JS callable kept for CSV export (uses top-level submissionsLatest)
// If you prefer TypeScript, migrate this into index.ts; otherwise this JS file can coexist.

import { onCall } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

initializeApp();

export const exportPollCsv = onCall({ region: "us-central1", cors: true }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new Error("unauthenticated");

  const { pollId, includeComments = false, includeLocation = false } = req.data || {};
  if (!pollId) throw new Error("invalid-argument: pollId required");

  const db = getFirestore();

  // Optional: only allow export by poll admins — add your own check here.
  // const isAdmin = req.auth?.token?.admin === true; if (!isAdmin) throw new Error("permission-denied");

  // Fetch questions for nicer labels
  const qsSnap = await db.collection(`polls/${pollId}/questions`).get();
  const questions = [];
  qsSnap.forEach((d) => questions.push({ id: d.id, text: d.get("text") || "", order: d.get("order") || 0 }));
  questions.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const qIndex = new Map(questions.map((q, i) => [q.id, { ...q, index: i + 1 }]));

  // Use latest-only submissions
  const subsSnap = await db.collection("submissionsLatest")
    .where("pollId", "==", pollId)
    .where("submitted", "==", true)
    .get();

  // Assign respondent numbers by userId
  const respondentIndex = new Map();
  let nextResp = 1;

  const rows = [];
  subsSnap.forEach((d) => {
    const s = d.data();
    const q = qIndex.get(s.questionId);
    if (!q) return;

    if (!respondentIndex.has(s.userId)) respondentIndex.set(s.userId, nextResp++);
    const rec = {
      respondent: respondentIndex.get(s.userId),
      questionIndex: q.index,
      questionId: q.id,
      question: q.text,
      value: typeof s.value === "number" ? s.value : ""
    };
    if (includeComments && s.comment) rec.comment = s.comment;
    if (includeLocation && s.location) {
      rec.lat = s.location.lat;
      rec.lng = s.location.lng;
    }
    // topic/tags if present
    if (s.topic) rec.topic = s.topic;
    if (Array.isArray(s.topics)) rec.topics = s.topics.join("|");

    rows.push(rec);
  });

  const headers = ["respondent","questionIndex","questionId","question","value"]
    .concat(includeComments ? ["comment"] : [])
    .concat(includeLocation ? ["lat","lng"] : [])
    .concat(["topic","topics"]);

  const esc = (v) => (v == null)
    ? ""
    : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g,'""')}"` : String(v);

  const csv = [headers.join(",")].concat(
    rows.map(r => headers.map(h => esc(r[h])).join(","))
  ).join("\n");

  if (csv.length < 8_000_000) {
    return { kind: "inline", filename: `poll-${pollId}-export.csv`, csv };
  } else {
    const bucket = getStorage().bucket();
    const file = bucket.file(`exports/polls/${pollId}/export-${Date.now()}.csv`);
    await file.save(csv, { contentType: "text/csv", cacheControl: "no-store" });
    const [url] = await file.getSignedUrl({ action: "read", expires: Date.now() + 60 * 60 * 1000 });
    return { kind: "url", url };
  }
});
```


Notes to keep everything working smoothly

Collection names & model (final):
- submissionsLatest/{pollId}__{userId}__{questionId} — latest only, users can overwrite.
- Aggregates written to: polls/{pollId}/h3Agg_r9|r8|r7/{h3}.
- Profiles: profiles/{uid}.geo.h3 = { id, res }.

Triggers & APIs:
- aggregate.ts::onSubmissionWrite → marks polls/{pollId}.meta.dirty = true.
- api.ts::scheduledRollup (every 3h) & api.ts::rollupNow (admin) → rebuild aggs.
- api.ts::getH3Agg (HTTP) → returns { aggs: [{ h3, sum }] } for your Mapbox layer.
- profile.ts::saveUserAddress (callable) → writes geo.h3 = { id, res } on profile.

firestore.rules & indexes: use the versions you posted earlier with:
- read-only h3Agg_r*,
- guarded submissionsLatest,
- profiles geo fields server-only,
- composite index for (pollId, questionId) on submissionsLatest (and any others you need).