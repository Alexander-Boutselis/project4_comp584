/******************************************************
 *  CONFIGURATION SECTION
 *  - Set Spotify Client ID and Redirect URI
 ******************************************************/
const clientId = '059f04030bd14dfd9c5bcf508a373266';
const redirectUri = 'https://alexander-boutselis.github.io/project4_comp584/';
const scopes = 'user-read-email user-read-private'; //Scopes = permissions you want from the user

const authEndpoint = 'https://accounts.spotify.com/authorize';
const tokenEndpoint = 'https://accounts.spotify.com/api/token';

// DOM references
const loginBtn   = document.getElementById('login-btn');
const logoutBtn  = document.getElementById('logout-btn');
const output     = document.getElementById('output');

// Debug toggle for results section
const toggleResultsBtn = document.getElementById('toggle-results-btn');

// Result Area
const resultsContainer = document.getElementById('results-container');
const resultsSection   = document.querySelector('.result-section'); // NOTE: singular!
const resultsStatus    = document.getElementById('results-status');

// Track search elements
const trackForm       = document.getElementById('track-search-form');
const trackQueryInput = document.getElementById('track-query');

// Album search elements
const albumForm       = document.getElementById('album-search-form');
const albumQueryInput = document.getElementById('album-query');

// Playlist search elements
const playlistForm       = document.getElementById('playlist-search-form');
const playlistQueryInput = document.getElementById('playlist-query');

// Player elements (not fully wired yet)
const playerSection  = document.getElementById('player-section');
const playerTitle    = document.getElementById('player-title');
const playerSubtitle = document.getElementById('player-subtitle');
const playerCover    = document.querySelector('.player-cover');
const playerAudio    = document.getElementById('player-audio');
const playerMessage  = document.getElementById('player-message');
const playerOpenLink = document.getElementById('player-open-link');

// Fallback cover image (make sure this exists in /images)
const FALLBACK_IMAGE_URL = 'images/defaultImage.jpg';

// Centralized results object
let currentResults = {
  type: null,   // 'track' | 'album' | 'playlist'
  items: []     // normalized items
};

let accessToken = null;
/*****************************************************/


/******************************************************
 *  PKCE HELPER FUNCTIONS
 *  - Generate code_verifier & code_challenge for PKCE
 ******************************************************/
function generateRandomString(length) {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let text = '';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

// Compute SHA-256 of a string (returns ArrayBuffer)
async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return await crypto.subtle.digest('SHA-256', data);
}

// Convert an ArrayBuffer to base64url string
function base64urlencode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
/*****************************************************/


/******************************************************
 *  LOGIN FLOW – STEP 1
 *  startLogin():
 *    - Called when user clicks "Log in with Spotify"
 *    - Creates code_verifier + code_challenge
 *    - Redirects browser to Spotify /authorize
 ******************************************************/
async function startLogin() {
  const codeVerifier = generateRandomString(128);
  localStorage.setItem('spotify_code_verifier', codeVerifier);

  const codeChallenge = base64urlencode(await sha256(codeVerifier));

  const url = new URL(authEndpoint);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('scope', scopes);

  // Send user to Spotify's authorize page
  window.location.href = url.toString();
}
/*****************************************************/


/******************************************************
 *  LOGIN FLOW – STEP 2
 *  handleRedirectCallback():
 *    - Called when the page loads
 *    - If Spotify redirected back with ?code=...
 *      we exchange that code for an access token
 ******************************************************/
async function handleRedirectCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const error = params.get('error');

  // If Spotify sent an error (?error=access_denied, etc.)
  if (error) {
    output.textContent = `Error from Spotify: ${error}`;
    return;
  }

  if (!code) return; // normal load, no redirect in progress

  // Retrieve the code_verifier we generated before redirect
  const codeVerifier = localStorage.getItem('spotify_code_verifier');
  if (!codeVerifier) {
    output.textContent = 'Missing code_verifier. Try logging in again.';
    return;
  }

  // Prepare the POST body for /api/token
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier
  });

  // Token request
  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });

  if (!response.ok) {
    const errorData = await response.text();
    output.textContent = `Token request failed: ${response.status}\n${errorData}`;
    return;
  }

  const data = await response.json();
  accessToken = data.access_token;

  // Store token so you don't have to log in every refresh
  localStorage.setItem('spotify_access_token', accessToken);

  // Clean the ?code= from the URL bar
  window.history.replaceState({}, document.title, redirectUri);

  updateUI();
  output.textContent = 'Logged in!';
}
/*****************************************************/


/******************************************************
 *  RESTORING TOKEN (optional convenience)
 ******************************************************/
function restoreToken() {
  const stored = localStorage.getItem('spotify_access_token');
  if (stored) {
    accessToken = stored;
  }
}

// Simple logout
function logout() {
  accessToken = null;
  localStorage.removeItem('spotify_access_token');
  output.textContent = '(Not logged in)';
  updateUI();
}
/*****************************************************/


/******************************************************
 *  fetchMyProfile() – not wired to UI, but left here
 ******************************************************/
