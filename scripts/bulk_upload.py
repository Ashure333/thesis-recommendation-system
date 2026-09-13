"""
Bulk-uploads every PDF in a folder through the same pipeline as
test_upload_flow.py (extraction -> file storage -> validation), one
paper record per file.

Run from your project root:

    python -m scripts.bulk_upload path\\to\\your\\pdf\\folder

Skips a file if a paper with that exact filename has already been
uploaded before (so re-running on the same folder is safe and won't
create duplicates). One PDF failing to process does not stop the rest
of the batch -- the error is printed and the script moves on.
"""

import sys
import os

from app.database import SessionLocal
from app.models.models import Paper
from app.services.upload_paper import upload_paper_from_pdf


def main():
    if len(sys.argv) != 2:
        print("Usage: python -m scripts.bulk_upload path\\to\\your\\pdf\\folder")
        sys.exit(1)

    folder = sys.argv[1]
    if not os.path.isdir(folder):
        print(f"Not a folder: {folder}")
        sys.exit(1)

    pdf_files = sorted(f for f in os.listdir(folder) if f.lower().endswith(".pdf"))
    if not pdf_files:
        print(f"No PDF files found in {folder}")
        sys.exit(0)

    print(f"Found {len(pdf_files)} PDF(s) in {folder}\n")

    db = SessionLocal()
    uploaded, skipped, failed = 0, 0, 0

    try:
        for filename in pdf_files:
            full_path = os.path.join(folder, filename)

            already_exists = (
                db.query(Paper).filter(Paper.source_filename == filename).first()
            )
            if already_exists:
                print(f"SKIP  (already uploaded)  {filename}")
                skipped += 1
                continue

            try:
                paper = upload_paper_from_pdf(db, full_path, filename)
                status = "valid" if paper.is_valid_for_recommendation else f"INVALID (missing: {paper.missing_fields})"
                print(f"OK    id={paper.id:<4} {status:<45} {filename}")
                uploaded += 1
            except Exception as exc:
                print(f"FAIL  {filename}  ->  {exc}")
                failed += 1

        print()
        print(f"Done. Uploaded: {uploaded}   Skipped (duplicates): {skipped}   Failed: {failed}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
