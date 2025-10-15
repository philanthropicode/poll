// src/lib/callables.js
import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase"; // ✅ reuse the one you export


// CSV export (no H3 values included server-side)
export const exportPollCsv = httpsCallable(functions, "exportPollCsv");

// Finalize a user's poll submission: stamps location snapshot and sets submitted=true
export const finalizeSubmission = httpsCallable(functions, "finalizeSubmission");

// Admin: trigger an immediate rollup of aggregates for a poll
export const rollupNow = httpsCallable(functions, "rollupNow");

// Save/normalize user address and compute geo.h3 on profile (server-side)
export const saveUserAddress = httpsCallable(functions, "saveUserAddress");


// Callable read API for heatmap aggregates (dev-friendly alternative to HTTP)
export const getH3AggCallable = httpsCallable(functions, "getH3AggCallable");

// Admin: one-off migration to convert legacy geo.h3r8 to geo.h3={id,res:8}
export const migrateProfileH3r8 = httpsCallable(functions, "migrateProfileH3r8");