async function fetchMyProfile() {
  if (!accessToken) {
    output.textContent = 'Not logged in.';
    return;
  }

  const res = await fetch('https://api.spotify.com/v1/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!res.ok) {
    output.textContent = `API error: ${res.status} ${res.statusText}`;
    return;
  }

  const json = await res.json();
  output.textContent = JSON.stringify(json, null, 2);
}
/*****************************************************/


/******************************************************
 *  RESULT STATE + GENERIC RENDERING
 ******************************************************/
function setResults(type, items) {
  currentResults.type  = type;    // 'track' | 'album' | 'playlist'
  currentResults.items = items;
  renderResults();
}

function renderResults() {
  if (!currentResults.items || currentResults.items.length === 0) {
    if (resultsStatus) {
      resultsStatus.textContent = 'No results found.';
    }
    resultsSection.classList.remove('is-hidden');

    // Clear any old tiles if there are no results
    if (resultsContainer) {
      resultsContainer.innerHTML = '';
    }
    return;
  }

  // Simple status line instead of the old text list
  if (resultsStatus) {
    const count = currentResults.items.length;
    const typeLabel = currentResults.type ? `${currentResults.type}s` : 'items';
    resultsStatus.textContent = `Found ${count} ${typeLabel}.`;
  }

  resultsSection.classList.remove('is-hidden');

  // Tiles handle the detailed display
  renderTiles();
  console.log('Current results:', currentResults);
}


function renderTiles() {
  if (!resultsContainer) return;

  // Clear old tiles
  resultsContainer.innerHTML = '';

  currentResults.items.forEach((item, index) => {
    // Outer tile
    const tile = document.createElement('article');
    tile.className = 'result-tile';

    // Left-side index number
    const indexSpan = document.createElement('span');
    indexSpan.className = 'tile-index';
    indexSpan.textContent = `${index + 1}.`;

    // Image box
    const imageDiv = document.createElement('div');
    imageDiv.className = 'tile-image';

    const imgUrl = getImageUrlForItem(item);
    if (imgUrl) {
      imageDiv.style.backgroundImage = `url("${imgUrl}")`;
      imageDiv.style.backgroundSize = 'cover';
      imageDiv.style.backgroundPosition = 'center';
    }

    // Text wrapper
    const textDiv = document.createElement('div');
    textDiv.className = 'tile-text';

    // Title (uses CSS truncation)
    const titleEl = document.createElement('h3');
    titleEl.className = 'result-title';
    titleEl.textContent = item.title;

    // Subtitle (artist/owner + extra info)
    const subtitleEl = document.createElement('p');
    subtitleEl.className = 'result-subtitle';

    const extraText = item.extra ? ` • ${item.extra}` : '';
    subtitleEl.textContent = `${item.subtitle}${extraText}`;

    textDiv.appendChild(titleEl);
    textDiv.appendChild(subtitleEl);

    // Order: number | image | text
    tile.appendChild(indexSpan);
    tile.appendChild(imageDiv);
    tile.appendChild(textDiv);

    // Click target (for now just log)
    tile.addEventListener('click', () => {
      console.log('Clicked item:', item);
    });

    resultsContainer.appendChild(tile);
  });
}


// Helper to pull the best cover image depending on item type
function getImageUrlForItem(item) {
  const raw = item.raw;
  if (!raw) return FALLBACK_IMAGE_URL;

  if (item.type === 'track') {
    // Track cover art is on the album
    return raw.album?.images?.[0]?.url || FALLBACK_IMAGE_URL;
  }

  if (item.type === 'album') {
    return raw.images?.[0]?.url || FALLBACK_IMAGE_URL;
  }

  if (item.type === 'playlist') {
    return raw.images?.[0]?.url || FALLBACK_IMAGE_URL;
  }

  return FALLBACK_IMAGE_URL;
}
/*****************************************************/


/******************************************************
 *  NORMALIZERS – turn raw Spotify JSON into simple objects
 ******************************************************/
function normalizeTrackItems(data) {
  const rawItems = data.tracks?.items;
  if (!Array.isArray(rawItems)) return [];

  return rawItems
    .filter(t => t && typeof t === 'object')
    .map(track => ({
      id: track.id ?? '',
      type: 'track',
      title: track.name ?? '(Untitled track)',
      subtitle: Array.isArray(track.artists)
        ? track.artists.map(a => a.name).filter(Boolean).join(', ')
        : 'Unknown artist',
      extra: track.album?.name || '',
      raw: track          // keep full Spotify object for later
    }));
}

function normalizeAlbumItems(data) {
  const rawItems = data.albums?.items;
  if (!Array.isArray(rawItems)) return [];

  return rawItems
    .filter(album => album && typeof album === 'object')
    .map(album => ({
      id: album.id ?? '',
      type: 'album',
      title: album.name ?? '(Untitled album)',
      subtitle: Array.isArray(album.artists)
        ? album.artists.map(a => a.name).filter(Boolean).join(', ')
        : 'Unknown artist',
      extra: `${album.total_tracks ?? 0} tracks • ${album.release_date ?? 'Unknown date'}`,
      raw: album
    }));
}

