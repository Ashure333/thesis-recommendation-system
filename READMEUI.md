# Frontend — Paper Repository & Recommendation System

React + TypeScript + Tailwind CSS UI for the academic paper repository,
built with Vite.

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
| `/` | `pages/auth/Login.tsx` | Sign in |
| `/register` | `pages/auth/Register.tsx` | Create an account |
| `/recommendations` | `pages/evaluation/Recommendations.tsx` | Top-K results + pipeline selector |
| `/repository` | `pages/repository/Repository.tsx` | Search, sort, browse the repository |
| `/upload` | `pages/repository/Upload.tsx` | Upload a PDF, review auto-extracted fields |
| `/library` | `pages/repository/MyLibrary.tsx` | Papers the user saved |
| `/evaluation` | `pages/evaluation/Evaluation.tsx` | The Arena: compare the six pipelines |
| `/walkthrough` | `pages/walkthrough/Walkthrough.tsx` | Encyclopedia-style guide to every feature |
| `/walkthrough-engine` | `pages/walkthrough/MathWalkthrough.tsx` | The mathematics & CS of the engine |
| `/faq` | `pages/FAQ.tsx` | Frequently asked questions |

`layouts/AppLayout.tsx` holds the shared header/nav wrapper. The two auth
pages sit outside it; everything after sign-in renders inside it.

## The pixel pet

`components/retro/PixelPet.tsx` is the resident companion: a Rimuru-inspired
slime that explains the interface on hover, runs a scavenger hunt, and becomes
a help library. Its data lives in `data/`:

- `data/petlines.ts` — the pet's speech lines (Japanese + translation)
- `data/petForms.ts` — the ten Tempest forms it can shift into
- `data/tips.ts` — the tip catalogue the pet reveals
- `data/hunt.ts` — the six hidden treasures
- `data/achievements.ts` — the achievement rack

`components/retro/PetBlob.tsx` renders every form as pure CSS with the
character's own palette; `state/petForm.tsx` persists the selection.

## Structure

```
index.html              Entry HTML
src/main.tsx            React entry point
src/App.tsx             Router — all routes defined here
src/index.css           Tailwind directives + base typography + retro keyframes
src/components/         Shared UI (retro/, ui/)
src/data/               Pet lines, forms, tips, hunt, achievements
src/pages/              One file per page
src/state/              Pet form, hunt, achievements, layout prefs
src/utils/              Slime animation events
tailwind.config.js      Theme: colors (ink/paper/line/moss/clay), fonts
vite.config.ts          Vite + React plugin
```