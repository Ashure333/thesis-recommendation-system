# Frontend — Paper Repository & Recommendation System

React + TypeScript + Tailwind CSS UI for the academic paper repository,
built with Vite. These are **page skeletons only** — layout, navigation,
and styling are in place, but no data fetching or backend wiring yet.

## Dependencies

- Node.js 18+ (includes npm)
- React 18, React Router 6, TypeScript 5, Tailwind CSS 3, Vite 5

## Setup

From inside this `frontend/` folder:

```bash
npm install     # installs everything in package.json
npm run dev     # starts the dev server
```

Then open the URL it prints (usually http://localhost:5173).

## Pages

| Route | File | Purpose |
|---|---|---|
| `/` | `Login.tsx` | Sign in |
| `/register` | `Register.tsx` | Create an account |
| `/dashboard` | `Dashboard.tsx` | Overview + navigation hub |
| `/upload` | `UploadPaper.tsx` | Upload a PDF, review auto-extracted fields |
| `/browse` | `BrowsePapers.tsx` | Search, sort, browse the repository |
| `/papers/:id` | `PaperDetail.tsx` | Full metadata for one paper + actions |
| `/papers/:id/complete` | `CompleteMetadata.tsx` | Fill in fields extraction missed |
| `/recommendations` | `Recommendations.tsx` | Top-K results + configuration selector |
| `/library` | `PersonalLibrary.tsx` | Papers the user saved |

`components/Layout.tsx` holds the shared header/nav wrapper. The two auth
pages sit outside it; everything after sign-in renders inside it.

## Structure

```
index.html              Entry HTML
src/main.tsx            React entry point
src/App.tsx             Router — all routes defined here
src/index.css           Tailwind directives + base typography
src/components/         Shared UI (currently just Layout)
src/pages/              One file per page
tailwind.config.js      Theme: colors (ink/paper/line/moss/clay), fonts
vite.config.ts          Vite + React plugin
```


