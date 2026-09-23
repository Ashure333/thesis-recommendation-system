"""
Add missing Paper metadata columns to the existing SQLite database.

This script is safe to run against an existing database:
- Existing columns are left untouched.
- Only missing columns are added.
- Existing paper records are preserved.
"""

from pathlib import Path
import sqlite3


PROJECT_ROOT = Path(__file__).resolve().parent.parent

DATABASE_PATH = (
    PROJECT_ROOT
    / "app"
    / "data"
    / "academic_repository.db"
)


REQUIRED_COLUMNS = {
    "author": "TEXT",
    "abstract": "TEXT",
    "keywords": "TEXT",
    "publication_year": "INTEGER",
    "doi": "TEXT",
    "subject_category": "TEXT",
    "document_type": "TEXT",
    "citation_count": "INTEGER",
}


def main() -> None:
    if not DATABASE_PATH.exists():
        print("Database not found:")
        print(DATABASE_PATH)
        return

    connection = sqlite3.connect(DATABASE_PATH)

    try:
        cursor = connection.cursor()

        cursor.execute("PRAGMA table_info(papers)")
        existing_columns = {
            row[1]
            for row in cursor.fetchall()
        }

        print("Existing Paper columns:")
        for column in sorted(existing_columns):
            print(f"  - {column}")

        added_columns = []

        for column_name, column_type in REQUIRED_COLUMNS.items():
            if column_name in existing_columns:
                print(
                    f"[OK] {column_name} already exists."
                )
                continue

            print(
                f"[ADD] Adding missing column: "
                f"{column_name}"
            )

            cursor.execute(
                f"""
                ALTER TABLE papers
                ADD COLUMN {column_name} {column_type}
                """
            )

            added_columns.append(column_name)

        connection.commit()

        print()
        print("Migration complete.")

        if added_columns:
            print("Added:")
            for column in added_columns:
                print(f"  - {column}")
        else:
            print(
                "No metadata columns were missing."
            )

    finally:
        connection.close()


if __name__ == "__main__":
    main()