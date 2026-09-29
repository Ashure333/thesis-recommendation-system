# Academic Paper Repository & Recommendation System

A locally deployed thesis prototype for storing, searching, and recommending academic papers using text-based representations and metadata.

The system currently combines a **FastAPI + SQLite/SQLAlchemy backend** with a **React + TypeScript + Tailwind CSS frontend**. Papers can be imported from PDFs or BibTeX citations, validated for recommendation use, represented with TF-IDF and S-BERT, and searched through the web interface.

## Overview

The project is designed around three main areas:

1. **Paper Repository**
   - Store and browse academic papers.
   - Extract metadata from PDFs and BibTeX.
   - Store uploaded paper files.
   - Filter and sort repository records.
   - Save papers to a personal library.
   - Find and attach open-access PDFs for records that do not have a PDF.

2. **Recommendation**
   - Prepare paper text from title, abstract, and keywords.
   - Generate TF-IDF representations.
   - Generate S-BERT semantic embeddings.
   - Compare papers using cosine similarity.
   - Search by text query or by an existing seed paper.
   - Return ranked Top-K results.

3. **Research / Evaluation**
   - Maintain recommendation-validity fields.
   - Classify papers by subject/category when possible.
   - Rebuild recommendation representations after repository changes.
   - Provide evaluation and recommendation pages in the frontend.

> **Current implementation note:** TF-IDF and S-BERT are the recommendation pipelines currently implemented at query time. Metadata and hybrid scoring are part of the project's planned/developing recommendation architecture.

---

## Current Features

### Repository

- SQLite database managed through SQLAlchemy.
- PDF upload and storage.
- BibTeX import.
- Google Scholar BibTeX import support.
- Automatic extraction of:
  - Title
  - Abstract
  - Keywords
  - Publication year
  - BibTeX-supported metadata such as author and DOI when available
- Subject/category classification when the field is missing.
- Recommendation metadata validation.
- Prepared-text generation.
- Repository search, filtering, and sorting.
- Paper deletion and metadata updates.
- Personal library.
- PDF viewer endpoint.
- Online PDF candidate search and PDF attachment.

### Recommendation

- TF-IDF vector generation.
- S-BERT embedding generation.
- Cosine similarity scoring.
- Query-based recommendation.
- Seed-paper-based recommendation.
- Top-K result limiting.
- Zero-score filtering in repository search.
- Recommendation-index stale-state tracking.
- Manual recommendation-index rebuilding.

### Frontend

- React 18 + TypeScript.
- React Router.
- Tailwind CSS.
- Vite development/build tooling.
- Search page.
- Repository page.
- Recommendations page.
- Upload page.
- My Library page.
- Evaluation page.
- PDF viewer.
- BibTeX import interface.
- Google Scholar drag-and-drop/import workflow.
- Online PDF finder.
- Recommendation-index update banner and rebuild button.

---

## System Architecture

```text
                         ┌─────────────────────┐
                         │   React Frontend    │
                         │ TypeScript + Vite   │
                         │     + Tailwind      │
                         └──────────┬──────────┘
                                    │ HTTP
                                    ▼
                         ┌─────────────────────┐
                         │    FastAPI API      │
                         │      app/api.py     │
                         └──────────┬──────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              ▼                     ▼                     ▼
      ┌───────────────┐     ┌───────────────┐     ┌───────────────┐
      │    SQLite     │     │ Paper / PDF   │     │ Recommendation│
      │  SQLAlchemy   │     │  Processing   │     │   Services    │
      └───────────────┘     └───────────────┘     └───────┬───────┘
                                                           │
                                              ┌────────────┴────────────┐
                                              ▼                         ▼
                                       ┌─────────────┐           ┌─────────────┐
                                       │   TF-IDF    │           │   S-BERT    │
                                       │  Pipeline   │           │  Pipeline   │
                                       └─────────────┘           └─────────────┘
```

### Paper processing flow

