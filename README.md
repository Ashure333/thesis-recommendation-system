# Academic Paper Repository & Recommendation System (Thesis Prototype)

This is the backend data layer and PDF-ingestion pipeline for a locally
deployed academic paper repository with an integrated recommendation
system, developed as a research prototype (not a production system) for
a thesis comparing six hybrid recommendation configurations built from
TF-IDF, S-BERT, and metadata-based similarity.

## What this repo contains right now

This is the **Data Layer** plus the **PDF upload/extraction pipeline**.
The React frontend, FastAPI/Flask API routes, and the recommendation
scoring algorithms (TF-IDF / S-BERT / Metadata components) are separate,
later pieces of the full system architecture and are not part of this
repo yet.

## Dependencies

- Python 3.10+ (developed/tested on 3.13)
- [SQLAlchemy](https://www.sqlalchemy.org/) `>=2.0` — ORM for the SQLite database
- [pdfplumber](https://github.com/jsvine/pdfplumber) `>=0.11` — PDF text/layout extraction

Install everything with:

```bash
pip install -r requirements.txt
```

## Project structure

```
models.py                    SQLAlchemy models: User, Paper, PersonalLibrary
database.py                  DB engine/session setup (SQLite via SQLAlchemy)
validation.py                Checks a paper has Title/Abstract/Keywords/
                              Publication Year; flags it valid/invalid for
                              recommendation accordingly
extraction.py                Auto-extracts Title, Abstract, Keywords, and
                              Publication Year from an uploaded PDF
                              (heuristic/regex-based, not a full ML parser)
storage.py                   Saves uploaded PDF files to storage/papers/,
                              named by paper id
queries.py                   Repository browsing/search: sort by title,
                              date added, or publication year; text search
upload_paper.py              Ties the above together: PDF in -> extraction
                              -> file storage -> validation -> saved record
init_script.py                One-time script: creates the database tables
migrate_add_stored_path.py   One-time migration: adds the stored_path
                              column to an existing database without
                              wiping its data
test_upload_flow.py          Smoke test: uploads a real PDF through the
                              whole pipeline and prints the result
academic_repository.db       The actual SQLite database (included so
                              everyone on the team shares the same data)
storage/papers/              Stored PDF files, one per paper (named
                              <paper_id>.pdf)
sample.pdf                   A sample PDF for testing extraction
```

## Setup — first time

```bash
# 1. Create and activate a virtual environment
python -m venv .venv
.venv\Scripts\Activate.ps1        # Windows PowerShell
# source .venv/bin/activate       # Mac/Linux

# 2. Install dependencies
pip install -r requirements.txt

# 3. Create the database and tables
python init_script.py
```

This creates `academic_repository.db` with three tables (`users`,
`papers`, `personal_library`) and inserts one sample paper to confirm
everything works.

> **If you're cloning this repo and `academic_repository.db` already
> exists** (it's committed to this repo so everyone shares the same
> data), skip `init_script.py` — just install dependencies and go.
> If your local copy of the database predates the `stored_path` column,
> run `python migrate_add_stored_path.py` once to add it without losing
> any existing rows.

## Trying out the PDF upload pipeline

```bash
python test_upload_flow.py sample.pdf
```

This uploads the given PDF through the full flow — extraction, file
storage, validation — and prints:

- what got auto-extracted (Title, Abstract, Keywords, Publication Year)
- whether the file landed on disk correctly
- whether the paper is valid for recommendation, and if not, exactly
  which field(s) are missing
- the repository's contents sorted three different ways (alphabetical,
  date added, publication year), so you can eyeball that it's all wired
  up correctly

It does **not** touch your existing papers — it only adds one new row
per run.

## How the PDF auto-extraction works

When a PDF is uploaded, `extraction.py` tries to pull out exactly four
fields — **Title, Abstract, Keywords, and Publication Year** — using
text-layout heuristics (largest font on page 1 for the title, text
between an "Abstract" heading and the next section for the abstract,
labeled lines for keywords, frequency-based year matching) rather than a
full ML-based parser. This is a deliberate prototype-scope trade-off —
it handles typical academic paper/thesis layouts well, but atypical
layouts (scanned images, unconventional section naming) may leave one or
more fields blank.

A paper record is **always created**, even if extraction is incomplete.
If all four fields extract successfully, the paper is immediately valid
for recommendation. If any fail, the paper is saved with
`is_valid_for_recommendation = False` and `missing_fields` listing
exactly what's missing — at which point `complete_paper_manually()` in
`upload_paper.py` can be used to fill in the gaps by hand and re-validate.

Note: Author, DOI, Subject/Category, Document Type, and Citation Count
are **not** auto-extracted — those are still filled in manually during
dataset curation, since they fall outside PDF auto-extraction scope.

## Notes for contributors

- `.venv/` and `__pycache__/` are gitignored — each person should create
  their own virtual environment locally (see Setup above), not rely on
  a committed one.
- `academic_repository.db` and `storage/papers/` **are** committed, so
  everyone works from the same dataset. If you add/edit papers locally,
  pull before you push to avoid conflicting changes to the database file
  (SQLite databases don't merge like text files do — coordinate with the
  team on who's updating it at a given time).

## Notes for Devs

- run python `python scripts/view_database.py` to view database
