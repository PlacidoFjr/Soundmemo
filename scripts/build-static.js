const fs = require("node:fs/promises");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");

const firebaseConfig = {
  apiKey: process.env.SOUNDMEMO_FIREBASE_API_KEY,
  authDomain: process.env.SOUNDMEMO_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.SOUNDMEMO_FIREBASE_PROJECT_ID,
  storageBucket: process.env.SOUNDMEMO_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.SOUNDMEMO_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.SOUNDMEMO_FIREBASE_APP_ID,
};

async function build() {
  await fs.rm(DIST, { recursive: true, force: true });
  await fs.mkdir(DIST, { recursive: true });

  await Promise.all(
    ["playlist.html", "playlist.css", "playlist.js"].map((file) =>
      fs.copyFile(path.join(ROOT, file), path.join(DIST, file))
    )
  );

  const missing = Object.entries(firebaseConfig)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length) {
    console.warn(`Firebase config incompleta. Variaveis ausentes: ${missing.join(", ")}`);
  }

  const safeConfig = missing.length ? {} : firebaseConfig;
  const configContent = `window.SOUNDMEMO_FIREBASE_CONFIG = ${JSON.stringify(safeConfig, null, 2)};\n`;
  await fs.writeFile(path.join(DIST, "firebase-config.js"), configContent, "utf8");
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