```text
PDF / BibTeX
     │
     ▼
Metadata extraction
     │
     ▼
Paper record
     │
     ├── Classification
     │
     ├── Validation
     │
     └── Prepared text
              │
              ├── TF-IDF vector
              │
              └── S-BERT embedding
```

The recommendation representations are rebuilt separately through the recommendation rebuild process.

---

## Requirements

### Backend

- Python 3.10 or newer
- Internet access for the first S-BERT model download
- Enough disk space for the S-BERT model and generated representations

Main Python dependencies include:

- SQLAlchemy
- FastAPI
- Uvicorn
- pdfplumber
- scikit-learn
- sentence-transformers
- joblib
- NumPy
- YAKE
- requests
- python-multipart

### Frontend

- Node.js 18 or newer
- npm

Frontend dependencies include:

- React 18
- React Router 6
- TypeScript 5
- Tailwind CSS 3
- Vite 5

---

## Project Structure

```text
kazuyaaaadesu-tfidf-sbert-metadata-recommendationsystem/
│
├── app/
│   ├── api.py
│   ├── database.py
│   ├── schemas.py
│   ├── data/
│   │   └── tfidf_vectorizer.joblib
│   ├── models/
│   │   └── models.py
│   ├── repositories/
│   │   └── queries.py
│   └── services/
│       ├── bib_extraction.py
│       ├── classification.py
│       ├── extraction.py
│       ├── latex_extraction.py
│       ├── local_user.py
│       ├── pdf_finder.py
│       ├── storage.py
│       ├── text_preparation.py
│       ├── upload_paper.py
│       ├── validation.py
│       └── recommendation/
│           ├── search_service.py
│           ├── similarity.py
│           ├── sbert_pipeline.py
│           └── tfidf_pipeline.py
│
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── api.ts
│       ├── App.tsx
│       ├── index.css
│       ├── components/
│       │   ├── BibTeXImport.tsx
│       │   ├── FindPdfPanel.tsx
│       │   ├── PaperViewerModal.tsx
│       │   ├── RecommendationIndexAlert.tsx
│       │   ├── RecommendationRebuildButton.tsx
│       │   ├── Upload.google-scholar-dnd.tsx
│       │   ├── WeightBar.tsx
│       │   └── ui/
│       ├── data/
│       │   └── pipelineConfigs.ts
│       ├── layouts/
│       │   ├── AppLayout.tsx
│       │   └── AuthLayout.tsx
│       └── pages/
│           ├── auth/
│           ├── evaluation/
│           ├── main/
│           └── repository/
│
├── paperrec-scholar-extension/
│   ├── background.js
│   ├── content.js
│   └── manifest.json
│
├── scripts/
│   ├── bulk_upload.py
│   ├── classify_existing_papers.py
│   ├── init_script.py
│   ├── inspect_papers.py
│   ├── migrate_add_stored_path.py
│   ├── rebuild_recommendation.py
│   ├── rebuild_recommendation_index.py
│   ├── reextract_metadata.py
│   ├── search_papers.py
│   └── view_database.py
│
├── storage/
│   ├── recommendation_index_status.json
│   └── papers/
│
├── test/
│   ├── test_extraction.py
│   └── test_upload_flow.py
│
├── requirements.txt
└── README.md
```

---

## Setup

The project has two separately installed environments:

- **Python environment** for the FastAPI backend, database, PDF/BibTeX processing, and recommendation pipelines.
- **Node.js environment** for the React/Vite frontend.

You should install both before running the complete application.

> **Windows note:** The commands below use PowerShell. Run them from the project root unless the command explicitly changes into `frontend/`.

### 0. Install the prerequisites

Install the following before creating the project environments:

#### Python

Use **Python 3.10 or newer**.

Verify the installation:

```powershell
python --version
```

Expected format:

```text
Python 3.x.x
```

If `python` is not recognized on Windows, install Python and make sure it is available on `PATH`.

#### Node.js and npm

Install **Node.js 18 or newer**. npm is included with Node.js.

Verify both:

```powershell
node --version
npm --version
```

Expected format:

```text
v18.x.x
10.x.x
```

