console.log("[SpotifyList] app.js v8 geladen");

const CLIENT_ID = "e4ec161f29cd4108ae4726d5faf27ac2";
const REDIRECT_URI = window.location.origin + window.location.pathname;
const SCOPES = "playlist-read-private playlist-read-collaborative";

const $ = id => document.getElementById(id);

async function sha256(plain) {
  const data = new TextEncoder().encode(plain);
  return await crypto.subtle.digest("SHA-256", data);
}

function base64url(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomString(length = 64) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const values = crypto.getRandomValues(new Uint8Array(length));
  return [...values].map(v => chars[v % chars.length]).join("");
}

async function login() {
  const verifier = randomString();
  const challenge = base64url(await sha256(verifier));
  const state = randomString(32);

  localStorage.setItem("spotify_code_verifier", verifier);
  localStorage.setItem("spotify_state", state);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    scope: SCOPES,
    code_challenge_method: "S256",
    code_challenge: challenge,
    redirect_uri: REDIRECT_URI,
    state
  });

  window.location.href = "https://accounts.spotify.com/authorize?" + params;
}

async function exchangeCode(code) {
  const verifier = localStorage.getItem("spotify_code_verifier");

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier
    })
  });

  if (!response.ok) throw new Error("Spotify kon de autorisatiecode niet omzetten.");
  const data = await response.json();

  localStorage.removeItem("spotify_code_verifier");
  localStorage.removeItem("spotify_state");
  saveTokens(data);
  return data.access_token;
}

function saveTokens(data) {
  localStorage.setItem("spotify_access_token", data.access_token);
  if (data.refresh_token) localStorage.setItem("spotify_refresh_token", data.refresh_token);
  localStorage.setItem("spotify_expires_at", String(Date.now() + data.expires_in * 1000));
}

async function getAccessToken() {
  const token = localStorage.getItem("spotify_access_token");
  const expiresAt = Number(localStorage.getItem("spotify_expires_at") || 0);

  if (token && Date.now() < expiresAt - 60000) return token;

  const refreshToken = localStorage.getItem("spotify_refresh_token");
  if (!refreshToken) return null;

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: "refresh_token",
      refresh_token: refreshToken
    })
  });

  if (!response.ok) {
    clearSpotifySession();
    return null;
  }

  const data = await response.json();
  saveTokens(data);
  return data.access_token;
}

async function spotifyFetch(path) {
  const token = await getAccessToken();
  if (!token) throw new Error("Niet verbonden met Spotify.");

  let response = await fetch("https://api.spotify.com/v1/" + path, {
    headers: { Authorization: "Bearer " + token }
  });

  if (response.status === 401) {
    localStorage.removeItem("spotify_access_token");
    const freshToken = await getAccessToken();
    if (!freshToken) throw new Error("Spotify-sessie verlopen.");
    response = await fetch("https://api.spotify.com/v1/" + path, {
      headers: { Authorization: "Bearer " + freshToken }
    });
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error("Spotify API fout (" + response.status + "): " + body);
  }

  return response.json();
}

async function loadPlaylists() {
  const picker = $("playlist-picker");
  const wrap = $("playlist-picker-wrap");

  picker.innerHTML = '<option value="">Playlist kiezen...</option>';

  let url = "me/playlists?limit=50";
  while (url) {
    const data = await spotifyFetch(url);
    for (const playlist of data.items || []) {
      const option = document.createElement("option");
      option.value = playlist.id;
      option.textContent = playlist.name;
      picker.appendChild(option);
    }
    url = data.next ? new URL(data.next).pathname.replace("/v1/", "") + new URL(data.next).search : null;
  }

  wrap.hidden = false;

  const defaultId = localStorage.getItem("spotify_default_playlist");
  if (defaultId && [...picker.options].some(option => option.value === defaultId)) {
    picker.value = defaultId;
    await loadSpotifyPlaylist(defaultId);
    updateDefaultButton();
  }
}

async function loadSpotifyPlaylist(id) {
  console.log("[SpotifyList] Playlist geselecteerd:", id);

  const playlist = await spotifyFetch(
    "playlists/" + encodeURIComponent(id) + "?fields=name,id,external_urls"
  );

  const tracks = [];
  let url = "playlists/" + encodeURIComponent(id) + "/items?limit=50";

  while (url) {
    const data = await spotifyFetch(url);

    for (const item of data.items || []) {
      const track = item.item;
      if (track && track.type === "track") {
        tracks.push(track);
      }
    }

    url = data.next
      ? new URL(data.next).pathname.replace("/v1/", "") + new URL(data.next).search
      : null;
  }

  console.log("[SpotifyList] Tracks geladen:", tracks.length);
  renderTracks(playlist.name, tracks);
}

