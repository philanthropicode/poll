// functions/src/profile.ts
// Normalize profile storage: geo.h3 = { id, res }

import { onCall } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';

const MAPBOX_TOKEN = defineSecret('MAPBOX_TOKEN');

export const saveUserAddress = onCall({ region: 'us-central1', cors: true, secrets: [MAPBOX_TOKEN] }, async (req) => {
  const uid = req.auth?.uid; if (!uid) throw new HttpsError('unauthenticated', 'Sign in');
  const { line1 = '', line2 = '', city, state, zip } = (req.data || {});
  if (!city || !state || !zip) throw new HttpsError('invalid-argument', 'city/state/zip required');
  // ... geocode (omitted for brevity) -> lat,lng
  const reso = 8; // choose default; later vary by density
  const h3id = geoToH3(lat, lng, reso);
  await db.doc(`profiles/${uid}`).set({
    address: { line1, line2, city, state, zip },
    geo: { lat, lng, h3: { id: h3id, res: reso }, source: 'mapbox', updatedAt: FieldValue.serverTimestamp() },
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  return { ok: true, h3: { id: h3id, res: reso }, lat, lng };
});