#### Git

Git is recommended for cloning and updating the repository.

Verify:

```powershell
git --version
```

### 1. Open the project

If the repository has already been cloned:

```powershell
cd "G:\OJT files\TFIDF-SBERT-Metadata-RecommendationSystem"
```

If cloning from Git:

```powershell
git clone <repository-url>
cd <repository-folder>
```

The project root should contain:

```text
README.md
requirements.txt
app/
frontend/
scripts/
storage/
test/
```

### 2. Create the Python virtual environment

From the project root:

```powershell
python -m venv .venv
```

This creates a local Python environment inside:

```text
.venv/
```

Each developer should have their own `.venv`.

### 3. Activate the Python environment

Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

macOS/Linux:

```bash
source .venv/bin/activate
```

If activation is successful, the terminal should show:

```text
(.venv)
```

If PowerShell blocks the activation script, you can allow scripts for the current PowerShell user with:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Then activate the environment again:

```powershell
.\.venv\Scripts\Activate.ps1
```

### 4. Upgrade pip

With `.venv` activated:

```powershell
python -m pip install --upgrade pip
```

### 5. Install backend dependencies

Install the exact project dependency list:

```powershell
python -m pip install -r requirements.txt
```

The current `requirements.txt` includes:

```text
SQLAlchemy>=2.0
pdfplumber>=0.11
scikit-learn
sentence-transformers
joblib
numpy
yake
fastapi>=0.111
uvicorn[standard]>=0.30
python-multipart>=0.0.9
requests
```

Verify important packages after installation:

```powershell
python -c "import fastapi, sqlalchemy, sklearn, sentence_transformers, pdfplumber; print('Backend dependencies OK')"
```

### 6. Initialize the database

Only initialize the database when it has not already been initialized:

```powershell
python -m scripts.init_script
```

This creates the required SQLite tables.

The database is expected at:

```text
app/data/academic_repository.db
```

> **Important:** If the repository already contains the team's populated `academic_repository.db`, do **not** run the initialization script unnecessarily. Work on the existing database instead.

### 7. Run the stored-path migration if required

If you are using an older database that does not contain the `stored_path` column:

```powershell
python -m scripts.migrate_add_stored_path
```

The migration is safe to run when the column already exists; the script checks for the column before adding it.

Do not run unrelated migrations unless the project actually requires them.

### 8. Prepare the storage directories

The application uses:

```text
storage/
├── recommendation_index_status.json
└── papers/
```

If these directories do not exist yet, create them:

```powershell
New-Item -ItemType Directory -Force .\storage\papers
```

The application also creates required storage directories when saving files.

### 9. Install frontend dependencies

Open a second terminal, or remain in the first terminal and change directories after finishing backend setup:

```powershell
cd frontend
npm install
```

This installs the dependencies declared in:

```text
frontend/package.json
```

The frontend uses:

- React 18
- React Router 6
- TypeScript 5
- Tailwind CSS 3
- Vite 5

Verify the frontend can build:

```powershell
npm run build
```

If the build succeeds, return to the project root when needed:

```powershell
cd ..
```

### 10. Configure the frontend API URL

The frontend reads:

```text
VITE_API_URL
```

If it is not provided, the frontend falls back to:

```text
http://localhost:8000
```

For local development, no environment variable is normally required if the backend is running on the default FastAPI port.

If a custom backend URL is required, create:

```text
frontend/.env.local
```

with:

```text
VITE_API_URL=http://localhost:8000
```

Do not commit local secrets or machine-specific environment files.

### 11. Build the initial recommendation index

After the database contains papers, build the recommendation representations before using TF-IDF or S-BERT recommendations:

```powershell
cd "G:\OJT files\TFIDF-SBERT-Metadata-RecommendationSystem"
.\.venv\Scripts\Activate.ps1
python -m scripts.rebuild_recommendation
```

The master rebuild:

