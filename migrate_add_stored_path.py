"""
One-time migration: adds the stored_path column to the existing papers
table without touching any existing rows.

Usage:
    python migrate_add_stored_path.py

Safe to run more than once -- it checks whether the column already
exists first and does nothing if so.
"""

import sqlite3

DB_PATH = "academic_repository.db"
COLUMN_NAME = "stored_path"


def column_exists(cursor, table: str, column: str) -> bool:
    cursor.execute(f"PRAGMA table_info({table})")
    existing_columns = [row[1] for row in cursor.fetchall()]
    return column in existing_columns


def main():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    if column_exists(cursor, "papers", COLUMN_NAME):
        print(f"'{COLUMN_NAME}' already exists on papers -- nothing to do.")
    else:
        cursor.execute(f"ALTER TABLE papers ADD COLUMN {COLUMN_NAME} VARCHAR(500)")
        conn.commit()
        print(f"Added '{COLUMN_NAME}' column to papers. Existing rows are untouched "
              f"(new column defaults to NULL for them).")

    conn.close()


if __name__ == "__main__":
    main()
