from pathlib import Path

from app.services.extraction import extract_metadata_from_pdf


PDF_PATH = Path(__file__).parent / "21.pdf"


def main():
    if not PDF_PATH.exists():
        print(f"PDF not found: {PDF_PATH}")
        print("Place sample.pdf inside the tests folder.")
        return

    metadata = extract_metadata_from_pdf(
        str(PDF_PATH)
    )

    print("\n========== EXTRACTED METADATA ==========")

    print("\nTITLE:")
    print(metadata.get("title"))

    print("\nABSTRACT:")
    print(metadata.get("abstract"))

    print("\nKEYWORDS:")
    print(metadata.get("keywords"))

    print("\nKEYWORDS SOURCE:")
    print(metadata.get("keywords_source"))

    print("\nKEYWORDS GENERATED:")
    print(metadata.get("keywords_generated"))

    print("\nPUBLICATION YEAR:")
    print(metadata.get("publication_year"))

    print("\n=========================================")

    # Basic checks without pytest
    assert isinstance(metadata, dict)
    assert "title" in metadata
    assert "abstract" in metadata
    assert "keywords" in metadata
    assert "keywords_source" in metadata
    assert "keywords_generated" in metadata
    assert "publication_year" in metadata

    print("\nTEST PASSED: Metadata extraction works.")


if __name__ == "__main__":
    main()