1. Classifies papers when Subject/Category is missing.
2. Preserves existing Subject/Category values.
3. Validates recommendation metadata.
4. Rebuilds `prepared_text`.
5. Fits and stores the TF-IDF vectorizer.
6. Stores TF-IDF vectors.
7. Generates S-BERT embeddings.

The first S-BERT run can take significantly longer because the model may need to download.

The current S-BERT implementation uses:

```text
all-MiniLM-L6-v2
```

The model must be available locally before recommendation requests can complete.

### 12. Start the backend

From the project root with `.venv` activated:

```powershell
uvicorn app.api:app --reload
```

The API normally runs at:

```text
http://localhost:8000
```

FastAPI's interactive API documentation is normally available at:

```text
http://localhost:8000/docs
```

### 13. Start the frontend

Open another terminal:

```powershell
cd "G:\OJT files\TFIDF-SBERT-Metadata-RecommendationSystem\frontend"
npm run dev
```

Vite normally runs at:

```text
http://localhost:5173
```

The frontend communicates with the backend using the configured `VITE_API_URL`, or `http://localhost:8000` by default.

### 14. Optional — install the Google Scholar browser extension

The repository also contains:

```text
paperrec-scholar-extension/
├── background.js
├── content.js
└── manifest.json
```

The extension is a Chrome Manifest V3 extension for sending Google Scholar BibTeX citations into the local PaperRec frontend.

To load it in Chrome:

1. Open Chrome.
2. Go to `chrome://extensions/`.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Choose the project's `paperrec-scholar-extension/` folder.
6. Keep the PaperRec frontend running at `http://localhost:5173` or `http://127.0.0.1:5173`.

The extension manifest currently targets Chrome 110+.

### 15. Verify the installation

With the backend running, verify the API:

```powershell
Invoke-WebRequest http://localhost:8000/docs
```

Then verify the frontend by opening:

```text
http://localhost:5173
```

You should be able to access the PaperRec interface.

For a backend smoke test, run:

```powershell
python -m test.test_upload_flow sample.pdf
```

For repository search:

```powershell
python -m scripts.search_papers --pipeline tfidf --query "neural networks"
```

or:

```powershell
python -m scripts.search_papers --pipeline sbert --query "neural networks"
```

### Recommended installation order

For a clean first-time setup, use this order:

```text
Install Python
      ↓
Install Node.js
      ↓
Open project root
      ↓
Create + activate .venv
      ↓
Install requirements.txt
      ↓
Initialize/migrate database if required
      ↓
npm install inside frontend/
      ↓
Add/import papers
      ↓
Run rebuild_recommendation
      ↓
Start FastAPI
      ↓
Start Vite
      ↓
Open PaperRec in the browser
```

---

## Environment Verification

Before troubleshooting the application, verify that the correct tools are being used:

```powershell
python --version
python -m pip --version
node --version
npm --version
```

When the Python virtual environment is active, `python` and `pip` should resolve to the `.venv` environment.

You can also verify the installed Python dependencies with:

```powershell
python -c "import fastapi, sqlalchemy, sklearn, sentence_transformers, pdfplumber; print('Backend dependencies OK')"
```

For the frontend, from `frontend/`:

```powershell
npm run build
```

A successful build confirms that the installed Node dependencies and TypeScript/Vite configuration are usable.

---

## Running the Application

The backend and frontend run as separate development processes.

### Backend

From the project root:

```powershell
uvicorn app.api:app --reload
```

The API is normally available at:

```text
http://localhost:8000
```

### Frontend

In a second terminal:

```powershell
cd frontend
npm run dev
```

The Vite development server normally uses:

```text
http://localhost:5173
```

The frontend uses the `VITE_API_URL` environment variable when provided and otherwise falls back to:

```text
http://localhost:8000
```

---

## Database and Storage

### SQLite database

The application database is stored at:

```text
app/data/academic_repository.db
```

### TF-IDF vectorizer

```text
app/data/tfidf_vectorizer.joblib
```

### Uploaded paper files

```text
storage/papers/
```

Paper files are stored using the paper ID, for example:

```text
storage/papers/74.pdf
```

or, for imported BibTeX records:

