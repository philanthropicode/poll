import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { latLngToCell, cellToParent, polygonToCells } from "h3-js";

// Initialize Admin SDK once (Cloud Functions runtime)
initializeApp();
const db = getFirestore();

// ================= CONFIG ==================
const TIMEZONE = "America/New_York";
const ALLOW_ADMINS = (process.env.ALLOW_ADMINS || "").split(",").filter(Boolean);
const MAPBOX_TOKEN = defineSecret("MAPBOX_TOKEN");

// ================= HELPERS =================
function isAdminReq(req) {
  const uid = req.auth?.uid;
  return !!uid && (req.auth?.token?.admin === true || ALLOW_ADMINS.includes(uid));
}

function countersFromValue(v) {
  return {
    sum: v,
    posSum: v > 0 ? v : 0,
    negSum: v < 0 ? v : 0,
    posCount: v > 0 ? 1 : 0,
    negCount: v < 0 ? 1 : 0,
    zeroCount: v === 0 ? 1 : 0,
  };
}

async function markPollDirty(pollId) {
  if (!pollId) return;
  await db.doc(`polls/${pollId}`).set(
    { meta: { dirty: true, lastSubmissionAt: FieldValue.serverTimestamp() } },
    { merge: true }
  );
}

// ================= SUBMISSION WRITE HOOK ===============
// Mark poll as dirty on any per-question submission write (ignore status docs)
export const onSubmissionWrite = onDocumentWritten(
  { document: "submissions/{id}", region: "us-central1" },
  async (event) => {
    const id = event.params.id || "";
    if (id.endsWith("__status")) return;

    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    const pollId = after?.pollId || before?.pollId;
    if (!pollId) return;
    await markPollDirty(pollId);
  }
);

// ================= FINALIZE SUBMISSION =================
// Callable to stamp location (city/state/zip + H3 snapshot) and set submitted=true
export const finalizeSubmission = onCall({ region: "us-central1" }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required");
  const pollId = String(req.data?.pollId || "");
  if (!pollId) throw new HttpsError("invalid-argument", "pollId required");

  // Load profile for stamping location snapshot
  const profSnap = await db.doc(`profiles/${uid}`).get();
  const prof = profSnap.exists ? (profSnap.data() || {}) : {};
  const address = prof.address || {};
  const geo = prof.geo || {};

  const location = {};
  if (address.city) location.city = String(address.city);
  if (address.state) location.state = String(address.state);
  if (address.zip) location.zip = String(address.zip);
  if (geo?.h3?.id && Number.isFinite(geo?.h3?.res)) {
    location.h3 = { id: String(geo.h3.id), res: Number(geo.h3.res) };
  } else if (Number.isFinite(geo.lat) && Number.isFinite(geo.lng)) {
    // fallback: compute r9 if we have lat/lng
    const id9 = latLngToCell(Number(geo.lat), Number(geo.lng), 9);
    location.h3 = { id: id9, res: 9 };
  }

  // Find user's per-question docs for this poll
  // Requires composite index on (pollId, userId)
  const qSnap = await db
    .collection("submissions")
    .where("pollId", "==", pollId)
    .where("userId", "==", uid)
    .get();

  const batch = db.batch();
  qSnap.forEach((docSnap) => {
    const sid = docSnap.id || "";
    if (sid.endsWith("__status")) return; // skip status doc
    const updates = {
      submitted: true,
      updatedAt: FieldValue.serverTimestamp(),
    };
    // stamp location snapshot (if present at profile time)
    if (Object.keys(location).length > 0) {
      updates.location = location;
    }
    batch.set(docSnap.ref, updates, { merge: true });
  });
  await batch.commit();

  await markPollDirty(pollId);
  return { ok: true, count: qSnap.size };
});

