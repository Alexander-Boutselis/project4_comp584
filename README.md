# project4_comp584
https://alexander-boutselis.github.io/project4_comp584/

# Project 4 – Spotify API Demo (COMP 584)

This project is a front-end web app that demonstrates how to integrate the Spotify Web API using the PKCE authorization flow. After the user logs in with their Spotify account, they can search for tracks, albums, and playlists, and open any result directly in Spotify. The page is fully responsive and includes subtle animations using the Popmotion library.

---

## Features

- **Spotify PKCE Login**
  - Uses the OAuth 2.0 PKCE flow entirely in the browser (no backend).
  - Stores the access token in `localStorage` so the user stays logged in between refreshes.

- **Search Integration**
  - Search **Tracks**, **Albums**, and **Playlists** (25 results per search).
  - Normalizes Spotify’s JSON into a unified `currentResults` object.
  - Each result shows:
    - Cover art  
    - Title (truncated if too long)  
    - Subtitle (artist/owner)  
    - Extra info (album name, track count, release date, etc.)

- **Result Tiles**
  - Results are rendered as clickable tiles in a scrollable list.
  - Clicking a tile opens the track/album/playlist in Spotify (`open.spotify.com`).

- **Animations (Popmotion)**
  - Uses **Popmotion** to add:
    - A pulsing “searching” effect on the results status text.
    - A smooth scale animation on hover for each result tile.

- **Responsive Layout**
  - Desktop: 3 search cards in a row (Track / Album / Playlist).
  - Tablet & Mobile: search cards and results stack vertically in a single centered column.
  - Layout implemented with **CSS Grid** and **Flexbox**.

---

## Tech Stack

- **HTML5** – structure and semantic layout.
- **CSS3** – custom styling, grid, and flexbox for responsive design.
- **JavaScript (ES6+)** – PKCE flow, API calls, DOM manipulation.
- **Spotify Web API** – authentication and search endpoints.
- **Popmotion** – animation library (loaded via CDN).

---

## File Structure

```text
project4_comp584/
│
├─ index.html        # Main HTML page
├─ style.css         # All styles, grid/flex layout, responsive rules
├─ app.js            # PKCE flow, Spotify API calls, rendering, Popmotion usage
└─ images/
   └─ defaultImage.jpg   # Fallback cover art if a result has no image
