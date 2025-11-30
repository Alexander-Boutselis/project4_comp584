/******************************************************
 *  CONFIGURATION SECTION
 *  - Set Spotify Client ID and Redirect URI
 ******************************************************/
const clientId = '059f04030bd14dfd9c5bcf508a373266';
const redirectUri = 'https://alexander-boutselis.github.io/project4_comp584/';
const scopes = 'user-read-email user-read-private'; //Scopes = permissions you want from the user

const authEndpoint = 'https://accounts.spotify.com/authorize';
const tokenEndpoint = 'https://accounts.spotify.com/api/token';

const loginBtn   = document.getElementById('login-btn');
const logoutBtn  = document.getElementById('logout-btn');
const profileBtn = document.getElementById('profile-btn');
const output     = document.getElementById('output');

//Debug toggle for results section
const toggleResultsBtn = document.getElementById('toggle-results-btn');
const resultsSection   = document.querySelector('.result-section'); // NOTE: singular!

//Search Section elements
const searchAreas = document.getElementById('search-sections');

//Track search elements
const trackForm       = document.getElementById('track-search-form');
const trackQueryInput = document.getElementById('track-query');
const resultsOutput   = document.getElementById('results-output');

let accessToken = null;
/*****************************************************/


/******************************************************
 *  PKCE HELPER FUNCTIONS
 *  - Generate code_verifier & code_challenge for PKCE
 ******************************************************/
//Generate a random string for PKCE code_verifier
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
// --- Step 1: redirect the user to Spotify login with PKCE parameters ---
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
 *
 *  Call: POST https://accounts.spotify.com/api/token
 ******************************************************/
// --- Step 2: when Spotify redirects back with ?code=..., exchange for tokens ---
async function handleRedirectCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const error = params.get('error');

//If Spotify sent an error (?error=access_denied, etc.)
  if (error) {
    output.textContent = `Error from Spotify: ${error}`;
    return;
  }

  if (!code) return; // normal load, no redirect in progress

//Retrieve the code_verifier we generated before redirect
  const codeVerifier = localStorage.getItem('spotify_code_verifier');
  if (!codeVerifier) {
    output.textContent = 'Missing code_verifier. Try logging in again.';
    return;
  }

//Prepare the POST body for /api/token
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier
  });

// ACTUAL TOKEN REQUEST:
// POST https://accounts.spotify.com/api/token
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

  //Store token so you don't have to log in every refresh
  localStorage.setItem('spotify_access_token', accessToken);

  // Clean the ?code= from the URL bar
  window.history.replaceState({}, document.title, redirectUri);

  updateUI();
  output.textContent = 'Logged in! Click "Get My Profile".';
}
/*****************************************************/


/******************************************************
 *  RESTORING TOKEN (optional convenience)
 *  - If we previously logged in, reload token from storage
 ******************************************************/
// --- Load token from storage if we already logged in earlier ---
function restoreToken() {
  const stored = localStorage.getItem('spotify_access_token');
  if (stored) {
    accessToken = stored;
  }
}

// --- Simple logout ---
function logout() {
  accessToken = null;
  localStorage.removeItem('spotify_access_token');
  output.textContent = '(Not logged in)';
  searchAreas.classList.add('is-hidden');
  updateUI();
}
/*****************************************************/


/******************************************************
 *  fetchMyProfile():
 *    - Called when user clicks "Get My Profile"
 *    - Uses:
 *      GET https://api.spotify.com/v1/me
 *      with Authorization: Bearer <access_token>
 ******************************************************/
//Actual Web API call:
//GET https://api.spotify.com/v1/me
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
 *  TRACK SEARCH HELPERS
 ******************************************************/
function renderTrackResults(data) {
  if (!data.tracks || !data.tracks.items || data.tracks.items.length === 0) {
    resultsOutput.textContent = 'No tracks found for that search.';
    return;
  }

  // Build a simple text list: Track – Artist(s) (Album)
  const lines = data.tracks.items.map(track => {
    const artists = track.artists.map(a => a.name).join(', ');
    return `${track.name} — ${artists} (${track.album.name})`;
  });

  resultsOutput.textContent = lines.join('\n');
}

async function searchTracks(query) {
  if (!accessToken) {
    resultsOutput.textContent = 'Please log in with Spotify first.';
    resultsSection.classList.remove('is-hidden');
    return;
  }

  const encodedQuery = encodeURIComponent(query);
  const url = `https://api.spotify.com/v1/search?type=track&q=${encodedQuery}&limit=10`;

  resultsOutput.textContent = 'Searching tracks...';
  resultsSection.classList.remove('is-hidden');

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!res.ok) {
      resultsOutput.textContent = `Search error: ${res.status} ${res.statusText}`;
      return;
    }

    const data = await res.json();
    renderTrackResults(data);
  } catch (err) {
    resultsOutput.textContent = `Network error: ${err.message}`;
  }
}
/*****************************************************/


/******************************************************
 *  UI HELPERS (updating buttons and output)
 ******************************************************/
function updateUI() {
  const loggedIn = !!accessToken;

  if (loggedIn) {
    searchAreas.classList.remove('is-hidden');
  }else{
  searchAreas.classList.add('is-hidden');
  }

  loginBtn.disabled   = loggedIn;
  logoutBtn.disabled  = !loggedIn;
  profileBtn.disabled = !loggedIn;
}
/*****************************************************/






/******************************************************
 *  APP INIT
 *  - Wires up button click handlers
 *  - Restores token (if any)
 *  - Handles redirect back from Spotify
 ******************************************************/
loginBtn.addEventListener('click', startLogin);
logoutBtn.addEventListener('click', logout);
profileBtn.addEventListener('click', fetchMyProfile);


// Set up debug toggle once
if (toggleResultsBtn && resultsSection) {
  toggleResultsBtn.addEventListener('click', () => {
    resultsSection.classList.toggle('is-hidden');
  });
}

//Track search submit handler
if (trackForm) {
  trackForm.addEventListener('submit', (event) => {
    event.preventDefault(); // stop page reload
    const query = trackQueryInput.value.trim();
    if (!query) return;
    searchTracks(query);
  });
}


restoreToken();
handleRedirectCallback();
updateUI();
/*****************************************************/
