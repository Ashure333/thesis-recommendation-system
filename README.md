# Academic Paper Repository & Recommendation System

**Thesis Prototype — Backend Data Layer, PDF Ingestion, Text Representation, and Recommendation Pipelines**

This repository contains the backend data layer, PDF-ingestion pipeline, text-representation components, and recommendation utilities for a locally deployed academic paper repository and recommendation system.

The project is a research prototype for comparing six recommendation configurations based on:

- TF-IDF
- S-BERT
- Metadata-based similarity
- TF-IDF + S-BERT
- TF-IDF + Metadata
- S-BERT + Metadata
- Full hybrid recommendation scoring

> **Note:** The React frontend and API routes are separate parts of the complete system and may be integrated later.

---

## Current Features

The current repository includes:

- SQLite database using SQLAlchemy
- Academic paper storage and browsing
- PDF upload and automatic metadata extraction
- PDF file storage
- Paper validation for recommendation eligibility
- Prepared-text generation
- TF-IDF vector generation
- S-BERT semantic embeddings
- Cosine similarity computation
- Score normalization
- Repository search and sorting
- Filtering of zero-score search results
- Database inspection through a terminal script
- Recommendation-index rebuilding
- PDF upload-flow testing
- Support for viewing database records without printing large vector arrays

---

## Requirements

- Python 3.10 or newer
- Windows PowerShell, macOS Terminal, or Linux Terminal
- Internet connection during the first installation of the S-BERT model
- Sufficient disk space for the S-BERT model and generated vectors

Main dependencies:

