Firestore indexes for polling + heatmap

Overview
This backend uses composite indexes to support:
- Periodic rollups of submissions into H3 aggregates per poll
- Fast filtering/analysis per question within a poll
- Future filtering by userId for server-side stamping during finalization

Composite Indexes
Place the following in firestore.indexes.json (already updated in repo):

{
  "indexes": [
    {
      "collectionGroup": "submissions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "pollId", "order": "ASCENDING" },
        { "fieldPath": "submitted", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "submissions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "pollId", "order": "ASCENDING" },
        { "fieldPath": "questionId", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "submissions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "pollId", "order": "ASCENDING" },
        { "fieldPath": "userId", "order": "ASCENDING" }
      ]
    }
  ],
  "fieldOverrides": [
    { "collectionGroup": "h3Agg_r7", "fieldPath": "stats", "indexes": [], "shouldIndex": false },
    { "collectionGroup": "h3Agg_r8", "fieldPath": "stats", "indexes": [], "shouldIndex": false },
    { "collectionGroup": "h3Agg_r9", "fieldPath": "stats", "indexes": [], "shouldIndex": false }
  ]
}

Why these indexes?
- (pollId, submitted): used by rollupPoll to fetch only finalized submissions:
  db.collection("submissions")
    .where("pollId", "==", pollId)
    .where("submitted", "==", true)

- (pollId, questionId): supports analysis and CSV export by question for a poll

- (pollId, userId): used by finalizeSubmission callable to find a user’s per-question docs for a poll:
  db.collection("submissions")
    .where("pollId", "==", pollId)
    .where("userId", "==", uid)

- fieldOverrides for stats: aggregate docs store a dynamic stats map keyed by questionId. Disabling single-field indexes here reduces storage and write amplification.

How to deploy indexes
- Using Firebase CLI with firestore.indexes.json in repo root:
  1) Preview (optional):
     firebase emulators:start --only firestore

  2) Deploy (indexes only):
     firebase deploy --only firestore:indexes

  3) Or, depending on your CLI version:
     firebase firestore:indexes

- If the CLI asks to create new indexes from a console link, you can either approve there or keep this JSON as the source of truth and deploy.

How indexes are used at runtime
- Rollups (Cloud Functions):
  - scheduledRollup (every 3 hours) and rollupNow (admin) call rollupPoll(pollId).
  - rollupPoll queries finalized submissions via (pollId, submitted) to compute multi-resolution aggregates (r9, r8, r7) under polls/{pollId}/h3Agg_r*.

- Finalization (server-side stamping):
  - finalizeSubmission callable reads submissions for the user and poll via (pollId, userId), stamps location snapshot (city/state/zip + H3 id/res), sets submitted:true, and marks the poll dirty.

- CSV export:
  - exportPollCsv reads submitted==true submissions by poll. (pollId, submitted) supports this query. The function does not export H3 values; optional city/state/zip can be included when requested.

Notes
- Aggregates collections (h3Agg_r7/8/9) are read-only to clients (enforced by rules) and have stats map indexing disabled.
- For very large geographic bounds in the HTTP read API, consider always passing bounds so the function can “documentId() in [...]” batch just the needed H3 cells.
- If you add new query patterns on submissions (e.g., filters by topic), add composite indexes accordingly.
