const http = require("node:http");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const PORT = Number(process.env.PLAYLIST_PORT || 4173);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const TRACKS_FILE = path.join(DATA_DIR, "tracks.json");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url, `http://${request.headers.host}`);

    if (request.method === "POST" && requestUrl.pathname === "/api/import-music") {
      await handleImportMusic(request, response);
      return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/api/tracks") {
      sendJson(response, 200, await readTracks());
      return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/api/tracks") {
      await handleCreateTrack(request, response);
      return;
    }

    if (request.method === "DELETE" && requestUrl.pathname === "/api/tracks") {
      await writeTracks([]);
      sendJson(response, 200, []);
      return;
    }

    if (request.method === "DELETE" && requestUrl.pathname.startsWith("/api/tracks/")) {
      await handleDeleteTrack(requestUrl, response);
      return;
    }

    if (request.method === "GET") {
      await serveStatic(requestUrl.pathname, response);
      return;
    }

    sendJson(response, 405, { error: "Metodo nao permitido." });
  } catch (error) {
    sendJson(response, error.statusCode || 500, {
      error: error.statusCode ? error.message : "Erro interno do servidor.",
      detail: error.statusCode ? undefined : error.message,
    });
  }
});

server.listen(PORT, () => {
  console.log(`Playlist comentada: http://localhost:${PORT}/playlist.html`);
});

async function handleImportMusic(request, response) {
  const body = await readJsonBody(request);
  const rawUrl = String(body.url || "").trim();

  if (!rawUrl) {
    sendJson(response, 400, { error: "Envie um link em url." });
    return;
  }

  let url;

  try {
    url = new URL(rawUrl);
  } catch {
    sendJson(response, 400, { error: "Esse link nao parece valido." });
    return;
  }

  if (isSpotifyUrl(url)) {
    sendJson(response, 200, await importSpotify(url));
    return;
  }

  if (isYouTubeUrl(url)) {
    sendJson(response, 200, await importYouTube(url));
    return;
  }

  sendJson(response, 400, { error: "Use um link do Spotify ou YouTube." });
}

async function handleCreateTrack(request, response) {
  const body = await readJsonBody(request);
  const track = normalizeTrack(body);
  const tracks = await readTracks();
  const savedTrack = {
    ...track,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };

  tracks.unshift(savedTrack);
  await writeTracks(tracks);
  sendJson(response, 201, savedTrack);
}

async function handleDeleteTrack(requestUrl, response) {
  const id = decodeURIComponent(requestUrl.pathname.replace("/api/tracks/", ""));
  const tracks = await readTracks();
  const nextTracks = tracks.filter((track) => track.id !== id);

  await writeTracks(nextTracks);
  sendJson(response, 200, nextTracks);
}

async function importSpotify(url) {
  const fallback = {
    platform: "spotify",
    platformLabel: "Spotify",
    url: url.href,
    title: "Musica do Spotify",
    artist: "Spotify",
    coverUrl: "",
    embedHtml: spotifyIframe(url),
  };

  const data = await getOEmbed(`https://open.spotify.com/oembed?url=${encodeURIComponent(url.href)}`);
  if (!data) return fallback;

  const titleParts = splitSpotifyTitle(data.title);
  const resolvedArtist = String(data.author_name || titleParts.artist || fallback.artist).trim();

  return {
    ...fallback,
    title: titleParts.title || fallback.title,
    artist: resolvedArtist || fallback.artist,
    coverUrl: data.thumbnail_url || "",
    embedHtml: data.html || fallback.embedHtml,
  };
}

async function importYouTube(url) {
  const videoId = getYouTubeId(url);

  if (!videoId) {
    throw new ImportError("Nao consegui encontrar o ID desse video do YouTube.", 400);
  }

  const fallback = {
    platform: "youtube",
    platformLabel: "YouTube",
    url: url.href,
    title: "Video do YouTube",
    artist: "YouTube",
    coverUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    embedHtml: youtubeIframe(videoId),
  };

  const data = await getOEmbed(`https://www.youtube.com/oembed?url=${encodeURIComponent(url.href)}&format=json`);
  if (!data) return fallback;

  return {
    ...fallback,
    title: data.title || fallback.title,
    artist: data.author_name || fallback.artist,
    coverUrl: data.thumbnail_url || fallback.coverUrl,
    embedHtml: fallback.embedHtml,
  };
}