- [SQLAlchemy](https://www.sqlalchemy.org/) — SQLite ORM
- [pdfplumber](https://github.com/jsvine/pdfplumber) — PDF text and layout extraction
- [scikit-learn](https://scikit-learn.org/) — TF-IDF vectorization
- [sentence-transformers](https://www.sbert.net/) — S-BERT embeddings
- [joblib](https://joblib.readthedocs.io/) — Saving the TF-IDF vectorizer
- [NumPy](https://numpy.org/) — Numerical processing

---

## Project Structure

```text
Academic-Paper-Repository/

│
├── app/
│   ├── __init__.py
│   │
│   ├── database.py
│   │   └── Database engine and SQLAlchemy session setup
│   │
│   ├── data/
│   │   ├── academic_repository.db
│   │   │   └── SQLite database
│   │   │
│   │   └── tfidf_vectorizer.joblib
│   │       └── Saved TF-IDF vectorizer
│   │
│   ├── models/
│   │   ├── __init__.py
│   │   └── models.py
│   │       └── User, Paper, and PersonalLibrary models
│   │
│   └── services/
│       ├── __init__.py
│       │
│       ├── extraction.py
│       │   └── PDF metadata extraction
│       │
│       ├── validation.py
│       │   └── Paper validation and recommendation eligibility
│       │
│       ├── storage.py
│       │   └── Saves PDFs to storage/papers/
│       │
│       ├── text_preparation.py
│       │   └── Creates normalized prepared text
│       │
│       ├── upload_paper.py
│       │   └── Coordinates extraction, validation, storage, and saving
│       │
│       └── recommendation/
│           ├── __init__.py
│           │
│           ├── similarity.py
│           │   └── Cosine similarity and score normalization
│           │
│           ├── tfidf_pipeline.py
│           │   └── TF-IDF vector generation and storage
│           │
│           └── sbert_pipeline.py
│               └── S-BERT embedding generation and storage
│
├── scripts/
│   ├── __init__.py
│   │
│   ├── init_script.py
│   │   └── Creates database tables
│   │
│   ├── migrate_add_stored_path.py
│   │   └── Adds stored_path to an existing database
│   │
│   ├── rebuild_recommendation_index.py
│   │   └── Rebuilds prepared text, TF-IDF vectors, and S-BERT embeddings
│   │
│   ├── search_papers.py
│   │   └── Searches papers using TF-IDF, S-BERT, or supported pipelines
│   │
│   └── view_database.py
│       └── Displays database contents while hiding large vectors by default
│
├── test/
│   ├── __init__.py
│   └── test_upload_flow.py
│       └── Tests the complete PDF upload flow
│
├── storage/
│   └── papers/
│       └── Stored PDFs named using their paper ID
│
├── requirements.txt
├── sample.pdf
└── README.md
```

> The exact project structure may change as the hybrid recommendation pipelines, API routes, and React frontend are integrated.

---

## Setup — First Time

Open a terminal in the project root:

```powershell
cd "G:\OJT files\TFIDF-SBERT-Metadata-RecommendationSystem"
```

### 1. Create a virtual environment

```powershell
python -m venv .venv
```

### 2. Activate the virtual environment

For Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

If activation is successful, the terminal should show:

```text
(.venv)
```

For macOS/Linux:

```bash
source .venv/bin/activate
```

### 3. Install dependencies

```powershell
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### 4. Initialize the database

If the database does not exist yet:

```powershell
python -m scripts.init_script
```

This creates the required database tables.

> If `app/data/academic_repository.db` already exists and contains the team dataset, do not run the initialization script unnecessarily.

### 5. Run the database migration if needed

If the existing database does not contain the `stored_path` column:

```powershell
python -m scripts.migrate_add_stored_path
```

Run this only when the migration is required.

---

## Database Location

The current database is stored at:

```text
app/data/academic_repository.db
```

The TF-IDF vectorizer is stored at:

```text
app/data/tfidf_vectorizer.joblib
```

Uploaded PDF files are stored at:

```text
storage/papers/
```

The database stores the relative path of each uploaded PDF, for example:

```text
papers/61.pdf
```

The corresponding file is located at:

```text
storage/papers/61.pdf
```

---

## Running the Services and Scripts

The project currently consists of Python services and scripts rather than a running FastAPI or Flask server.

### Run the PDF upload test

From the project root:

```powershell
python -m test.test_upload_flow sample.pdf
```

Use the module format above instead of:

```powershell
python test/test_upload_flow.py sample.pdf
```

The module format helps Python correctly locate the `app` package.

### View the database

```powershell
python -m scripts.view_database
```

This displays the database tables, columns, and records.

Large vector columns such as:

- `tfidf_vector`
- `sbert_vector`

are hidden by default to prevent the terminal from being flooded with long numerical arrays.

To display the vectors intentionally:

```powershell
python -m scripts.view_database --show-vectors
```

> Hiding the vectors only affects terminal output. The vector data remains stored in the database and is still available to the recommendation pipelines.

### Rebuild the recommendation index

```powershell
python -m scripts.rebuild_recommendation_index
```

This command:

1. Loads papers from the database.
2. Refreshes each paper’s `prepared_text`.
3. Generates TF-IDF vectors.
4. Saves the TF-IDF vectorizer.
5. Generates S-BERT embeddings.
6. Stores the updated representations for recommendation.

Run this command when:

- The dataset is initially imported.
- New papers are added.
- Prepared-text logic changes.
- TF-IDF settings change.
- The S-BERT model changes.
- Existing vectors are missing or outdated.

The first S-BERT run may download the selected model and may take longer than later runs.

---

## Repository Search

The repository includes a command-line search script for testing recommendation pipelines.

### Search using S-BERT

```powershell
python -m scripts.search_papers --pipeline sbert --query "neural networks"
```

### Search using TF-IDF

```powershell
python -m scripts.search_papers --pipeline tfidf --query "neural networks"
```

### Search with a custom number of results

```powershell
python -m scripts.search_papers --pipeline sbert --query "neural networks" --top-k 10
```

The search script displays:

- Ranking number
- Paper title
- Paper ID
- Similarity score
- Publication year
- Author
- Subject category

Results with zero similarity scores are filtered from the displayed results.

Example output format:

```text
================================================================================
Pipeline: SBERT
Results: 8
================================================================================

1. Example Academic Paper
   Paper ID: 18
   Score: 0.097877
   Publication Year: 2000
   Author: N/A
   Subject Category: N/A
```

### Interpreting search scores

Search scores represent the similarity between the query and the paper representation used by the selected pipeline.

- Higher scores indicate stronger similarity.
- Lower positive scores indicate weaker similarity.
- A score of `0.0` indicates no measurable similarity for that representation.
- Search results are ordered from highest to lowest score.

The scores should be interpreted as ranking values, not as percentages or guaranteed measures of research relevance.

---

## PDF Upload and Extraction

To upload a PDF through the complete pipeline:

```powershell
python -m test.test_upload_flow sample.pdf
```

The upload flow performs the following general steps:

```text
PDF file
   ↓
PDF text extraction
   ↓
Title, Abstract, Keywords, and Publication Year extraction
   ↓
Paper validation
   ↓
Prepared-text generation
   ↓
Database record creation
   ↓
PDF file storage
   ↓
TF-IDF/S-BERT indexing when rebuilt
```

The uploaded PDF is stored using its paper ID:

```text
storage/papers/<paper_id>.pdf
```

For example:

```text
storage/papers/61.pdf
```

The database stores the relative path:

```text
papers/61.pdf
```

---

## Automatically Extracted Fields

The PDF extraction pipeline currently attempts to extract:

- Title
- Abstract
- Keywords
- Publication Year

The extraction uses heuristic and regular-expression-based methods, including:

- Page-one title detection
- Abstract-heading detection
- Keyword-label detection
- Publication-year matching

This is a prototype approach and may not work perfectly with:

- Scanned PDFs
- Image-only PDFs
- Unusual academic layouts
- Missing section headings
- Poorly formatted documents
- PDFs with unusual text encoding
- Multi-column documents
- Documents with embedded or nonstandard fonts

A paper record may still be created when extraction is incomplete.

If required fields are missing, the paper is marked as:

```text
is_valid_for_recommendation = False
```

The missing fields are stored in:

```text
missing_fields
```

The current recommendation-validity requirements are:

- Title
- Abstract
- Keywords
- Publication Year

---

## Fields Not Automatically Extracted

The following fields are currently outside the automatic PDF-extraction scope:

- Author
- DOI
- Subject/Category
- Document Type
- Citation Count

These fields are intended to be completed manually during dataset curation or through a future metadata-completion interface.

The `Subject/Category` field may be used for dataset organization, filtering, metadata analysis, and future hybrid recommendation scoring. It should not be assumed to be automatically available for every uploaded paper.

---

## Text Representation

The recommendation system uses the following text-preparation process:

```text
Title + Abstract + Keywords
          ↓
Text normalization
          ↓
prepared_text
          ↓
TF-IDF vector and S-BERT embedding
```

### Prepared Text

The `text_preparation.py` service combines the paper’s title, abstract, and keywords into one normalized text string.

The text is generally:

- Converted to lowercase
- Cleaned of punctuation
- Normalized for whitespace
- Stored in the `prepared_text` field

### TF-IDF Representation

TF-IDF converts each paper’s prepared text into a numerical vector based on word importance across the dataset.

The fitted vectorizer is saved for later use by the recommendation system:

```text
app/data/tfidf_vectorizer.joblib
```

### S-BERT Representation

S-BERT converts the prepared text into a semantic embedding.

This representation is intended to capture meaning and contextual similarity between papers, even when they do not use exactly the same words.

The generated embedding is stored in the paper record through the `sbert_vector` field.

---

## Recommendation Pipelines

The current system supports the development and testing of the following recommendation configurations:

| Pipeline          | Description                                           |
| ----------------- | ----------------------------------------------------- |
| TF-IDF            | Uses lexical similarity based on word importance      |
| S-BERT            | Uses semantic similarity based on text embeddings     |
| TF-IDF + S-BERT   | Combines lexical and semantic similarity              |
| TF-IDF + Metadata | Combines lexical similarity with metadata similarity  |
| S-BERT + Metadata | Combines semantic similarity with metadata similarity |
| Full Hybrid       | Combines TF-IDF, S-BERT, and metadata similarity      |

Metadata-based similarity is intended to be used as part of a hybrid configuration rather than as an independent text-representation pipeline.

The exact weighting scheme for each hybrid configuration should remain consistent with the current thesis methodology and implementation.

---

## Unit Testing and Smoke Testing

### Test the PDF upload flow

```powershell
python -m test.test_upload_flow sample.pdf
```

The test checks:

- Whether the PDF can be read
- Whether metadata can be extracted
- Whether the database record is created
- Whether the PDF is copied to `storage/papers/`
- Whether the file exists on disk
- Whether the paper is valid for recommendation
- Whether repository queries work

### Check stored PDFs

```powershell
Get-ChildItem .\storage\papers
```

### Search for all PDFs in the project

```powershell
Get-ChildItem -Recurse -Filter *.pdf
```

### Check the storage paths

```powershell
python -c "from app.services.storage import BASE_DIR, STORAGE_ROOT, PAPERS_DIR; print('BASE_DIR:', BASE_DIR); print('STORAGE_ROOT:', STORAGE_ROOT); print('PAPERS_DIR:', PAPERS_DIR)"
```

The expected output should point to the project root:

```text
BASE_DIR: ...\TFIDF-SBERT-Metadata-RecommendationSystem
STORAGE_ROOT: ...\TFIDF-SBERT-Metadata-RecommendationSystem\storage
PAPERS_DIR: ...\TFIDF-SBERT-Metadata-RecommendationSystem\storage\papers
```

### Test the recommendation-index rebuild

```powershell
python -m scripts.rebuild_recommendation_index
```

A successful run should complete without import, dependency, or model errors and should update the paper representations.

### Test repository search

```powershell
python -m scripts.search_papers --pipeline sbert --query "neural networks"
```

```powershell
python -m scripts.search_papers --pipeline tfidf --query "neural networks"
```

These commands verify that:

- The selected pipeline can load.
- The query can be processed.
- Stored representations can be accessed.
- Similarity scores can be calculated.
- Results can be sorted.
- Zero-score results can be filtered from the output.

---

## Common Terminal Issues

### `ModuleNotFoundError: No module named 'app'`

Run scripts from the project root using the module format:

```powershell
python -m test.test_upload_flow sample.pdf
```

Do not run:

```powershell
python test/test_upload_flow.py sample.pdf
```

### `ModuleNotFoundError` for `tfidf_pipeline`

Check that the file is named:

```text
tfidf_pipeline.py
```

Not:

```text
tf-idf_pipeline.py
```

Python module filenames should not contain the hyphen used in `tf-idf_pipeline.py`.

### `ModuleNotFoundError` for `text_preparation`

Confirm that this file exists:

```text
app/services/text_preparation.py
```

### S-BERT model download or installation problems

Ensure that:

- The virtual environment is activated.
- Dependencies are installed.
- Internet access is available during the first model download.
- Sufficient disk space is available.
- The selected S-BERT model can be downloaded from Hugging Face.

A warning such as the following is not necessarily an error:

```text
Warning: You are sending unauthenticated requests to the HF Hub.
```

The model may still load successfully. An HF token is mainly useful for higher rate limits and faster downloads.

### Search returns unrelated papers

Possible causes include:

- The dataset contains few papers related to the query.
- The prepared text is incomplete.
- Abstracts or keywords are missing.
- The embedding was generated before the latest text changes.
- The dataset contains broad mathematical or technical terminology.
- The paper’s content is semantically related but not directly related to the query.

Rebuild the recommendation index after correcting paper text or metadata:

```powershell
python -m scripts.rebuild_recommendation_index
```

### Duplicate papers appear in search results

If multiple paper IDs have the same title and similarity score, inspect the records using:

```powershell
python -m scripts.view_database
```

Repeated upload tests or repeated dataset imports may create duplicate records.

Duplicate detection and cleanup should be handled before final recommendation evaluation.

### Large TF-IDF or S-BERT vectors flood the terminal

Use the database viewer normally:

```powershell
python -m scripts.view_database
```

The viewer hides vector columns by default.

Only use this when the vectors themselves need to be inspected:

```powershell
python -m scripts.view_database --show-vectors
```

---

## Important Development Notes

- This is a research prototype, not a production system.
- Each developer should create their own `.venv`.
- Do not commit `.venv/` or `__pycache__/`.
- The SQLite database is shared by the team.
- Coordinate database changes before pushing or pulling.
- SQLite database files do not merge like normal text files.
- Repeatedly running the upload test adds another paper record each time.
- Duplicate detection should be added before final evaluation.
- Recommendation vectors should be rebuilt after major dataset or pipeline changes.
- The current PDF extractor is heuristic-based and is not a complete machine-learning document parser.
- Scanned-PDF OCR support is not yet included in the current extraction pipeline.
- Metadata fields that are not automatically extracted may contain `None` or `N/A`.
- Hiding vectors in the database viewer does not remove them from the database.
- Search scores are used for ranking and should not automatically be interpreted as percentages.
- The first S-BERT execution may take longer because the model needs to load or download.
- The database should be backed up before migrations, bulk imports, or duplicate cleanup.

---

## Quick Command Reference

Run these commands from the project root:

```powershell
# Activate virtual environment
.\.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Initialize database
python -m scripts.init_script

# Run database migration if required
python -m scripts.migrate_add_stored_path

# Run PDF upload test
python -m test.test_upload_flow sample.pdf

# View database without large vectors
python -m scripts.view_database

# View database including vector columns
python -m scripts.view_database --show-vectors

# Search using S-BERT
python -m scripts.search_papers --pipeline sbert --query "neural networks"

# Search using TF-IDF
python -m scripts.search_papers --pipeline tfidf --query "neural networks"

# Search and request 10 results
python -m scripts.search_papers --pipeline sbert --query "neural networks" --top-k 10

# Rebuild TF-IDF and S-BERT representations
python -m scripts.rebuild_recommendation_index

# Check stored PDFs
Get-ChildItem .\storage\papers

# Search for all PDFs
Get-ChildItem -Recurse -Filter *.pdf
```

---

## Current Development Status

| Component                               | Status                |
| --------------------------------------- | --------------------- |
| SQLite database                         | Implemented           |
| SQLAlchemy models                       | Implemented           |
| PDF upload                              | Implemented           |
| PDF storage                             | Implemented           |
| Metadata extraction                     | Prototype implemented |
| Paper validation                        | Implemented           |
| Prepared text                           | Implemented           |
| TF-IDF pipeline                         | Implemented           |
| S-BERT pipeline                         | Implemented           |
| Cosine similarity                       | Implemented           |
| Score normalization                     | Implemented           |
| Recommendation-index rebuild            | Implemented           |
| Database viewer                         | Implemented           |
| Vector-column hiding in database viewer | Implemented           |
| TF-IDF repository search                | Implemented           |
| S-BERT repository search                | Implemented           |
| Zero-score result filtering             | Implemented           |
| Hybrid recommendation scoring           | In development        |
| Metadata similarity                     | In development        |
| FastAPI/Flask routes                    | To be integrated      |
| React frontend                          | To be integrated      |
| Duplicate-paper detection               | Future improvement    |
| Scanned-PDF OCR support                 | Future improvement    |
| Automated metadata completion           | Future improvement    |
| Recommendation evaluation scripts       | Planned               |
