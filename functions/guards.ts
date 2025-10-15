// functions/src/guards.ts
// Minimal data guards for submissions

import { HttpsError } from 'firebase-functions/v2/https';

export function validateSubmission(doc: any) {
  if (!doc || typeof doc !== 'object') throw new HttpsError('invalid-argument', 'Invalid submission');
  if (!('submitted' in doc)) throw new HttpsError('invalid-argument', 'Missing submitted flag');
  if (doc.submitted) {
    if (!doc.location || !Number.isFinite(doc.location.lat) || !Number.isFinite(doc.location.lng)) {
      throw new HttpsError('invalid-argument', 'Missing/invalid location');
    }
    if (!doc.answers || typeof doc.answers !== 'object') {
      throw new HttpsError('invalid-argument', 'Missing answers');
    }
    for (const [k, v] of Object.entries(doc.answers)) {
      if (!Number.isFinite(v as any)) throw new HttpsError('invalid-argument', `Non-finite answer for ${k}`);
      // Optional range guard (uncomment/adjust):
      // const n = Number(v); if (n < -100 || n > 100) throw new HttpsError('invalid-argument', `Out-of-range for ${k}`);
    }
  }
}