async function getOEmbed(endpoint) {
  try {
    const response = await fetch(endpoint, {
      headers: {
        accept: "application/json",
        "user-agent": "playlist-comentada/1.0",
      },
    });

    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function serveStatic(pathname, response) {
  const cleanPath = pathname === "/" ? "/playlist.html" : pathname;
  const decodedPath = decodeURIComponent(cleanPath).replace(/^[/\\]+/, "");
  const requestedPath = path.normalize(path.join(ROOT, decodedPath));

  if (requestedPath !== ROOT && !requestedPath.startsWith(`${ROOT}${path.sep}`)) {
    sendJson(response, 403, { error: "Acesso negado." });
    return;
  }

  try {
    const file = await fs.readFile(requestedPath);
    const ext = path.extname(requestedPath).toLowerCase();
    response.writeHead(200, { "content-type": mimeTypes[ext] || "application/octet-stream" });
    response.end(file);
  } catch {
    sendJson(response, 404, { error: "Arquivo nao encontrado." });
  }
}

async function readTracks() {
  try {
    const raw = await fs.readFile(TRACKS_FILE, "utf8");
    const tracks = JSON.parse(raw);
    return Array.isArray(tracks) ? tracks : [];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function writeTracks(tracks) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(TRACKS_FILE, `${JSON.stringify(tracks, null, 2)}\n`, "utf8");
}

function normalizeTrack(body) {
  const url = parseTrackUrl(body.url);
  const platform = isSpotifyUrl(url) ? "spotify" : "youtube";
  const videoId = platform === "youtube" ? getYouTubeId(url) : "";

  if (platform === "youtube" && !videoId) {
    throw new ImportError("Nao consegui encontrar o ID desse video do YouTube.", 400);
  }

  return {
    platform,
    platformLabel: platform === "spotify" ? "Spotify" : "YouTube",
    url: url.href,
    title: sanitizeText(body.title, platform === "spotify" ? "Musica do Spotify" : "Video do YouTube", 160),
    artist: sanitizeText(body.artist, platform === "spotify" ? "Spotify" : "YouTube", 120),
    coverUrl: sanitizeUrl(body.coverUrl),
    embedHtml: platform === "spotify" ? spotifyIframe(url) : youtubeIframe(videoId),
    memory: sanitizeText(body.memory, "", 1200),
    feeling: sanitizeText(body.feeling, "saudade", 40),
    era: sanitizeText(body.era, "agora", 40),
    contributor: sanitizeText(body.contributor, "Anonimo", 80),
  };
}

function parseTrackUrl(value) {
  const rawUrl = String(value || "").trim();

  if (!rawUrl) {
    throw new ImportError("Envie um link em url.", 400);
  }

  let url;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new ImportError("Esse link nao parece valido.", 400);
  }

  if (!isSpotifyUrl(url) && !isYouTubeUrl(url)) {
    throw new ImportError("Use um link do Spotify ou YouTube.", 400);
  }

  return url;
}

function sanitizeText(value, fallback, maxLength) {
  const text = String(value || "").trim();
  return (text || fallback).slice(0, maxLength);
}

function sanitizeUrl(value) {
  const rawUrl = String(value || "").trim();
  if (!rawUrl) return "";

  try {
    const url = new URL(rawUrl);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function spotifyIframe(url) {
  if (url.hostname === "spotify.link") {
    return `<iframe src="https://open.spotify.com/embed?uri=${encodeURIComponent(url.href)}" height="152" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`;
  }

  const cleanPath = url.pathname.replace(/^\/intl-[a-z]{2}\//, "/").replace(/^\/+/, "");
  return `<iframe src="https://open.spotify.com/embed/${cleanPath}" height="152" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`;
}

function youtubeIframe(videoId) {
  return `<iframe src="https://www.youtube.com/embed/${videoId}" height="240" title="YouTube video player" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe>`;
}

function isSpotifyUrl(url) {
  return url.hostname === "open.spotify.com" || url.hostname === "spotify.link";
}

function isYouTubeUrl(url) {
  return url.hostname.includes("youtube.com") || url.hostname === "youtu.be";
}

function getYouTubeId(url) {
  if (url.hostname === "youtu.be") {
    return url.pathname.split("/").filter(Boolean)[0];
  }

  if (url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/embed/")) {
    return url.pathname.split("/").filter(Boolean)[1];
  }

  return url.searchParams.get("v");
}

function splitSpotifyTitle(value = "") {
  const withoutSuffix = value.replace(/\s*\|\s*Spotify$/i, "").trim();
  const separators = [" - ", " by "];

  for (const separator of separators) {
    if (withoutSuffix.includes(separator)) {
      const [title, ...rest] = withoutSuffix.split(separator);
      return { title: title.trim(), artist: rest.join(separator).trim() };
    }
  }

  return { title: withoutSuffix, artist: "" };
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let raw = "";

    request.on("data", (chunk) => {
      raw += chunk;

      if (raw.length > 64_000) {
        reject(new ImportError("Corpo da requisicao muito grande.", 413));
      }
    });

    request.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new ImportError("JSON invalido.", 400));
      }
    });

    request.on("error", reject);
  });
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

class ImportError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}