```text
storage/papers/74.bib
```

The database stores the relative storage path.

### Recommendation index status

```text
storage/recommendation_index_status.json
```

This file records whether repository changes have made the recommendation index stale.

---

## Paper Import

The API accepts both:

```text
.pdf
.bib
```

### PDF import

PDF imports use the PDF extraction service to obtain available metadata and create a repository record.

The general flow is:

```text
PDF
 ↓
Text / metadata extraction
 ↓
Classification
 ↓
Validation
 ↓
Prepared text
 ↓
Database record
 ↓
Stored paper file
```

### BibTeX import

BibTeX entries are parsed by the BibTeX extraction service.

The application can use BibTeX metadata such as title, author, year, DOI, and other available citation information.

The frontend also provides a Google Scholar BibTeX workflow:

```text
Google Scholar
     ↓
Cite
     ↓
BibTeX
     ↓
Copy citation
     ↓
PaperRec BibTeX import
```

### Google Scholar URL import

The API also supports Google Scholar BibTeX URLs matching:

```text
https://scholar.googleusercontent.com/scholar.bib...
```

---

## Recommendation Text Preparation

Recommendation text is built from:

```text
Title + Abstract + Keywords
```

The resulting text is stored as:

```text
prepared_text
```

The preparation process normalizes the text before it is passed to the recommendation pipelines.

Publication year and other metadata are stored separately.

---

## Recommendation Validity

A paper is considered valid for recommendation when the required recommendation fields are available:

- Title
- Abstract
- Keywords
- Publication year

The validation result is stored in:

```text
is_valid_for_recommendation
```

Missing required information is recorded in:

```text
missing_fields
```

Subject/category is used as repository metadata and classification information; it is not itself a requirement for recommendation validity.

---

## Recommendation Pipelines

### TF-IDF

TF-IDF represents a paper using lexical word importance across the repository.

It is useful for matching terms that occur in both the query and paper text.

### S-BERT

S-BERT converts prepared text into semantic embeddings.

It is intended to capture semantic similarity even when related papers do not use exactly the same words.

### Current query-time implementation

The current recommendation API supports:

```text
tfidf
sbert
```

A recommendation request can use either:

- a text query, or
- a seed paper ID

but not both at the same time.

Example:

```powershell
curl "http://localhost:8000/api/recommendations?pipeline=sbert&query=neural%20networks&top_k=10"
```

Seed-paper recommendation:

```powershell
curl "http://localhost:8000/api/recommendations?pipeline=sbert&seed_paper_id=74&top_k=10"
```

The selected seed paper is excluded from its own recommendation results by default.

---

## Recommendation Index Rebuilding

Repository changes can make stored recommendation representations outdated.

The backend tracks this state through:

```text
storage/recommendation_index_status.json
```

### Manual rebuild

Run:

```powershell
python -m scripts.rebuild_recommendation
```

The master rebuild performs:

1. Subject/category classification when missing.
2. Preservation of existing subject/category values.
3. Recommendation metadata validation.
4. Prepared-text regeneration.
5. TF-IDF vectorization.
6. TF-IDF vectorizer storage.
7. S-BERT embedding generation.
8. Storage of updated recommendation representations.

The older lower-level index script is also available:

```powershell
python -m scripts.rebuild_recommendation_index
```

Use the master rebuild when the complete recommendation preparation process needs to be refreshed.

### When to rebuild

Rebuild after:

- Bulk importing papers.
- Adding new papers.
- Editing recommendation-relevant metadata.
- Changing text-preparation logic.
- Changing TF-IDF settings.
- Changing the S-BERT model.
- Changing classification rules.
- Updating or replacing stored recommendation representations.

The first S-BERT rebuild may take considerably longer because the model may need to be downloaded and loaded.

---

## Recommendation Index Status in the UI

When an upload or recommendation-relevant paper update occurs, the backend marks the recommendation index as stale.

The frontend checks:

```text
GET /api/recommendations/status
```

When stale, the application displays a notification with a:

```text
Rebuild Index
```

