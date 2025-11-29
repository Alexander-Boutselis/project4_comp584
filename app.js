// ======== CONFIG: EDIT THESE ========
const clientId = '059f04030bd14dfd9c5bcf508a373266';
// sudo python3 -m http.server 8080 to host locally until moved to git pages
const redirectUri = 'https://alexander-boutselis.github.io/project4_comp584/'; // or your GitHub Pages URL
const scopes = 'user-read-email user-read-private';
// ====================================

const authEndpoint = 'https://accounts.spotify.com/authorize';
const tokenEndpoint = 'https://accounts.spotify.com/api/token';

const loginBtn   = document.getElementById('login-btn');
const logoutBtn  = document.getElementById('logout-btn');
const profileBtn = document.getElementById('profile-btn');
const output     = document.getElementById('output');

let accessToken = null;

// --- Utility: random string for code_verifier ---
function generateRandomString(length) {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let text = '';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

// --- Utility: SHA-256 then base64url encode (for code_challenge) ---
async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return await crypto.subtle.digest('SHA-256', data);
}

function base64urlencode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

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

// --- Step 2: when Spotify redirects back with ?code=..., exchange for tokens ---
async function handleRedirectCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const error = params.get('error');

  if (error) {
    output.textContent = `Error from Spotify: ${error}`;
    return;
  }

  if (!code) return; // normal load, no redirect in progress

  const codeVerifier = localStorage.getItem('spotify_code_verifier');
  if (!codeVerifier) {
    output.textContent = 'Missing code_verifier. Try logging in again.';
    return;
  }

  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier
  });

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

  // (Optional) store access token so you don’t lose it on refresh
  localStorage.setItem('spotify_access_token', accessToken);

  // Clean up URL (remove ?code=...)
  window.history.replaceState({}, document.title, redirectUri);

  updateUI();
  output.textContent = 'Logged in! Click "Get My Profile".';
}

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
  updateUI();
}

// --- Example API call: GET /v1/me ---
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

// --- Enable/disable buttons based on login state ---
function updateUI() {
  const loggedIn = !!accessToken;
  loginBtn.disabled   = loggedIn;
  logoutBtn.disabled  = !loggedIn;
  profileBtn.disabled = !loggedIn;
}

// --- Wire up events + initial load ---
loginBtn.addEventListener('click', startLogin);
logoutBtn.addEventListener('click', logout);
profileBtn.addEventListener('click', fetchMyProfile);

restoreToken();
handleRedirectCallback();
updateUI();
