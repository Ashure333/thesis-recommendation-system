# PaperRec — Frontend

React + TypeScript + Tailwind CSS UI for the academic paper repository
and recommendation system (BulSU BSMCS), built with Vite.

## Dependencies

- Node.js 18+ (includes npm) — separate install from Python, get it at nodejs.org
- React 18, React Router 6, TypeScript 5, Tailwind CSS 3, Vite 5

## Running this alongside the backend

Two servers run at once during development:

```bash
# Terminal 1 -- backend, from your project root
python -m scripts.rebuild_recommendation_index   # once, before first use (and after big batches of uploads)
python -m uvicorn app.api:app --reload --port 8000

# Terminal 2 -- frontend, from this frontend/ folder
npm install
npm run dev
```

Open the frontend URL (usually http://localhost:5173) and go to
`/search`. `.env` sets `VITE_API_URL=http://localhost:8000` — change
this if your backend runs somewhere else. `src/api.ts` is the one file
that knows how to talk to the backend; every page imports from there
rather than calling `fetch` directly.

## Pages and their current status

| Route | File | Status |
|---|---|---|
| `/` | `pages/auth/Login.tsx` | UI only — no auth backend yet |
| `/register` | `pages/auth/Register.tsx` | UI only — no auth backend yet |
| `/search` | `pages/main/Search.tsx` | **Wired** — real stats, recent additions, and search hands off to Recommendations |
| `/repository` | `pages/repository/Repository.tsx` | **Wired** — real search/filter/sort/save |
| `/recommendations` | `pages/evaluation/Recommendations.tsx` | **Wired for TF-IDF and S-BERT only** — see below |
| `/upload` | `pages/repository/Upload.tsx` | **Wired** — real PDF upload, auto-extraction, manual completion, save |
| `/library` | `pages/repository/MyLibrary.tsx` | **Wired** — real save/remove, working "Find Similar" (single-user mode, see below) |
| `/evaluation` | `pages/evaluation/Evaluation.tsx` | Placeholder — no design yet |

**Recommendation pipelines:** of the six configurations from Chapter 3
(§3.6), only **TF-IDF** and **S-BERT** have a working implementation
behind them. The other four (TF-IDF+S-BERT, TF-IDF+Metadata,
S-BERT+Metadata, Full Hybrid) are visible in the pipeline selector,
marked "· soon," and disabled — shown honestly as planned rather than
hidden or silently redirected to a different pipeline.

## Single-user mode (no real auth yet)

Since Login/Register don't have backend logic, the API uses one
default "local" user for every Library action, created automatically
on first save. When real auth gets built, only
`app/services/local_user.py` needs to change.

## A schema note worth knowing

Your database has one `subject_category` column, but Upload's UI has
two dropdowns (Subject: CS/Math, Category: Machine Learning/etc.). The
API stores both combined as `"Subject: Category"` in that one column;
Repository's Subject/Category filters both substring-match against it.
Flag it if you'd rather split this into two real columns instead.

## Not yet built

- **Paper detail view** — still undecided (drawer vs. page)
- **Evaluation page** — no design provided yet
- **Metadata component + the 4 combined pipelines** — the recommendation
  engine (`app/services/recommendation/`) only has `tfidf_pipeline.py`
  and `sbert_pipeline.py` implemented so far
- **Real auth** — Login/Register forms don't submit anywhere yet

## Shared pieces worth knowing about

- `data/pipelineConfigs.ts` — the six recommendation configurations
  with their weight splits, used by Search and Recommendations so the
  two pages can't drift out of sync on this list.
- `components/WeightBar.tsx` — the small colored bar showing a
  config's weight split.
- `src/api.ts` — every backend call goes through here (`listPapers`,
  `getRecommendations`, `uploadPaper`, `saveToLibrary`, etc.).

## Structure

```
index.html                        Entry HTML
src/main.tsx                      React entry point
src/App.tsx                       Router — all routes defined here
src/api.ts                        Backend API client
src/index.css                     Tailwind directives + base typography
src/layouts/                      AuthLayout, AppLayout
src/pages/auth/                   Login, Register
src/pages/main/                   Search
src/pages/repository/             Repository, Upload, MyLibrary
src/pages/evaluation/             Recommendations, Evaluation
src/components/                   Shared UI (WeightBar)
src/data/                         Shared data (pipelineConfigs)
tailwind.config.js                Theme: navy/panel/gold palette, fonts
vite.config.ts                    Vite + React plugin
```

## Next steps

- Build the Metadata component and the 4 combined pipelines, then
  enable them in `Recommendations.tsx`'s `IMPLEMENTED` set
- Decide the Paper Detail treatment (drawer vs. page) and build it
- Get the Evaluation design and replace the placeholder
- Build real auth (Login/Register submit + redirect-if-signed-out)
