"""
Smoke test for the upload -> storage -> query flow.

Run this from your project root (the folder containing app/, scripts/,
storage/, etc.):

    python test/test_upload_flow.py path/to/some.pdf

It does NOT touch your existing papers -- it only adds one new test
row, uploads the file, checks it landed on disk, then prints your
repository sorted three ways so you can eyeball that everything works.
"""

import sys
import os

from app.database import SessionLocal
from app.services.upload_paper import upload_paper_from_pdf
from app.services.storage import get_paper_file_path
from app.repositories.queries import list_papers


def main():
    if len(sys.argv) != 2:
        print("Usage: python test/test_upload_flow.py path/to/some.pdf")
        sys.exit(1)

    pdf_path = sys.argv[1]
    if not os.path.exists(pdf_path):
        print(f"File not found: {pdf_path}")
        sys.exit(1)

    db = SessionLocal()

    print(f"Uploading {pdf_path} ...")
    paper = upload_paper_from_pdf(db, pdf_path, os.path.basename(pdf_path))

    print()
    print(f"New paper id:        {paper.id}")
    print(f"Title extracted:     {paper.title!r}")
    print(f"stored_path:         {paper.stored_path}")
    print(f"valid for rec.:      {paper.is_valid_for_recommendation}")
    print(f"missing fields:      {paper.missing_fields}")

    full_path = get_paper_file_path(paper.stored_path)
    print(f"file exists on disk: {os.path.exists(full_path)}  ({full_path})")

    print()
    print("--- Repository, alphabetical ---")
    for p in list_papers(db, sort_by="alphabetical"):
        print(f"  {p.id:>3}  {p.title[:60]}")

    print()
    print("--- Repository, date added (default) ---")
    for p in list_papers(db, sort_by="date_added"):
        print(f"  {p.id:>3}  {p.created_at}  {p.title[:50]}")

    print()
    print("--- Repository, publication year ---")
    for p in list_papers(db, sort_by="publication_year"):
        print(f"  {p.id:>3}  {p.publication_year}  {p.title[:50]}")

    db.close()


if __name__ == "__main__":
    main()
