import { onCall } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

initializeApp(); // no args needed if default project

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
