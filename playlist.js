const STORAGE_KEY = "commented-playlist-tracks";

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

let tracks = [];
let hasGeneratedPlaylist = false;

init();

navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    navLinks.forEach((item) => item.classList.remove("active"));
    link.classList.add("active");
  });
});

previewButton.addEventListener("click", async () => {
  const url = urlInput.value.trim();
  if (!url) {
    setStatus("Cole um link primeiro.");
    return;
  }

  try {
    setStatus("Buscando dados da musica...");
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

  try {
    setStatus("Salvando na biblioteca...");
    const importedTrack = await buildTrackFromUrl(urlInput.value.trim());
    const contributor = contributorInput.value.trim();
    const track = await createTrack({
      ...importedTrack,
      title: titleInput.value.trim(),
      artist: artistInput.value.trim(),
      memory: memoryInput.value.trim(),
      feeling: feelingInput.value,
      era: eraInput.value,
      contributor,
    });

    tracks = [track, ...tracks];
    renderTracks();
    form.reset();
    contributorInput.value = contributor;
    previewBox.hidden = true;
    previewBox.innerHTML = "";
    setStatus("Musica adicionada na biblioteca.");
  } catch (error) {
    setStatus(error.message);
  }
});

clearButton.addEventListener("click", async () => {
  if (!tracks.length) return;

  try {
    tracks = await clearTracks();
    renderTracks();
    setStatus("Biblioteca limpa.");
  } catch (error) {
    setStatus(error.message);
  }
});

grid.addEventListener("click", async (event) => {
  const removeButton = event.target.closest("[data-remove-id]");
  if (!removeButton) return;

  try {
    tracks = await deleteTrack(removeButton.dataset.removeId);
    renderTracks();
    setStatus("Musica removida.");
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
    setStatus("Adicione musicas antes de gerar a playlist.");
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

async function init() {
  try {
    tracks = await fetchTracks();
  } catch {
    tracks = loadLocalTracks();
    setStatus("Modo local ativo: o backend nao respondeu.");
  }

  renderTracks();
}

async function buildTrackFromUrl(rawUrl) {
  let parsedUrl;

  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    throw new Error("Esse link nao parece valido.");
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
      throw new Error(data.error || "Nao consegui importar esse link.");
    }

    return data;
  } catch (error) {
    if (location.protocol !== "file:") {
      throw error;
    }

    return fallbackBuilder();
  }
}

async function fetchTracks() {
  const response = await fetch("/api/tracks");
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Nao consegui carregar a biblioteca.");
  }

  return data;
}

async function createTrack(track) {
  const response = await fetch("/api/tracks", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(track),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Nao consegui salvar essa musica.");
  }

  return data;
}

async function deleteTrack(id) {
  const response = await fetch(`/api/tracks/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Nao consegui remover essa musica.");
  }

  return data;
}

async function clearTracks() {
  const response = await fetch("/api/tracks", {
    method: "DELETE",
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Nao consegui limpar a biblioteca.");
  }

  return data;
}

async function buildSpotifyTrack(url) {
  const embedUrl = toSpotifyEmbedUrl(url);
  let title = "Musica do Spotify";
  let artist = "Spotify";

  try {
    const response = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url.href)}`);
    if (response.ok) {
      const data = await response.json();
      const parts = splitSpotifyTitle(data.title);
      title = parts.title || title;
      artist = parts.artist || artist;
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
    coverUrl: "",
    embedHtml: `<iframe src="${embedUrl}" height="152" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`,
  };
}

function buildYouTubeTrack(url) {
  const videoId = getYouTubeId(url);

  if (!videoId) {
    throw new Error("Nao consegui encontrar o ID desse video do YouTube.");
  }

  return {
    platform: "youtube",
    platformLabel: "YouTube",
    url: url.href,
    title: "Video do YouTube",
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
    empty.textContent = "Sua biblioteca ainda esta vazia. Importe uma faixa para criar a primeira memoria musical.";
    grid.append(empty);

    const finalEmpty = document.createElement("div");
    finalEmpty.className = "empty-state";
    finalEmpty.textContent = "A playlist final aparece aqui quando a biblioteca tiver musicas.";
    finalPlaylist.append(finalEmpty);

    const timelineEmpty = document.createElement("div");
    timelineEmpty.className = "empty-state";
    timelineEmpty.textContent = "A linha do tempo vai mostrar quem adicionou cada musica e quando.";
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
  item.querySelector(".contributor").textContent = `adicionada por ${track.contributor || "Anonimo"}`;
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
  person.textContent = `${track.contributor || "Anonimo"} adicionou`;

  const date = document.createElement("time");
  date.className = "timeline-date";
  date.dateTime = track.createdAt || "";
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

function formatTrackDate(value) {
  if (!value) return "data nao registrada";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "data nao registrada";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
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
  detail.textContent = `${track.artist} - ${track.platformLabel} - ${track.contributor || "Anonimo"}`;

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
    ? `${latestTrack.artist} - ${latestTrack.feeling} / ${latestTrack.era} - ${latestTrack.contributor || "Anonimo"}`
    : "Importe uma faixa para ver capa, player e historia em destaque.";
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
  generatedSubtitle.textContent = `${tracks.length} musicas criadas em conjunto: ${spotifyTotal} do Spotify e ${youtubeTotal} do YouTube.`;

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

function buildPlaylistText() {
  if (!tracks.length) return "Playlist final vazia.";

  const name = playlistNameInput.value.trim() || "Nossa playlist comentada";
  const items = tracks
    .map((track, index) => {
      return [
        `${index + 1}. ${track.title} - ${track.artist}`,
        `Plataforma: ${track.platformLabel}`,
        `Adicionada por: ${track.contributor || "Anonimo"}`,
        `Sentimento: ${track.feeling}`,
        `Fase: ${track.era}`,
        `Link: ${track.url}`,
        `Memoria: ${track.memory}`,
      ].join("\n");
    })
    .join("\n\n");

  return `${name}\n${"=".repeat(name.length)}\n\n${items}`;
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

function loadLocalTracks() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function setStatus(message) {
  statusText.textContent = message;
}
