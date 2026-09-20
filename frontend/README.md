# PaperRec — Frontend

React + TypeScript + Tailwind CSS UI for the academic paper repository
and recommendation system (BulSU BSMCS), built with Vite. These are
**page skeletons** — layout, navigation, and styling are in place, but
no data fetching or backend wiring yet.

## Dependencies

- Node.js 18+ (includes npm) — separate install from Python, get it at nodejs.org
- React 18, React Router 6, TypeScript 5, Tailwind CSS 3, Vite 5

## Setup

From inside this `frontend/` folder:

```bash
npm install     # installs everything in package.json
npm run dev     # starts the dev server
```

Open the URL it prints (usually http://localhost:5173). It starts on
the Login page; sign-in isn't wired up yet, so navigate directly to
`/search` in the address bar to see the pages behind the nav.

## Pages

| Route | File | Purpose |
|---|---|---|
| `/` | `pages/Login.tsx` | Sign in |
| `/register` | `pages/Register.tsx` | Create an account |
| `/search` | `pages/Search.tsx` | Landing page: hero, query bar, stats, pipeline overview, recent additions |
| `/repository` | `pages/Repository.tsx` | Full browse: sidebar filters, sortable list |
| `/recommendations` | `pages/Recommendations.tsx` | Results for a submitted query: pipeline selector + ranked table |
| `/upload` | `pages/Upload.tsx` | Full-page upload form + Recommendation Signal Validation checklist |
| `/library` | `pages/MyLibrary.tsx` | Saved papers, Find Similar / Remove |
| `/evaluation` | `pages/Evaluation.tsx` | **Placeholder only** — design not finalized yet |

`layouts/AuthLayout.tsx` wraps Login/Register (centered, no nav).
`layouts/AppLayout.tsx` wraps everything else (top nav bar with the
active pipeline badge). Unknown routes redirect to Login.

## Not yet built

- **Paper detail view** — whether this is a slide-in drawer or its own
  page hasn't been decided yet. Repository, Recommendations, and My
  Library currently show plain text titles (not links) rather than
  guessing at this.
- **Evaluation page** — no design provided yet, so it's a bare
  placeholder that keeps the nav link from being dead. Replace
  `pages/Evaluation.tsx` once that's ready.
- **Auth wiring** — Login/Register submit nothing yet; there's no
  redirect-if-signed-out logic on the app pages.

## Shared pieces worth knowing about

- `data/pipelineConfigs.ts` — the six recommendation configurations
  (TF-IDF, S-BERT, their combinations, Full Hybrid) with their weight
  splits, used by both Search and Recommendations so the two pages
  can't drift out of sync on this list.
- `components/WeightBar.tsx` — the small colored bar showing a
  config's weight split, shared by both of those pages too.

## Structure

```
index.html                  Entry HTML
src/main.tsx                React entry point
src/App.tsx                 Router — all routes defined here
src/index.css                Tailwind directives + base typography
src/layouts/                 AuthLayout, AppLayout
src/pages/                   One file per page
src/components/              Shared UI (WeightBar)
src/data/                    Shared data (pipelineConfigs)
tailwind.config.js           Theme: navy/panel/gold palette, fonts
vite.config.ts                Vite + React plugin
```

## Next steps

- Decide the Paper Detail treatment (drawer vs. page) and build it
- Get the Evaluation design and replace the placeholder
- Wire pages to the Python backend once its API routes exist
- Add auth state handling (redirect to `/` when signed out)
