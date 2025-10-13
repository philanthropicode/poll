import { onCall } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { defineSecret } from "firebase-functions/params";
import { latLngToCell } from "h3-js";

initializeApp();

export const exportPollCsv = onCall({ region: "us-central1", cors: true }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new Error("unauthenticated");

  const { pollId, includeComments = false, includeLocation = false } = req.data || {};
  if (!pollId) throw new Error("invalid-argument: pollId required");

  const db = getFirestore();
  const statusId = `${pollId}__${uid}__status`;
  const statusSnap = await db.doc(`submissions/${statusId}`).get();
  if (!statusSnap.exists) throw new Error("permission-denied: submit the poll first");

  const qsSnap = await db.collection(`polls/${pollId}/questions`).get();
  const questions = [];
  qsSnap.forEach((d) => questions.push({ id: d.id, text: d.get("text") || "", order: d.get("order") || 0 }));
  questions.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const qIndex = new Map(questions.map((q, i) => [q.id, { ...q, index: i + 1 }]));

  const subsSnap = await db.collection("submissions").where("pollId", "==", pollId).get();

  const respondentIndex = new Map();
  let nextResp = 1;
  const rows = [];
  subsSnap.forEach((d) => {
    const s = d.data();
    if (!s.questionId) return;
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
    if (includeLocation) {
      if (s.city) rec.city = s.city;
      if (s.state) rec.state = s.state;
      if (s.zip) rec.zip = s.zip;
    }
    rows.push(rec);
  });

  const headers = ["respondent","questionIndex","questionId","question","value"]
    .concat(includeComments ? ["comment"] : [])
    .concat(includeLocation ? ["city","state","zip"] : []);

  const esc = (v) => (v == null) ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g,'""')}"` : String(v);
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

// === Address → h3r8 ===
// 1) Define secret once (project-level). For prod/staging, set with:
//    firebase functions:secrets:set MAPBOX_TOKEN
const MAPBOX_TOKEN = defineSecret("MAPBOX_TOKEN");

// 2) Helper: geocode via Mapbox
async function geocodeWithMapbox(query) {
  const token = process.env.MAPBOX_TOKEN;
  if (!token) throw new Error("Missing MAPBOX_TOKEN");
  const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`);
  url.searchParams.set("access_token", token);
  url.searchParams.set("limit", "1");
  url.searchParams.set("types", "address,poi,neighborhood,locality,place,postcode");
  url.searchParams.set("country", "US");
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Mapbox error: ${res.status}`);
  const data = await res.json();
  const f = data?.features?.[0];
  if (!f?.center || f.center.length < 2) throw new Error("No geocode result");
  const [lng, lat] = f.center;
  return { lat, lng, raw: f };
}

// 3) Callable
export const saveUserAddress = onCall(
  { region: "us-central1", cors: true, secrets: [MAPBOX_TOKEN] },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new Error("unauthenticated");

    const { line1 = "", line2 = "", city, state, zip } = (req.data || {});
    if (!city || !state || !zip) throw new Error("invalid-argument: city, state, zip are required.");

    const st = String(state).trim().slice(0, 2).toUpperCase();
    const z5 = String(zip).replace(/\D/g, "").padStart(5, "0").slice(0, 5);

    const addressStr = [line1, city, st, z5].filter(Boolean).join(", ");

    const { lat, lng } = await geocodeWithMapbox(addressStr);
    const h3r8 = latLngToCell(lat, lng, 8);

    const db = getFirestore();
    await db.doc(`profiles/${uid}`).set({
      address: {
        line1: String(line1 || "").trim(),
        line2: String(line2 || "").trim(),
        city: String(city || "").trim(),
        state: st,
        zip: z5,
      },
      geo: {
        lat, lng, h3r8,
        source: "mapbox",
        updatedAt: new Date(),
      },
      updatedAt: new Date(),
    }, { merge: true });

    return { ok: true, h3r8, lat, lng };
  }
);