button.

The rebuild request uses:

```text
POST /api/recommendations/rebuild
```

The frontend also dispatches a browser event after repository changes so the stale notification can appear immediately without requiring a page refresh.

---

## Repository Search

The backend supports repository filtering through:

```text
GET /api/papers
```

Available filters include:

- Search text
- Subject
- Category
- Document type
- Minimum publication year
- Maximum publication year
- Sort order
- Result limit

Example:

```text
GET /api/papers?search=neural&subject=Computer%20Science
```

Repository statistics are available through:

```text
GET /api/papers/stats
```

---

## PDF Discovery

For a paper without a stored PDF, the application can search for candidate open-access PDFs.

### Find candidates

```text
GET /api/papers/{paper_id}/find-pdf
```

The backend can use sources including:

- Unpaywall
- Crossref
- Semantic Scholar
- arXiv
- OpenAlex

The search step returns candidates for review rather than immediately downloading a file.

### Attach a selected PDF

```text
POST /api/papers/{paper_id}/attach-pdf
```

The selected file is downloaded, checked against the paper, and stored using the normal paper-storage process.

---

## API Overview

| Method   | Endpoint                       | Purpose                               |
| -------- | ------------------------------ | ------------------------------------- |
| `GET`    | `/api/papers`                  | List, search, filter, and sort papers |
| `GET`    | `/api/papers/stats`            | Repository statistics                 |
| `GET`    | `/api/papers/{id}`             | Get one paper                         |
| `PATCH`  | `/api/papers/{id}`             | Update paper metadata                 |
| `DELETE` | `/api/papers/{id}`             | Delete a paper                        |
| `POST`   | `/api/papers/upload`           | Upload PDF or BibTeX                  |
| `GET`    | `/api/papers/{id}/pdf`         | View stored PDF                       |
| `GET`    | `/api/papers/{id}/find-pdf`    | Find PDF candidates                   |
| `POST`   | `/api/papers/{id}/attach-pdf`  | Attach selected PDF                   |
| `GET`    | `/api/recommendations`         | Get ranked recommendations            |
| `GET`    | `/api/recommendations/status`  | Check stale recommendation state      |
| `POST`   | `/api/recommendations/rebuild` | Rebuild recommendation data           |
| `GET`    | `/api/library`                 | Get saved papers                      |
| `POST`   | `/api/library/{id}`            | Save paper to library                 |
| `DELETE` | `/api/library/{id}`            | Remove paper from library             |

---

## Frontend Routes

| Route              | Page            | Purpose                              |
| ------------------ | --------------- | ------------------------------------ |
| `/`                | Login           | Sign in                              |
| `/register`        | Register        | Create an account                    |
| `/search`          | Search          | Search the paper repository          |
| `/repository`      | Repository      | Browse and filter papers             |
| `/recommendations` | Recommendations | Generate and inspect recommendations |
| `/upload`          | Upload          | Import papers                        |
| `/library`         | My Library      | View saved papers                    |
| `/evaluation`      | Evaluation      | Recommendation evaluation interface  |

The shared application navigation is defined in:

```text
frontend/src/layouts/AppLayout.tsx
```

API communication is centralized in:

```text
frontend/src/api.ts
```

---

## Frontend Development

From the `frontend/` directory:

### Start development server

```powershell
npm run dev
```

### Build the frontend

```powershell
npm run build
```

### Preview a production build

```powershell
npm run preview
```

---

## Testing and Development Scripts

### Run upload-flow test

```powershell
python -m test.test_upload_flow sample.pdf
```

### Run extraction tests

```powershell
python -m test.test_extraction
```

### View database contents

```powershell
python -m scripts.view_database
```

Large vector fields are hidden by default.

To display them:

```powershell
python -m scripts.view_database --show-vectors
```

### Search using S-BERT

```powershell
python -m scripts.search_papers --pipeline sbert --query "neural networks"
```

### Search using TF-IDF

```powershell
python -m scripts.search_papers --pipeline tfidf --query "neural networks"
```

