<div align="center">

# GuamRadar

**Discover Guam, village by village.**

A map-first tourism platform that helps locals and visitors explore Guam's villages, restaurants, attractions, hotels, and community events — all on an interactive dark-mode map.

[guamradar.com](https://guamradar.com)

</div>

---

## About

GuamRadar puts Guam's 19 villages front and center. Click a village to see what's there — restaurants, beaches, hotels, cultural sites, and upcoming events. Use your location to find what's nearby, filter by category, or browse the whole island.

Built as a capstone project at the **University of Guam**.

## Features

**Map**
- Interactive map powered by Google Maps (dark theme)
- Village boundary overlays — click any village to explore it
- Toggle village borders, POI markers, event pins, and live hotspot zones
- Dynamic zoom that adapts to any screen size (mobile, tablet, desktop)
- Geolocation with GPS accuracy radius

**Discovery**
- Browse POIs by category: Attractions, Restaurants, Hotels
- Search across all places and events
- Filter by "Open Now" and "Near Me"
- Distance calculations from your location
- Event listings with verified/pending status

**Interface**
- Responsive layout — works on desktop and mobile
- Collapsible sidebar panels
- Village browser with dropdown navigation

## Roadmap

- [ ] Live database — replace demo data with real Guam POIs from Supabase
- [ ] Google Places API integration for richer POI data
- [ ] AI-powered itinerary planner
- [ ] User-submitted events and reviews
- [ ] Admin dashboard for content management
- [ ] PWA support (installable, offline-capable)

## Tech Stack

| | Technology |
|---|---|
| **Frontend** | React 19, TypeScript, Vite |
| **Map** | Google Maps, @vis.gl/react-google-maps |
| **Backend** | Java 21, Spring Boot 4 |
| **Database** | Supabase (PostgreSQL + PostGIS) |
| **Hosting** | Vercel (frontend), Railway (backend) |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS)
- [Java JDK 21](https://adoptium.net/)
- [Google Cloud](https://console.cloud.google.com/) project with Maps JavaScript API enabled

### Run locally

```bash
# Frontend
cd frontend
npm install
npm run dev
```

Create `frontend/.env`:
```
VITE_GOOGLE_MAPS_KEY=your_key_here
```

```bash
# Backend
cd backend
./mvnw spring-boot:run
```

The frontend runs at `http://localhost:5173` and the API at `http://localhost:8080`.

## Project Structure

```
frontend/       React + Vite app
  src/
    pages/      Page components (HomePage)
    components/ Reusable UI (ResultsList, DetailsPanel, VillageBrowser)
    hooks/      Custom React hooks (useVillages, useUserLocation, etc.)
    lib/        Utilities (geo, math, constants, ui)
    types/      TypeScript type definitions
    main.tsx    App entry point
  public/       Static assets (GeoJSON, images)
backend/        Spring Boot API
  src/
    main/       Java source + resources
docs/           Planning and documentation
```
