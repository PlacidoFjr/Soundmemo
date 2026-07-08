import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = window.SOUNDMEMO_FIREBASE_CONFIG;

if (!firebaseConfig?.apiKey || !firebaseConfig?.projectId || !firebaseConfig?.appId) {
  document.body.classList.remove("auth-loading");
  document.body.classList.add("auth-locked");
  document.querySelector("#auth-message").textContent =
    "Configuração do Firebase ausente. Gere o arquivo firebase-config.js antes de publicar.";
  throw new Error("Missing Firebase config.");
}

const ALLOWED_EMAILS = [
  "placidojunior34@gmail.com",
  "pinheirosophia63@gmail.com",
];

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const tracksCollection = collection(db, "tracks");

const form = document.querySelector("#music-form");
const contributorInput = document.querySelector("#music-contributor");
const urlInput = document.querySelector("#music-url");
const titleInput = document.querySelector("#music-title");
const artistInput = document.querySelector("#music-artist");
const memoryInput = document.querySelector("#music-memory");
const feelingInput = document.querySelector("#music-feeling");
const eraInput = document.querySelector("#music-era");
const previewButton = document.querySelector("#preview-button");
const previewBox = document.querySelector("#detected-preview");
const statusText = document.querySelector("#form-status");
const debugStatus = document.querySelector("#debug-status");
const grid = document.querySelector("#playlist-grid");
const clearButton = document.querySelector("#clear-button");
const template = document.querySelector("#track-template");
const trackCount = document.querySelector("#track-count");
const spotifyCount = document.querySelector("#spotify-count");
const youtubeCount = document.querySelector("#youtube-count");
const memoryCount = document.querySelector("#memory-count");
const featureCover = document.querySelector("#feature-cover");
const featureTitle = document.querySelector("#feature-title");
const featureSubtitle = document.querySelector("#feature-subtitle");
const timelineList = document.querySelector("#timeline-list");
const finalPlaylist = document.querySelector("#final-playlist");
const copyPlaylistButton = document.querySelector("#copy-playlist-button");
const downloadPlaylistButton = document.querySelector("#download-playlist-button");
const playlistNameInput = document.querySelector("#playlist-name");
const generatePlaylistButton = document.querySelector("#generate-playlist-button");
const generatedPlaylist = document.querySelector("#generated-playlist");
const generatedCover = document.querySelector("#generated-cover");
const generatedTitle = document.querySelector("#generated-title");
const generatedSubtitle = document.querySelector("#generated-subtitle");
const copyGeneratedButton = document.querySelector("#copy-generated-button");
const navLinks = document.querySelectorAll(".site-nav a");
const authForm = document.querySelector("#auth-form");
const authEmailInput = document.querySelector("#auth-email");
const authPasswordInput = document.querySelector("#auth-password");
const passwordToggle = document.querySelector("#password-toggle");
const loginButton = document.querySelector("#login-button");
const logoutButton = document.querySelector("#logout-button");
const userChip = document.querySelector("#user-chip");
const authMessage = document.querySelector("#auth-message");

let tracks = [];
let currentUser = null;
let unsubscribeTracks = null;
let hasGeneratedPlaylist = false;

setFormEnabled(false);
renderTracks();

onAuthStateChanged(auth, (user) => {
  if (!user) {
    currentUser = null;
    unsubscribeFromTracks();
    tracks = [];
    renderTracks();
    setLockedState("Use o e-mail e a senha cadastrados no Firebase.");
    return;
  }

  if (!isAllowedUser(user)) {
    currentUser = null;
    unsubscribeFromTracks();
    tracks = [];
    renderTracks();
    setLockedState(`O e-mail ${user.email} ainda não tem acesso ao SoundMemo.`);
    logoutButton.hidden = false;
    return;
  }

  currentUser = user;
  setUnlockedState(user);
  refreshTracksFromServer().catch((error) => {
    setStatus(getFirestoreErrorMessage(error));
  });
  subscribeToTracks();
});

navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    navLinks.forEach((item) => item.classList.remove("active"));
    link.classList.add("active");
  });
});