// ================== ROLLUP CORE ========================
// Build multi-resolution aggregates r9, r8, r7 from submissions with submitted==true
async function rollupPoll(pollId) {
  const subs = await db
    .collection("submissions")
    .where("pollId", "==", pollId)
    .where("submitted", "==", true)
    .get();

  // Cache profiles by uid to avoid repeated fetches
  const profileCache = new Map();

  // agg[res][h3] = { stats: { [qid]: counters }, userIds: Set<string> }
  const agg = { 9: {}, 8: {}, 7: {} };

  for (const d of subs.docs) {
    const s = d.data() || {};
    const uid = s.userId;
    // Status doc guard
    if (!s.questionId) continue;

    // Resolve an H3 id at r9 for this submission snapshot
    // Prefer stamped submission location.h3, fallback to profile geo/h3/latlng
    let h3id = s.location?.h3?.id;
    let h3res = s.location?.h3?.res;
    if (!h3id) {
      let prof = profileCache.get(uid);
      if (!prof) {
        const pSnap = await db.doc(`profiles/${uid}`).get();
        prof = pSnap.exists ? (pSnap.data()?.geo || {}) : {};
        profileCache.set(uid, prof);
      }
      if (prof?.h3?.id) {
        h3id = String(prof.h3.id);
        h3res = Number(prof.h3.res);
      } else if (Number.isFinite(prof.lat) && Number.isFinite(prof.lng)) {
        h3id = latLngToCell(Number(prof.lat), Number(prof.lng), 9);
        h3res = 9;
      }
    }
    if (!h3id) continue;

    // Normalize to r9 then compute parents
    const r9 = h3res === 9 ? h3id : cellToParent(h3id, 9);
    const r8 = cellToParent(r9, 8);
    const r7 = cellToParent(r9, 7);

    const v = Number.isFinite(s.value) ? Number(s.value) : 0;
    const qid = String(s.questionId);
    const c = countersFromValue(v);

    for (const [res, cell] of [
      [9, r9],
      [8, r8],
      [7, r7],
    ]) {
      const layer = (agg[res] ||= {});
      const rec =
        (layer[cell] ||= { stats: {}, userIds: new Set() });
      const st =
        (rec.stats[qid] ||= {
          sum: 0,
          posSum: 0,
          negSum: 0,
          posCount: 0,
          negCount: 0,
          zeroCount: 0,
        });
      st.sum += c.sum;
      st.posSum += c.posSum;
      st.negSum += c.negSum;
      st.posCount += c.posCount;
      st.negCount += c.negCount;
      st.zeroCount += c.zeroCount;
      rec.userIds.add(uid);
    }
  }

  // Clear existing layers then write new ones
  for (const res of [9, 8, 7]) {
    const col = db.collection(`polls/${pollId}/h3Agg_r${res}`);
    const snap = await col.get();
    const delBatch = db.batch();
    snap.forEach((doc) => delBatch.delete(doc.ref));
    await delBatch.commit();

    const now = FieldValue.serverTimestamp();
    const writes = [];
    const layer = agg[res] || {};
    for (const [h3, rec] of Object.entries(layer)) {
      const totalRespondents = rec.userIds.size;
      writes.push(
        col.doc(h3).set(
          { stats: rec.stats, totalRespondents, updatedAt: now },
          { merge: true }
        )
      );
    }
    await Promise.all(writes);
  }

  await db
    .doc(`polls/${pollId}`)
    .set(
      { meta: { dirty: false, lastRolledAt: FieldValue.serverTimestamp() } },
      { merge: true }
    );

  return {
    ok: true,
    cells: [9, 8, 7].reduce(
      (n, r) => n + Object.keys(agg[r] || {}).length,
      0
    ),
  };
}

// ================ SCHEDULED ROLLUP =====================
// Every 3 hours, recompute dirty polls
export const scheduledRollup = onSchedule(
  { schedule: "every 3 hours", timeZone: TIMEZONE },
  async () => {
    const dirty = await db
      .collection("polls")
      .where("meta.dirty", "==", true)
      .get();
    for (const d of dirty.docs) {
      try {
        await rollupPoll(d.id);
      } catch (e) {
        console.error("Rollup failed", d.id, e);
      }
    }
  }
);