### Request a specific number of results

```powershell
python -m scripts.search_papers --pipeline sbert --query "neural networks" --top-k 10
```

### Inspect stored paper files

Windows PowerShell:

```powershell
Get-ChildItem .\storage\papers
```

Search the project for PDFs:

```powershell
Get-ChildItem -Recurse -Filter *.pdf
```

---

## Common Issues

### `ModuleNotFoundError: No module named 'app'`

Run Python modules from the project root:

```powershell
python -m scripts.view_database
```

instead of executing a module file directly.

### S-BERT model download problems

Check that:

- `.venv` is activated.
- `requirements.txt` has been installed.
- Internet access is available.
- Enough disk space is available.
- The selected S-BERT model can be downloaded.

An unauthenticated Hugging Face warning does not necessarily mean the model failed to load.

### Search results are outdated

Rebuild the recommendation data:

```powershell
python -m scripts.rebuild_recommendation
```

### Search results are unexpected

Check:

- The paper has valid recommendation metadata.
- `prepared_text` contains the expected title, abstract, and keywords.
- Recommendation vectors were generated after the latest metadata changes.
- The repository contains enough related papers for the query.

### Duplicate papers

Repeated imports or test uploads can create multiple records for the same paper.

Inspect the database:

```powershell
python -m scripts.view_database
```

Duplicate detection and cleanup remain a development concern before final evaluation.

---

## Important Development Notes

- This is a **research prototype**, not a production system.
- Each developer should use their own `.venv`.
- Do not commit `.venv/` or `__pycache__/`.
- The SQLite database may be shared by the team; coordinate database changes.
- SQLite database files do not merge like normal source files.
- Back up the database before migrations, bulk imports, or cleanup operations.
- Repeatedly running upload tests can add additional paper records.
- The PDF extractor is heuristic-based and may not work correctly for every document layout.
- Scanned-PDF OCR is not part of the current extraction pipeline.
- Missing metadata may be stored as `None` or represented as missing fields.
- Recommendation scores are ranking/similarity values, not percentages.
- The first S-BERT execution can take longer because the model must be loaded or downloaded.

---

## Current Development Status

| Component                           | Status                  |
| ----------------------------------- | ----------------------- |
| SQLite database                     | Implemented             |
| SQLAlchemy models                   | Implemented             |
| FastAPI API                         | Implemented             |
| PDF upload                          | Implemented             |
| BibTeX import                       | Implemented             |
| Google Scholar BibTeX import        | Implemented             |
| PDF storage                         | Implemented             |
| PDF metadata extraction             | Implemented / heuristic |
| BibTeX metadata extraction          | Implemented             |
| Subject/category classification     | Implemented             |
| Recommendation metadata validation  | Implemented             |
| Prepared text                       | Implemented             |
| TF-IDF pipeline                     | Implemented             |
| S-BERT pipeline                     | Implemented             |
| Cosine similarity                   | Implemented             |
| Repository search                   | Implemented             |
| Seed-paper recommendation           | Implemented             |
| Personal library                    | Implemented             |
| Online PDF discovery                | Implemented             |
| Recommendation stale-state tracking | Implemented             |
| Recommendation rebuild API          | Implemented             |
| React frontend                      | Implemented             |
| Recommendation-index UI alert       | Implemented             |
| Recommendation-index rebuild button | Implemented             |
| Hybrid recommendation scoring       | In development          |
| Metadata similarity scoring         | In development          |
| Recommendation evaluation scripts   | Planned                 |
| Duplicate-paper detection           | Future improvement      |
| Scanned-PDF OCR                     | Future improvement      |
| Automated metadata completion       | Future improvement      |

---

## Quick Start

### Terminal 1 — Backend

```powershell
# From project root
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.api:app --reload
```

### Terminal 2 — Frontend

```powershell
cd frontend
npm install
npm run dev
```

Then open the Vite URL shown in the terminal.

For recommendation development, rebuild the index after importing or changing a substantial number of papers:

```powershell
python -m scripts.rebuild_recommendation
```