loginButton.addEventListener("click", () => {
  authEmailInput.focus();
});
authForm.addEventListener("submit", loginWithEmail);
passwordToggle.addEventListener("click", togglePasswordVisibility);
logoutButton.addEventListener("click", async () => {
  await signOut(auth);
});

previewButton.addEventListener("click", async () => {
  const url = urlInput.value.trim();
  if (!url) {
    setStatus("Cole um link primeiro.");
    return;
  }

  try {
    setStatus("Buscando dados da música...");
    const track = await buildTrackFromUrl(url);
    titleInput.value = titleInput.value || track.title;
    artistInput.value = artistInput.value || track.artist;
    previewBox.hidden = false;
    previewBox.innerHTML = track.embedHtml;
    setStatus(`Link reconhecido como ${track.platformLabel}.`);
  } catch (error) {
    setStatus(error.message);
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentUser) {
    setStatus("Entre com sua conta antes de adicionar músicas.");
    return;
  }

  try {
    setStatus("Salvando no Firestore...");
    const importedTrack = await buildTrackFromUrl(urlInput.value.trim());
    const savedTrackId = await createTrack({
      ...importedTrack,
      title: titleInput.value.trim(),
      artist: artistInput.value.trim(),
      memory: memoryInput.value.trim(),
      feeling: feelingInput.value,
      era: eraInput.value,
    });

    form.reset();
    contributorInput.value = getUserLabel(currentUser);
    previewBox.hidden = true;
    previewBox.innerHTML = "";
    await refreshTracksFromServer(savedTrackId);
    setStatus(`Música salva no Firestore. ID: ${savedTrackId}`);
  } catch (error) {
    setStatus(getFirestoreErrorMessage(error));
  }
});

clearButton.addEventListener("click", async () => {
  if (!tracks.length) return;

  try {
    await clearTracks();
    setStatus("Biblioteca limpa.");
  } catch (error) {
    setStatus(error.message);
  }
});

grid.addEventListener("click", async (event) => {
  const removeButton = event.target.closest("[data-remove-id]");
  if (!removeButton) return;

  try {
    await deleteTrack(removeButton.dataset.removeId);
    setStatus("Música removida.");
  } catch (error) {
    setStatus(error.message);
  }
});

copyPlaylistButton.addEventListener("click", async () => {
  await copyText(buildPlaylistText());
  setStatus("Playlist final copiada.");
});

generatePlaylistButton.addEventListener("click", () => {
  if (!tracks.length) {
    setStatus("Adicione músicas antes de gerar a playlist.");
    return;
  }

  hasGeneratedPlaylist = true;
  renderGeneratedPlaylist();
  generatedPlaylist.scrollIntoView({ behavior: "smooth", block: "center" });
  setStatus("Playlist final gerada.");
});

copyGeneratedButton.addEventListener("click", async () => {
  await copyText(buildPlaylistText());
  setStatus("Playlist gerada copiada.");
});