function renderTracks(name, tracks) {
  $("playlist-title").textContent = name || "Spotify playlist";
  $("playlist-meta").textContent = tracks.length + (tracks.length === 1 ? " nummer" : " nummers");

  $("track-list").innerHTML = tracks.map((track, index) => {
    const artists = (track.artists || []).map(a => a.name).join(", ");
    const url = track.external_urls?.spotify || "";

    return `
      <article class="track" role="link" tabindex="0" data-url="${escapeAttribute(url)}">
        <div class="track-number">${String(index + 1).padStart(2, "0")}</div>
        ${track.album?.images?.length ? `<img class="track-art" src="${escapeAttribute(track.album.images[track.album.images.length - 1].url)}" alt="" loading="lazy">` : `<div class="track-art" aria-hidden="true"></div>`}
        <div>
          <p class="track-title">${escapeHtml(track.name || "")}</p>
          <p class="track-artist">${escapeHtml(artists)}</p>
        </div>
      </article>
    `;
  }).join("");

  document.querySelectorAll("#track-list .track").forEach(track => {
    const openSpotify = () => {
      const url = track.dataset.url;
      if (url) window.open(url, "_blank", "noopener");
    };

    track.addEventListener("click", openSpotify);
    track.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openSpotify();
      }
    });
  });
}

function updateDefaultButton() {
  if (!defaultPlaylistButton) return;
  const id = playlistPicker.value;
  if (!id) {
    defaultPlaylistButton.hidden = true;
    return;
  }
  defaultPlaylistButton.hidden = false;
  const isDefault = localStorage.getItem("spotify_default_playlist") === id;
  defaultPlaylistButton.textContent = isDefault ? "✓ Standaard ingesteld" : "★ Als standaard instellen";
  defaultPlaylistButton.classList.toggle("active", isDefault);
}

function setDefaultPlaylist() {
  const id = playlistPicker.value;
  if (!id) return;
  localStorage.setItem("spotify_default_playlist", id);
  updateDefaultButton();
}

function clearSpotifySession() {
  localStorage.removeItem("spotify_access_token");
  localStorage.removeItem("spotify_refresh_token");
  localStorage.removeItem("spotify_expires_at");
}

function logout() {
  clearSpotifySession();
  $("playlist-picker-wrap").hidden = true;
  $("spotify-logout").hidden = true;
  $("spotify-login").hidden = false;
  $("playlist-title").textContent = "SpotifyList";
  $("playlist-meta").textContent = "Verbind met Spotify om je playlists te laden.";
  $("track-list").innerHTML = "";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

async function initialize() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const returnedState = params.get("state");
  const error = params.get("error");

  if (error) throw new Error("Spotify autorisatie geannuleerd of geweigerd.");

  if (code) {
    const savedState = localStorage.getItem("spotify_state");
    if (!savedState || savedState !== returnedState) {
      throw new Error("Spotify security check mislukt (state mismatch).");
    }
    await exchangeCode(code);
    window.history.replaceState({}, document.title, REDIRECT_URI);
  }

  const token = await getAccessToken();
  if (!token) return;

  $("spotify-login").hidden = true;
  $("spotify-logout").hidden = false;
  await loadPlaylists();
}

const loginButton = $("spotify-login");
const logoutButton = $("spotify-logout");
const playlistPicker = $("playlist-picker");
const defaultPlaylistButton = $("set-default-playlist");

if (!loginButton || !logoutButton || !playlistPicker) {
  console.error("[SpotifyList] UI-element ontbreekt. Controleer index.html.");
  showError(new Error("SpotifyList kan de interface niet initialiseren. Vernieuw de pagina met Ctrl+F5."));
} else {
  console.log("[SpotifyList] UI geïnitialiseerd");
  loginButton.addEventListener("click", () => {
    console.log("[SpotifyList] Verbinden met Spotify geklikt");
    login().catch(showError);
  });
  logoutButton.addEventListener("click", logout);
  playlistPicker.addEventListener("change", event => {
    updateDefaultButton();
    if (event.target.value) loadSpotifyPlaylist(event.target.value).catch(showError);
  });
  defaultPlaylistButton?.addEventListener("click", setDefaultPlaylist);
}
function showError(err) {
  const error = $("error");
  error.hidden = false;
  error.textContent = err.message || String(err);
}

initialize().catch(showError);