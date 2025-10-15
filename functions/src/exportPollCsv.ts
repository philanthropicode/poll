// functions/src/exportPollCsv.ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

admin.initializeApp();

export const exportPollCsv = onCall({ cors: true }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");

  const { pollId, includeComments = false, includeLocation = false } = req.data || {};
  if (!pollId || typeof pollId !== "string") {
    throw new HttpsError("invalid-argument", "pollId is required.");
  }

  const db = admin.firestore();

  // Require that the caller has submitted this poll
  const statusId = `${pollId}__${uid}__status`;
  const statusSnap = await db.doc(`submissions/${statusId}`).get();
  if (!statusSnap.exists) {
    throw new HttpsError("permission-denied", "You must submit the poll to export.");
  }

  // Load poll & questions (ordered)
  const pollSnap = await db.doc(`polls/${pollId}`).get();
  if (!pollSnap.exists) throw new HttpsError("not-found", "Poll not found.");

  const qsSnap = await db.collection(`polls/${pollId}/questions`).get();
  const questions: { id: string; text: string; order: number }[] = [];
  qsSnap.forEach((d) => questions.push({ id: d.id, text: d.get("text") || "", order: d.get("order") || 0 }));
  questions.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const qIndex = new Map(questions.map((q, i) => [q.id, { ...q, index: i + 1 }]));

  // Fetch all submissions for this poll (skip status docs)
  const subsSnap = await db.collection("submissions").where("pollId", "==", pollId).get();

  type Row = {
    respondent: number;
    questionIndex: number;
    questionId: string;
    question: string;
    value: number | "";
    comment?: string;
    city?: string;
    state?: string;
    zip?: string;
  };

  const rows: Row[] = [];
  const respondentIndex = new Map<string, number>();
  let nextResp = 1;

  subsSnap.forEach((d) => {
    const s = d.data() as any;
    if (!s.questionId) return; // ignore status docs
    const q = qIndex.get(s.questionId);
    if (!q) return;

    // Assign anonymous row index per userId (not exported)
    const u: string = s.userId;
    if (!respondentIndex.has(u)) respondentIndex.set(u, nextResp++);

    const r: Row = {
      respondent: respondentIndex.get(u)!,
      questionIndex: q.index,
      questionId: q.id,
      question: q.text,
      value: typeof s.value === "number" ? s.value : "",
    };

    if (includeComments && s.comment) r.comment = s.comment;
    if (includeLocation) {
      if (s.city) r.city = s.city;
      if (s.state) r.state = s.state;
      if (s.zip) r.zip = s.zip;
    }
    rows.push(r);
  });

  // Build CSV (long format)
  const headers = [
    "respondent",
    "questionIndex",
    "questionId",
    "question",
    "value",
    ...(includeComments ? ["comment"] : []),
    ...(includeLocation ? ["city", "state", "zip"] : []),
  ];

  const esc = (v: any) => {
    if (v == null) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const csv = [headers.join(",")].concat(rows.map((r) => headers.map((h) => esc((r as any)[h])).join(","))).join("\n");

  // Return inline if small, otherwise upload to Storage and return a signed URL
  if (csv.length < 8_000_000) {
    return { kind: "inline", filename: `poll-${pollId}-export.csv`, csv };
  } else {
    const bucket = admin.storage().bucket();
    const file = bucket.file(`exports/polls/${pollId}/export-${Date.now()}.csv`);
    await file.save(csv, { contentType: "text/csv", cacheControl: "no-store" });
    const [url] = await file.getSignedUrl({ action: "read", expires: Date.now() + 60 * 60 * 1000 });
    return { kind: "url", url };
  }
});