downloadPlaylistButton.addEventListener("click", () => {
  const blob = new Blob([buildPlaylistText()], { type: "text/plain;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "playlist-final-soundmemo.txt";
  link.click();
  URL.revokeObjectURL(link.href);
  setStatus("Arquivo da playlist final gerado.");
});

async function loginWithEmail(event) {
  event.preventDefault();

  try {
    const email = authEmailInput.value.trim();
    const password = authPasswordInput.value;

    authMessage.textContent = "Entrando...";
    await signInWithEmailAndPassword(auth, email, password);
    authPasswordInput.value = "";
  } catch (error) {
    setLockedState(getEmailAuthErrorMessage(error));
  }
}

function togglePasswordVisibility() {
  const shouldShow = authPasswordInput.type === "password";
  authPasswordInput.type = shouldShow ? "text" : "password";
  passwordToggle.setAttribute("aria-label", shouldShow ? "Ocultar senha" : "Mostrar senha");
}

function getEmailAuthErrorMessage(error) {
  if (error?.code === "auth/operation-not-allowed") {
    return "Ative o login por e-mail e senha no Firebase Authentication.";
  }

  if (
    error?.code === "auth/invalid-credential" ||
    error?.code === "auth/user-not-found" ||
    error?.code === "auth/wrong-password"
  ) {
    return "E-mail ou senha incorretos. Confira se o usuário foi criado com E-mail/senha no Firebase.";
  }

  if (error?.code === "auth/too-many-requests") {
    return "Muitas tentativas. Espere um pouco e tente novamente.";
  }

  if (error?.code === "auth/api-key-not-valid") {
    return "A API key do Firebase na Vercel não é válida para este projeto.";
  }

  return error?.code ? `Firebase: ${error.code}.` : "Não consegui entrar com esse e-mail.";
}

function getFirestoreErrorMessage(error) {
  if (error?.code === "permission-denied") {
    return "Firestore recusou o salvamento. Confira se as regras foram publicadas e se este e-mail esta liberado.";
  }

  if (error?.code === "unavailable") {
    return "Firestore indisponivel agora. Tente novamente em alguns segundos.";
  }

  return error?.code ? `Firestore: ${error.code} - ${error.message}` : error.message;
}

function subscribeToTracks() {
  unsubscribeFromTracks();

  unsubscribeTracks = onSnapshot(
    tracksCollection,
    (snapshot) => {
      tracks = sortTracks(snapshot.docs.map((item) => normalizeFirebaseTrack(item)));
      renderTracks();
      setDebugStatus(`Projeto ${firebaseConfig.projectId} - realtime com ${tracks.length} faixa(s).`);
    },
    (error) => {
      setDebugStatus(`Projeto ${firebaseConfig.projectId} - erro no realtime: ${error.code || "desconhecido"}.`);
      setStatus(getFirestoreErrorMessage(error));
    }
  );
}

function unsubscribeFromTracks() {
  if (unsubscribeTracks) {
    unsubscribeTracks();
    unsubscribeTracks = null;
  }
}

async function createTrack(track) {
  const userName = getUserLabel(currentUser);

  const savedDoc = await addDoc(tracksCollection, {
    platform: track.platform,
    platformLabel: track.platformLabel,
    url: track.url,
    title: track.title,
    artist: track.artist,
    coverUrl: track.coverUrl || "",
    embedHtml: track.embedHtml,
    memory: track.memory,
    feeling: track.feeling,
    era: track.era,
    contributor: userName,
    userId: currentUser.uid,
    userName,
    userEmail: currentUser.email,
    createdAt: serverTimestamp(),
    createdAtClient: new Date().toISOString(),
  });

  const confirmedDoc = await getDocFromServer(savedDoc);
  if (!confirmedDoc.exists()) {
    throw new Error("A musica foi enviada, mas nao apareceu no Firestore.");
  }

  return savedDoc.id;
}

async function refreshTracksFromServer(expectedTrackId) {
  const snapshot = await getDocsFromServer(tracksCollection);
  const serverTracks = sortTracks(snapshot.docs.map((item) => normalizeFirebaseTrack(item)));
  tracks = serverTracks;
  renderTracks();

  setDebugStatus(`Projeto ${firebaseConfig.projectId} - servidor devolveu ${serverTracks.length} faixa(s).`);

  if (expectedTrackId && !serverTracks.some((track) => track.id === expectedTrackId)) {
    throw new Error(
      `O Firestore confirmou o documento ${expectedTrackId}, mas a leitura do servidor não trouxe essa faixa no projeto ${firebaseConfig.projectId}.`
    );
  }

  return serverTracks;
}

async function deleteTrack(id) {
  await deleteDoc(doc(db, "tracks", id));
}

async function clearTracks() {
  const snapshot = await getDocs(tracksCollection);
  const batch = writeBatch(db);

  snapshot.forEach((item) => {
    batch.delete(item.ref);
  });

  await batch.commit();
}

async function buildTrackFromUrl(rawUrl) {
  let parsedUrl;

  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    throw new Error("Esse link não parece válido.");
  }

  if (isSpotifyUrl(parsedUrl)) {
    return importTrack(rawUrl, () => buildSpotifyTrack(parsedUrl));
  }

  if (isYouTubeUrl(parsedUrl)) {
    return importTrack(rawUrl, () => buildYouTubeTrack(parsedUrl));
  }

  throw new Error("Use um link do Spotify ou YouTube.");
}

async function importTrack(url, fallbackBuilder) {
  try {
    const response = await fetch("/api/import-music", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ url }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Não consegui importar esse link.");
    }

    return data;
  } catch {
    return fallbackBuilder();
  }
}