// ================ ADMIN CALLABLE =======================
export const rollupNow = onCall({ region: "us-central1" }, async (req) => {
  if (!isAdminReq(req)) throw new HttpsError("permission-denied", "Admin only");
  const pollId = String(req.data?.pollId || "");
  if (!pollId) throw new HttpsError("invalid-argument", "pollId required");
  return await rollupPoll(pollId);
});

 
// ================ READ API (Callable) ======================
// Callable equivalent of getH3Agg (dev-friendly; no CORS/proxy)
export const getH3AggCallable = onCall(
  { region: "us-central1", timeoutSeconds: 60, memory: "256MiB" },
  async (req) => {
    try {
      const d = req.data || {};
      const pollId = String(d.pollId || "");
      const questionId = String(d.questionId || "");
      const reso = Number(d.res ?? 8);

      // Parse bounds as numbers; they may be undefined on first load
      const west  = d.west  != null ? Number(d.west)  : NaN;
      const south = d.south != null ? Number(d.south) : NaN;
      const east  = d.east  != null ? Number(d.east)  : NaN;
      const north = d.north != null ? Number(d.north) : NaN;

      if (!pollId || !questionId) {
        throw new HttpsError("invalid-argument", "pollId and questionId are required");
      }
      if (!Number.isInteger(reso) || reso < 0 || reso > 15) {
        throw new HttpsError("invalid-argument", "res must be an integer between 0 and 15");
      }

      const haveBounds = [west, south, east, north].every(Number.isFinite);
      if (haveBounds && (west >= east || south >= north)) {
        throw new HttpsError("invalid-argument", "bounds are invalid (west<east, south<north required)");
      }

      const col = db.collection(`polls/${pollId}/h3Agg_r${reso}`);
      const aggs = [];

      if (haveBounds) {
        // rectangle ring (lng,lat) closed
        const rect = [
          [west, south],
          [east, south],
          [east, north],
          [west, north],
          [west, south],
        ];

        let cells;
        try {
          // h3-js v4: polygonToCells expects an array of loops
          cells = polygonToCells([rect], reso, false);
        } catch (err) {
          console.error("polygonToCells failed", { err, reso, west, south, east, north });
          throw new HttpsError("invalid-argument", "bounds polygon failed");
        }

        // Batch IN queries (Firestore supports up to 30 ids per IN)
        for (let i = 0; i < cells.length; i += 30) {
          const slice = cells.slice(i, i + 30);
          if (!slice.length) continue;
          const snap = await col.where("__name__", "in", slice).get();
          snap.forEach((d) => {
            const s = (d.data() || {}).stats?.[questionId];
            if (s && typeof s.sum === "number") aggs.push({ h3: d.id, sum: s.sum });
          });
        }
      } else {
        // No bounds provided: return all (OK for demos; avoid at scale)
        const snap = await col.get();
        snap.forEach((d) => {
          const s = (d.data() || {}).stats?.[questionId];
          if (s && typeof s.sum === "number") aggs.push({ h3: d.id, sum: s.sum });
        });
      }

      return { aggs };
    } catch (e) {
      // Always throw HttpsError so the client doesn’t see a fake "CORS" error
      console.error("getH3AggCallable error", e, { data: req?.data });
      if (e instanceof HttpsError) throw e;
      throw new HttpsError("internal", "getH3AggCallable crashed");
    }
  }
);

 
// ================== PROFILE ADDRESS ====================
// Geocode helper (Mapbox). You can replace with your provider.
async function geocodeWithMapbox(query) {
  const token = process.env.MAPBOX_TOKEN;
  if (!token) throw new Error("Missing MAPBOX_TOKEN");
  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      query
    )}.json`
  );
  url.searchParams.set("access_token", token);
  url.searchParams.set("limit", "1");
  url.searchParams.set("types", "address,poi,neighborhood,locality,place,postcode");
  url.searchParams.set("country", "US");
  const resp = await fetch(url.toString());
  if (!resp.ok) throw new Error(`Mapbox error: ${resp.status}`);
  const data = await resp.json();
  const f = data?.features?.[0];
  if (!f?.center || f.center.length < 2) throw new Error("No geocode result");
  const [lng, lat] = f.center;
  return { lat, lng };
}

// Callable to save user address and compute geo.h3
export const saveUserAddress = onCall(
  { region: "us-central1", cors: true, secrets: [MAPBOX_TOKEN] },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign in required");

    const { line1 = "", line2 = "", city, state, zip } = req.data || {};
    if (!city || !state || !zip)
      throw new HttpsError(
        "invalid-argument",
        "city, state, and zip are required"
      );

    const st = String(state).trim().slice(0, 2).toUpperCase();
    const z5 = String(zip).replace(/\D/g, "").padStart(5, "0").slice(0, 5);
    const addressStr = [line1, city, st, z5].filter(Boolean).join(", ");

    const { lat, lng } = await geocodeWithMapbox(addressStr);
    const reso = 8;
    const h3id = latLngToCell(lat, lng, reso);

    await db
      .doc(`profiles/${uid}`)
      .set(
        {
          address: {
            line1: String(line1 || "").trim(),
            line2: String(line2 || "").trim(),
            city: String(city || "").trim(),
            state: st,
            zip: z5,
          },
          geo: {
            lat,
            lng,
            h3: { id: h3id, res: reso },
            source: "mapbox",
            updatedAt: FieldValue.serverTimestamp(),
          },
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    return { ok: true, h3: { id: h3id, res: reso }, lat, lng };
  }
);

// ==================== CSV EXPORT =======================
// Note: Do NOT export H3 values. City/State/ZIP optional via includeLocation
export const exportPollCsv = onCall({ region: "us-central1", cors: true }, async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new Error("unauthenticated");

    const { pollId, includeComments = false, includeLocation = false } = req.data || {};
    if (!pollId) throw new Error("invalid-argument: pollId required");

    const db = getFirestore();

    // --- determine permissions (owner/global admin/listed admin) --------------
    const pollSnap = await db.doc(`polls/${pollId}`).get();
    if (!pollSnap.exists) throw new Error("not-found: poll not found");
    const poll = pollSnap.data() || {};
    const isOwner = poll.createdBy === uid;
    const isGlobalAdmin = req.auth?.token?.admin === true;
    const arrayListed = Array.isArray(poll.admins) && poll.admins.includes(uid);
    const mapListed = poll.adminsMap && typeof poll.adminsMap === "object" && !!poll.adminsMap[uid];
    const isPollAdmin = isOwner || isGlobalAdmin || arrayListed || mapListed;

    // only allow export by participants or admins
    const statusId = `${pollId}__${uid}__status`;
    const statusSnap = await db.doc(`submissions/${statusId}`).get();
    if (!statusSnap.exists && !isPollAdmin) {
      throw new Error("permission-denied: export requires submitter or poll admin");
    }

    // Fetch questions to label CSV
    const qsSnap = await db.collection(`polls/${pollId}/questions`).get();
    const questions = [];
    qsSnap.forEach((d) =>
      questions.push({
        id: d.id,
        text: d.get("text") || "",
        order: d.get("order") || 0,
      })
    );
    questions.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const qIndex = new Map(
      questions.map((q, i) => [q.id, { ...q, index: i + 1 }])
    );

    // Only export submitted==true
    const subsSnap = await db
      .collection("submissions")
      .where("pollId", "==", pollId)
      .where("submitted", "==", true)
      .get();

    const respondentIndex = new Map();
    let nextResp = 1;
    const rows = [];
    subsSnap.forEach((d) => {
      const s = d.data() || {};
      const q = qIndex.get(s.questionId);
      if (!q) return;

      if (!respondentIndex.has(s.userId))
        respondentIndex.set(s.userId, nextResp++);
      const rec = {
        respondent: respondentIndex.get(s.userId),
        questionIndex: q.index,
        questionId: q.id,
        question: q.text,
        value: typeof s.value === "number" ? s.value : "",
      };
      if (includeComments && s.comment) rec.comment = s.comment;
      if (includeLocation && s.location) {
        if (s.location.city) rec.city = s.location.city;
        if (s.location.state) rec.state = s.location.state;
        if (s.location.zip) rec.zip = s.location.zip;
      }
      // DO NOT export H3 ids to CSV (privacy)
      rows.push(rec);
    });

    const headers = ["respondent", "questionIndex", "questionId", "question", "value"]
      .concat(includeComments ? ["comment"] : [])
      .concat(includeLocation ? ["city", "state", "zip"] : []);

    const esc = (v) =>
      v == null
        ? ""
        : /[",\n]/.test(String(v))
        ? `"${String(v).replace(/"/g, '""')}"`
        : String(v);

    const csv =
      [headers.join(",")]
        .concat(rows.map((r) => headers.map((h) => esc(r[h])).join(",")))
        .join("\n");

    if (csv.length < 8_000_000) {
      return { kind: "inline", filename: `poll-${pollId}-export.csv`, csv };
    } else {
      const bucket = getStorage().bucket();
      const file = bucket.file(
        `exports/polls/${pollId}/export-${Date.now()}.csv`
      );
      await file.save(csv, {
        contentType: "text/csv",
        cacheControl: "no-store",
      });
      const [url] = await file.getSignedUrl({
        action: "read",
        expires: Date.now() + 60 * 60 * 1000,
      });
      return { kind: "url", url };
    }
  }
);

// ==================== ONE-OFF MIGRATION (Admin) =======================
// Migrate legacy geo.h3r8 to geo.h3 = { id, res: 8 } for a specific user
export const migrateProfileH3r8 = onCall({ region: "us-central1" }, async (req) => {
  if (!isAdminReq(req)) throw new HttpsError("permission-denied", "Admin only");
  const uid = String(req.data?.uid || "");
  if (!uid) throw new HttpsError("invalid-argument", "uid required");

  const ref = db.doc(`profiles/${uid}`);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, reason: "profile-not-found" };
  const data = snap.data() || {};
  const geo = data.geo || {};
  const legacy = typeof geo.h3r8 === "string" && geo.h3r8.length > 0 ? geo.h3r8 : null;
  if (!legacy) return { ok: false, reason: "no-legacy-h3r8" };

  await ref.set(
    {
      "geo.h3": { id: legacy, res: 8 },
      "geo.h3r8": FieldValue.delete(),
      "geo.updatedAt": FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  return { ok: true, migrated: uid, h3: { id: legacy, res: 8 } };
});
