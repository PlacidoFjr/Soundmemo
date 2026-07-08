const fs = require("node:fs/promises");
const path = require("node:path");

const config = {
  apiKey: process.env.SOUNDMEMO_FIREBASE_API_KEY,
  authDomain: process.env.SOUNDMEMO_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.SOUNDMEMO_FIREBASE_PROJECT_ID,
  storageBucket: process.env.SOUNDMEMO_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.SOUNDMEMO_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.SOUNDMEMO_FIREBASE_APP_ID,
};

const missing = Object.entries(config)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missing.length) {
  console.warn(`Firebase config incompleta. Variaveis ausentes: ${missing.join(", ")}`);
}

const safeConfig = missing.length ? {} : config;
const content = `window.SOUNDMEMO_FIREBASE_CONFIG = ${JSON.stringify(safeConfig, null, 2)};\n`;
const target = path.join(__dirname, "..", "firebase-config.js");

fs.writeFile(target, content, "utf8");