async function buildSpotifyTrack(url) {
  const embedUrl = toSpotifyEmbedUrl(url);
  let title = "Música do Spotify";
  let artist = "Spotify";
  let coverUrl = "";

  try {
    const response = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url.href)}`);
    if (response.ok) {
      const data = await response.json();
      const parts = splitSpotifyTitle(data.title);
      title = parts.title || title;
      artist = parts.artist || artist;
      coverUrl = data.thumbnail_url || "";
    }
  } catch {
    // The iframe still works if oEmbed is blocked by the browser or network.
  }

  return {
    platform: "spotify",
    platformLabel: "Spotify",
    url: url.href,
    title,
    artist,
    coverUrl,
    embedHtml: `<iframe src="${embedUrl}" height="152" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`,
  };
}

function buildYouTubeTrack(url) {
  const videoId = getYouTubeId(url);

  if (!videoId) {
    throw new Error("Não consegui encontrar o ID desse vídeo do YouTube.");
  }

  return {
    platform: "youtube",
    platformLabel: "YouTube",
    url: url.href,
    title: "Vídeo do YouTube",
    artist: "YouTube",
    coverUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    embedHtml: `<iframe src="https://www.youtube.com/embed/${videoId}" height="240" title="YouTube video player" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe>`,
  };
}

function isSpotifyUrl(url) {
  return url.hostname === "open.spotify.com" || url.hostname === "spotify.link";
}

function isYouTubeUrl(url) {
  return url.hostname.includes("youtube.com") || url.hostname === "youtu.be";
}

function toSpotifyEmbedUrl(url) {
  if (url.hostname === "spotify.link") {
    return `https://open.spotify.com/embed?uri=${encodeURIComponent(url.href)}`;
  }

  const cleanPath = url.pathname.replace(/^\/intl-[a-z]{2}\//, "/").replace(/^\/+/, "");
  return `https://open.spotify.com/embed/${cleanPath}`;
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

function renderTracks() {
  grid.innerHTML = "";
  timelineList.innerHTML = "";
  finalPlaylist.innerHTML = "";
  updateDashboard();
  renderGeneratedPlaylist();

  if (!tracks.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Sua biblioteca ainda está vazia. Importe uma faixa para criar a primeira memória musical.";
    grid.append(empty);

    const finalEmpty = document.createElement("div");
    finalEmpty.className = "empty-state";
    finalEmpty.textContent = "A playlist final aparece aqui quando a biblioteca tiver músicas.";
    finalPlaylist.append(finalEmpty);

    const timelineEmpty = document.createElement("div");
    timelineEmpty.className = "empty-state";
    timelineEmpty.textContent = "A linha do tempo vai mostrar quem adicionou cada música e quando.";
    timelineList.append(timelineEmpty);
    return;
  }

  tracks.forEach((track, index) => {
    grid.append(createTrackCard(track));
    timelineList.append(createTimelineItem(track, index));
    finalPlaylist.append(createFinalItem(track, index));
  });
}

function createTrackCard(track) {
  const item = template.content.firstElementChild.cloneNode(true);
  const cover = item.querySelector(".track-cover");

  if (track.coverUrl) {
    cover.style.backgroundImage = `linear-gradient(180deg, rgba(0, 0, 0, 0) 25%, rgba(0, 0, 0, 0.72) 100%), url("${track.coverUrl}")`;
  }

  item.querySelector(".embed-frame").innerHTML = track.embedHtml;
  item.querySelector(".platform-pill").textContent = track.platformLabel;
  item.querySelector(".feeling-tag").textContent = track.feeling;
  item.querySelector(".era-tag").textContent = track.era;
  item.querySelector("h3").textContent = track.title;
  item.querySelector(".artist").textContent = track.artist;
  item.querySelector(".contributor").textContent = `adicionada por ${track.contributor || "Anônimo"}`;
  item.querySelector(".memory").textContent = track.memory;
  item.querySelector("a").href = track.url;
  item.querySelector("button").dataset.removeId = track.id;

  return item;
}

function createTimelineItem(track, index) {
  const item = document.createElement("article");
  item.className = "timeline-item";

  const marker = document.createElement("span");
  marker.className = "timeline-marker";
  marker.textContent = String(index + 1).padStart(2, "0");

  const card = document.createElement("div");
  card.className = "timeline-card";

  const topline = document.createElement("div");
  topline.className = "timeline-topline";

  const person = document.createElement("span");
  person.className = "timeline-person";
  person.textContent = `${track.contributor || "Anônimo"} adicionou`;

  const date = document.createElement("time");
  date.className = "timeline-date";
  date.dateTime = getIsoDate(track.createdAt);
  date.textContent = formatTrackDate(track.createdAt);

  const title = document.createElement("h3");
  title.textContent = track.title;

  const artist = document.createElement("p");
  artist.className = "timeline-artist";
  artist.textContent = track.artist;

  const memory = document.createElement("p");
  memory.className = "timeline-memory";
  memory.textContent = track.memory;

  const tags = document.createElement("div");
  tags.className = "timeline-tags";

  const platform = document.createElement("span");
  platform.className = "tag";
  platform.textContent = track.platformLabel;

  const feeling = document.createElement("span");
  feeling.className = "tag";
  feeling.textContent = track.feeling;

  const era = document.createElement("span");
  era.className = "tag";
  era.textContent = track.era;

  tags.append(platform, feeling, era);
  topline.append(person, date);
  card.append(topline, title, artist, memory, tags);
  item.append(marker, card);

  return item;
}

function createFinalItem(track, index) {
  const item = document.createElement("article");
  item.className = "final-item";

  const number = document.createElement("span");
  number.className = "final-number";
  number.textContent = String(index + 1).padStart(2, "0");

  const info = document.createElement("div");
  info.className = "final-info";

  const title = document.createElement("strong");
  title.textContent = track.title;

  const detail = document.createElement("span");
  detail.textContent = `${track.artist} - ${track.platformLabel} - ${track.contributor || "Anônimo"}`;

  const link = document.createElement("a");
  link.href = track.url;
  link.target = "_blank";
  link.rel = "noreferrer noopener";
  link.textContent = "Abrir";

  info.append(title, detail);
  item.append(number, info, link);

  return item;
}

function updateDashboard() {
  const spotifyTotal = tracks.filter((track) => track.platform === "spotify").length;
  const youtubeTotal = tracks.filter((track) => track.platform === "youtube").length;
  const latestTrack = tracks[0];

  trackCount.textContent = tracks.length;
  spotifyCount.textContent = spotifyTotal;
  youtubeCount.textContent = youtubeTotal;
  memoryCount.textContent = tracks.length;

  featureCover.classList.toggle("has-image", Boolean(latestTrack?.coverUrl));
  featureCover.style.backgroundImage = latestTrack?.coverUrl
    ? `linear-gradient(180deg, rgba(18, 18, 18, 0) 25%, rgba(18, 18, 18, 0.9) 100%), url("${latestTrack.coverUrl}")`
    : "";
  featureTitle.textContent = latestTrack?.title || "Sua trilha ganha forma aqui";
  featureSubtitle.textContent = latestTrack
    ? `${latestTrack.artist} - ${latestTrack.feeling} / ${latestTrack.era} - ${latestTrack.contributor || "Anônimo"}`
    : "Importe uma faixa para ver capa, player e história em destaque.";
}

function renderGeneratedPlaylist() {
  if (!tracks.length || !hasGeneratedPlaylist) {
    generatedPlaylist.hidden = true;
    return;
  }

  const name = playlistNameInput.value.trim() || "Nossa playlist comentada";
  const spotifyTotal = tracks.filter((track) => track.platform === "spotify").length;
  const youtubeTotal = tracks.filter((track) => track.platform === "youtube").length;

  generatedPlaylist.hidden = false;
  generatedTitle.textContent = name;
  generatedSubtitle.textContent = `${tracks.length} músicas criadas em conjunto: ${spotifyTotal} do Spotify e ${youtubeTotal} do YouTube.`;

  generatedCover.innerHTML = "";
  const coverTracks = [...tracks.slice(0, 4)];
  while (coverTracks.length < 4) {
    coverTracks.push({});
  }

  coverTracks.forEach((track) => {
    const tile = document.createElement("span");
    tile.className = "generated-cover-tile";

    if (track.coverUrl) {
      tile.style.backgroundImage = `linear-gradient(180deg, rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.45)), url("${track.coverUrl}")`;
    }

    generatedCover.append(tile);
  });
}

function normalizeFirebaseTrack(item) {
  const data = item.data();
  return {
    id: item.id,
    platform: data.platform || "spotify",
    platformLabel: data.platformLabel || "Spotify",
    url: data.url || "",
    title: data.title || "Música",
    artist: data.artist || "Artista",
    coverUrl: data.coverUrl || "",
    embedHtml: data.embedHtml || "",
    memory: data.memory || "",
    feeling: data.feeling || "",
    era: data.era || "",
    contributor: data.contributor || data.userName || data.userEmail || "Anônimo",
    userEmail: data.userEmail || "",
    userName: data.userName || "",
    createdAt: data.createdAt || data.createdAtClient || null,
  };
}

function sortTracks(items) {
  return [...items].sort((left, right) => {
    const leftDate = toDate(left.createdAt)?.getTime() || 0;
    const rightDate = toDate(right.createdAt)?.getTime() || 0;
    return rightDate - leftDate;
  });
}

function setUnlockedState(user) {
  document.body.classList.remove("auth-loading", "auth-locked");
  document.body.classList.add("auth-unlocked");
  setFormEnabled(true);
  setDebugStatus(`Projeto ${firebaseConfig.projectId} - autenticado como ${user.email || "usuario"}.`);

  const label = getUserLabel(user);
  contributorInput.value = label;
  userChip.textContent = getShortUserLabel(user);
  userChip.title = label;
  userChip.setAttribute("aria-label", `Conta conectada: ${label}`);
  userChip.hidden = false;
  loginButton.hidden = true;
  logoutButton.hidden = false;
  clearButton.hidden = false;
}

function setLockedState(message) {
  document.body.classList.remove("auth-loading", "auth-unlocked");
  document.body.classList.add("auth-locked");
  setFormEnabled(false);
  authMessage.textContent = message;
  setDebugStatus(`Projeto ${firebaseConfig.projectId} - aguardando login.`);
  contributorInput.value = "";
  userChip.hidden = true;
  loginButton.hidden = false;
  clearButton.hidden = true;
}

function setFormEnabled(enabled) {
  form.querySelectorAll("input, textarea, select, button").forEach((element) => {
    element.disabled = !enabled;
  });
}

function isAllowedUser(user) {
  return ALLOWED_EMAILS.includes(String(user.email || "").toLowerCase());
}

function getUserLabel(user) {
  return user?.displayName || user?.email || "Usuário";
}

function getShortUserLabel(user) {
  const label = getUserLabel(user);
  if (label.includes("@")) return label.split("@")[0];
  return label.split(/\s+/).filter(Boolean)[0] || label;
}

function buildPlaylistText() {
  if (!tracks.length) return "Playlist final vazia.";

  const name = playlistNameInput.value.trim() || "Nossa playlist comentada";
  const items = tracks
    .map((track, index) => {
      return [
        `${index + 1}. ${track.title} - ${track.artist}`,
        `Plataforma: ${track.platformLabel}`,
        `Adicionada por: ${track.contributor || "Anônimo"}`,
        `Sentimento: ${track.feeling}`,
        `Momento: ${track.era}`,
        `Link: ${track.url}`,
        `Memória: ${track.memory}`,
      ].join("\n");
    })
    .join("\n\n");

  return `${name}\n${"=".repeat(name.length)}\n\n${items}`;
}

function formatTrackDate(value) {
  const date = toDate(value);
  if (!date) return "data não registrada";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getIsoDate(value) {
  const date = toDate(value);
  return date ? date.toISOString() : "";
}

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function setStatus(message) {
  statusText.textContent = message;
}

function setDebugStatus(message) {
  if (!debugStatus) return;
  debugStatus.textContent = message;
}
