from pathlib import Path
import sqlite3
import argparse


BASE_DIR = Path(__file__).resolve().parent.parent
DATABASE_PATH = BASE_DIR / "app" / "data" / "academic_repository.db"


def quote_identifier(identifier: str) -> str:
    """
    Safely quote SQLite table/column identifiers.
    """
    return '"' + identifier.replace('"', '""') + '"'


def main():
    parser = argparse.ArgumentParser(
        description="View SQLite database tables and records."
    )

    parser.add_argument(
        "--show-vectors",
        action="store_true",
        help="Show TF-IDF and SBERT vector columns.",
    )

    args = parser.parse_args()

    print("Using database:", DATABASE_PATH)

    connection = sqlite3.connect(DATABASE_PATH)
    cursor = connection.cursor()

    try:
        tables = cursor.execute(
            """
            SELECT name
            FROM sqlite_master
            WHERE type = 'table'
            AND name NOT LIKE 'sqlite_%'
            ORDER BY name;
            """
        ).fetchall()

        print("\nDATABASE TABLES:")

        for (table_name,) in tables:
            print(f"\n{'=' * 80}")
            print(f"TABLE: {table_name}")
            print(f"{'=' * 80}")

            quoted_table = quote_identifier(table_name)

            # Get table columns
            columns = cursor.execute(
                f"PRAGMA table_info({quoted_table});"
            ).fetchall()

            # SQLite PRAGMA table_info format:
            # cid, name, type, notnull, default_value, primary_key
            column_names = [column[1] for column in columns]

            print("\nColumns:")

            for column in columns:
                column_name = column[1]
                column_type = column[2]

                print(f"  {column_name} | {column_type}")

            # Hide large vector fields unless explicitly requested
            selected_columns = []

            for column_name in column_names:
                column_name_lower = column_name.lower()

                is_vector_column = (
                    "vector" in column_name_lower
                    or "embedding" in column_name_lower
                )

                if args.show_vectors or not is_vector_column:
                    selected_columns.append(column_name)

            if not selected_columns:
                print("\nNo displayable columns found.")
                continue

            quoted_columns = ", ".join(
                quote_identifier(column_name)
                for column_name in selected_columns
            )

            rows = cursor.execute(
                f"""
                SELECT {quoted_columns}
                FROM {quoted_table};
                """
            ).fetchall()

            print("\nRecords:")

            if not rows:
                print("  No records found.")
                continue

            for row_number, row in enumerate(rows, start=1):
                print(f"\n  Record {row_number}:")

                for column_name, value in zip(selected_columns, row):
                    print(f"    {column_name}: {value}")

            hidden_columns = [
                column_name
                for column_name in column_names
                if column_name not in selected_columns
            ]

            if hidden_columns:
                print("\n  Hidden columns:")
                for column_name in hidden_columns:
                    print(f"    - {column_name}")

    finally:
        connection.close()


if __name__ == "__main__":
    main()