// src/lib/callables.js
import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

export const exportPollCsv = httpsCallable(functions, "exportPollCsv");
