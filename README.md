<div align="center">

# GuamRadar

**Discover Guam, village by village.**

A map-first tourism platform that helps locals and visitors explore Guam's villages, restaurants, attractions, hotels, and community events — all on an interactive map.

[guamradar.com](https://guamradar.com)

</div>

---

## About

GuamRadar puts Guam's 19 villages front and center. Click a village to see what's there — restaurants, beaches, hotels, cultural sites, and upcoming events. Use your location to find what's nearby, filter by category, or browse the whole island.

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