function normalizePlaylistItems(data) {
  const rawItems = data.playlists?.items;
  if (!Array.isArray(rawItems)) return [];

  return rawItems
    .filter(pl => pl && typeof pl === 'object')   // drop any null/undefined entries
    .map(pl => ({
      id: pl.id ?? '',
      type: 'playlist',
      title: pl.name ?? '(Untitled playlist)',
      subtitle: pl.owner?.display_name || 'Unknown owner',
      extra: `${pl.tracks?.total ?? 0} tracks`,
      raw: pl
    }));
}
/*****************************************************/


/******************************************************
 *  SEARCH TRACKS TO SPOTIFY
 ******************************************************/
async function searchTracks(query) {
  if (!accessToken) {
    if (resultsStatus) {
      resultsStatus.textContent = 'Please log in with Spotify first.';
    }
    resultsSection.classList.remove('is-hidden');
    return;
  }

  const encodedQuery = encodeURIComponent(query);
  const url = `https://api.spotify.com/v1/search?type=track&q=${encodedQuery}&limit=25`;

  if (resultsStatus) {
    resultsStatus.textContent = 'Searching tracks...';
  }
  resultsSection.classList.remove('is-hidden');

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!res.ok) {
      if (resultsStatus) {
        resultsStatus.textContent = `Track search error: ${res.status} ${res.statusText}`;
      }
      return;
    }

    const data  = await res.json();
    const items = normalizeTrackItems(data);
    setResults('track', items);
  } catch (err) {
    if (resultsStatus) {
      resultsStatus.textContent = `Network error (tracks): ${err.message}`;
    }
  }
}
/*****************************************************/


/******************************************************
 *  SEARCH ALBUMS TO SPOTIFY
 ******************************************************/
async function searchAlbums(query) {
  if (!accessToken) {
    if (resultsStatus) {
      resultsStatus.textContent = 'Please log in with Spotify first.';
    }
    resultsSection.classList.remove('is-hidden');
    return;
  }

  const encodedQuery = encodeURIComponent(query);
  const url = `https://api.spotify.com/v1/search?type=album&q=${encodedQuery}&limit=25`;

  if (resultsStatus) {
    resultsStatus.textContent = 'Searching albums...';
  }
  resultsSection.classList.remove('is-hidden');

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!res.ok) {
      if (resultsStatus) {
        resultsStatus.textContent = `Album search error: ${res.status} ${res.statusText}`;
      }
      return;
    }

    const data  = await res.json();
    const items = normalizeAlbumItems(data);
    setResults('album', items);
  } catch (err) {
    if (resultsStatus) {
      resultsStatus.textContent = `Network error (albums): ${err.message}`;
    }
  }
}
/*****************************************************/


/******************************************************
 *  SEARCH PLAYLISTS TO SPOTIFY
 ******************************************************/
async function searchPlaylists(query) {
  if (!accessToken) {
    if (resultsStatus) {
      resultsStatus.textContent = 'Please log in with Spotify first.';
    }
    resultsSection.classList.remove('is-hidden');
    return;
  }

  const encodedQuery = encodeURIComponent(query);
  const url = `https://api.spotify.com/v1/search?type=playlist&q=${encodedQuery}&limit=25`;

  if (resultsStatus) {
    resultsStatus.textContent = 'Searching playlists...';
  }
  resultsSection.classList.remove('is-hidden');

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!res.ok) {
      if (resultsStatus) {
        resultsStatus.textContent = `Playlist search error: ${res.status} ${res.statusText}`;
      }
      return;
    }

    const data  = await res.json();
    const items = normalizePlaylistItems(data);
    setResults('playlist', items);
  } catch (err) {
    if (resultsStatus) {
      resultsStatus.textContent = `Network error (playlists): ${err.message}`;
    }
  }
}
/*****************************************************/


/******************************************************
 *  UI HELPERS (updating buttons and output)
 ******************************************************/
function updateUI() {
  const loggedIn = !!accessToken;

  loginBtn.disabled   = loggedIn;
  logoutBtn.disabled  = !loggedIn;
}
/*****************************************************/


/******************************************************
 *  APP INIT
 ******************************************************/
loginBtn.addEventListener('click', startLogin);
logoutBtn.addEventListener('click', logout);

// Debug toggle
if (toggleResultsBtn && resultsSection) {
  toggleResultsBtn.addEventListener('click', () => {
    resultsSection.classList.toggle('is-hidden');
  });
}

// Track search submit handler
if (trackForm) {
  trackForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const query = trackQueryInput.value.trim();
    if (!query) return;
    searchTracks(query);
  });
}

// Album search submit handler
if (albumForm) {
  albumForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const query = albumQueryInput.value.trim();
    if (!query) return;
    searchAlbums(query);
  });
}

// Playlist search submit handler
if (playlistForm) {
  playlistForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const query = playlistQueryInput.value.trim();
    if (!query) return;
    searchPlaylists(query);
  });
}

restoreToken();
handleRedirectCallback();
updateUI();
/******************************************************/
