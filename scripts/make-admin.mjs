// scripts/make-admin.mjs
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import fs from "node:fs";

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || "./serviceAccount.json";
if (!fs.existsSync(keyPath)) throw new Error(`Missing key at ${keyPath}`);

initializeApp({ credential: cert(keyPath) });

const ident = process.argv[2];
const flag = (process.argv[3] ?? "true").toLowerCase() === "true";

const auth = getAuth();
const user = ident.includes("@") ? await auth.getUserByEmail(ident) : await auth.getUser(ident);
const claims = { ...(user.customClaims || {}), admin: flag };
if (!flag) delete claims.admin;

await auth.setCustomUserClaims(user.uid, claims);
console.log(`Set admin=${flag} for uid=${user.uid}. Ask them to sign out/in.`);
