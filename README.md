# GuamRadar (Capstone)

GuamRadar is a **map-first Guam tourism web app (PWA-style)** that helps users discover villages, POIs, and events—eventually with “near me” and itinerary features.

---

## Live links

- **Website:** https://guamradar.com  

---

## Tech stack

- **Code hosting:** GitHub (repo, branches, pull requests)
- **Frontend:** React + TypeScript + Vite (in `frontend/`)
- **Backend:** Java + Spring Boot (in `backend/`)
- **Database:** Supabase (Postgres + PostGIS)
- **Frontend hosting:** Vercel (deploys `frontend/`)
- **Backend hosting:** Railway (deploys `backend/`)
- **Domain/DNS:** Namecheap (points `guamradar.com` to Vercel)

---

## Repo structure (where you work)

```text
/frontend   → UI (React/Vite)
/backend    → API (Spring Boot)
/docs       → notes, planning, screenshots, diagrams
```

- If you’re working on **UI** → mostly touch `frontend/src/**`
- If you’re working on **API** → mostly touch `backend/src/**`
- If you’re working on **planning/docs** → put it in `docs/`
- If you’re working on **database** → it's in **supabase**

---

## Quick start (local dev)

### Prerequisites (install once)

- Git  
- Node.js (LTS) (includes npm)  
- Java JDK 21 (recommended for consistency)

> You do **NOT** need Maven installed: this repo uses the **Maven Wrapper** (`backend/mvnw`).

---

### 1) Clone the repo

```bash
git clone <repo-ssh-or-https-url>
cd guamradar
```

---

### 2) Run the frontend (easy, works even if you don’t run the backend)

Windows (PowerShell)
It's easier to install things with chocolate so install Chocolatey for Windows PowerShell/Termninal: https://chocolatey.org/install

Scroll down to "Install Chocolatey for Individual Use:" and simply do 1-5

WIP

```bash

```

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at the URL Vite prints (usually `http://localhost:5173`).

---

### 3) Run the backend (local)

```bash
cd backend
./mvnw spring-boot:run
```

Backend runs at `http://localhost:8080`.

Test:

```text
http://localhost:8080/api/health
```

---

## Database (Supabase)

**TO-DO**

---

## How deployments work (you don’t need accounts to contribute)

- **Vercel** deploys the frontend from `frontend/`
- **Railway** deploys the backend from `backend/`
- Deployments happen when changes are merged into `main`

You only need **GitHub access + local setup**.  
You do **not** need Vercel/Railway/Supabase (supabase for database probably will need access) accounts unless you’re managing deployments/DB settings.

---

## GitHub workflow 

**Update main:**

```bash
git switch main
git pull
```

**Create a branch for your task:**

```bash
git switch -c feat/short-description
```

**Make changes, then commit:**

```bash
git add .
git commit -m "Short clear message"
```

**Push your branch:**

```bash
git push -u origin feat/short-description
```

**Open a Pull Request (PR) on GitHub:**

- Base: `main`  
- Compare: your branch  
- Add a short description + how to test.

---

### Branch naming (keep it simple)

- `feat/...` → new feature  
- `fix/...` → bug fix  
- `docs/...` → documentation only  

**Examples:**

- `feat/poi-list-ui`
- `fix/cors-allow-guamradar`
- `docs/setup-guide`

---

## Some “rules” 

- Don’t commit secrets (`.env`, passwords, keys)
- Don’t commit build folders:
  - `frontend/node_modules/`
  - `backend/target/`
- Keep PRs small (easier to review + merge)
