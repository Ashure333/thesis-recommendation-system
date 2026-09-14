from pathlib import Path
import sqlite3

BASE_DIR = Path(__file__).resolve().parent.parent
DATABASE_PATH = BASE_DIR / "app" / "data" / "academic_repository.db"

print("Using database:", DATABASE_PATH)

connection = sqlite3.connect(DATABASE_PATH)
cursor = connection.cursor()

tables = cursor.execute(
    "SELECT name FROM sqlite_master WHERE type='table';"
).fetchall()

print("DATABASE TABLES:")

for (table_name,) in tables:
    print(f"\n--- {table_name} ---")

    columns = cursor.execute(
        f"PRAGMA table_info({table_name});"
    ).fetchall()

    print("Columns:")
    for column in columns:
        print(f"  {column[1]} | {column[2]}")

    rows = cursor.execute(
        f"SELECT * FROM {table_name};"
    ).fetchall()

    print("Records:")
    for row in rows:
        print(f"  {row}")

connection.close()