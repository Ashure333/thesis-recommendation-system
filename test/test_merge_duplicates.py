"""
Offline tests for the duplicate-merge tooling.

Everything runs against in-memory SQLite (or a temp-file SQLite for
the CLI tests) -- no network, no real database. Covers:

    - find_duplicate_groups(): DOI equality, title similarity,
      transitivity, deterministic ordering.
    - choose_master(): PDF > validity > completeness > citations >
      smallest id.
    - merge_group(): non-destructive field filling, library
      move/conflict-drop, citation reassignment including the
      (paper_id, direction, external_work_id) conflict drop, orphaned
      path reporting, and savepoint rollback.
    - merge_all_duplicates(): per-group commit, idempotency, and
      roll back-and-continue on a failing group.
    - scripts/merge_duplicate_papers.py: dry run writes nothing,
      --apply merges, missing DB exits 2.
"""

import io
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.models import (
    Base,
    Paper,
    PaperCitation,
    PersonalLibrary,
    User,
)
from app.services import merge_duplicates
from app.services.duplicate_detection import find_duplicate_groups
from app.services.merge_duplicates import (
    choose_master,
    merge_all_duplicates,
    merge_group,
)
from scripts import merge_duplicate_papers


def _paper(paper_id: int, title: str, **fields) -> Paper:
    paper = Paper(id=paper_id, title=title)

    for name, value in fields.items():
        setattr(paper, name, value)

    return paper


def _citation(
    citation_id: int,
    paper_id: int,
    direction: str,
    work_id: str,
    matched_paper_id=None,
) -> PaperCitation:
    return PaperCitation(
        id=citation_id,
        paper_id=paper_id,
        direction=direction,
        external_work_id=work_id,
        matched_paper_id=matched_paper_id,
    )


class _DbTestCase(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(
            bind=self.engine,
            expire_on_commit=False,
        )()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()


class FindDuplicateGroupsTest(_DbTestCase):
    def test_groups_by_normalized_doi(self):
        self.db.add_all(
            [
                _paper(1, "First Title", doi="10.1000/ABC"),
                _paper(
                    2,
                    "Completely Different Wording",
                    doi="https://doi.org/10.1000/abc",
                ),
                _paper(3, "Unrelated", doi="10.1000/other"),
            ]
        )
        self.db.commit()

        groups = find_duplicate_groups(self.db)

        self.assertEqual(
            [[paper.id for paper in group] for group in groups],
            [[1, 2]],
        )

    def test_groups_by_title_similarity(self):
        title = "Graph Neural Networks for Recommendation Systems"

        self.db.add_all(
            [
                _paper(1, title),
                _paper(2, title),
                _paper(3, "Marine Biology of the Deep Ocean"),
            ]
        )
        self.db.commit()

        groups = find_duplicate_groups(self.db)

        self.assertEqual(
            [[paper.id for paper in group] for group in groups],
            [[1, 2]],
        )

    def test_only_two_plus_groups_sorted_by_smallest_id(self):
        self.db.add_all(
            [
                _paper(5, "Shared Duplicate Title"),
                _paper(3, "A Perfectly Unique Paper"),
                _paper(6, "Shared Duplicate Title"),
                _paper(1, "Another Duplicate"),
                _paper(2, "Another Duplicate"),
            ]
        )
        self.db.commit()

        groups = find_duplicate_groups(self.db)

        self.assertEqual(
            [[paper.id for paper in group] for group in groups],
            [[1, 2], [5, 6]],
        )

    def test_transitive_chain_forms_one_group(self):
        self.db.add_all(
            [
                _paper(1, "Shared Chain Title"),
                _paper(2, "Shared Chain Title", doi="10.1/chain"),
                _paper(
                    3,
                    "Different Wording Entirely",
                    doi="https://doi.org/10.1/CHAIN",
                ),
            ]
        )
        self.db.commit()

        groups = find_duplicate_groups(self.db)

        self.assertEqual(
            [[paper.id for paper in group] for group in groups],
            [[1, 2, 3]],
        )

    def test_blank_titles_and_empty_dois_do_not_group(self):
        self.db.add_all(
            [
                _paper(1, "A Real Title"),
                _paper(2, ""),
                _paper(3, "   ", doi=""),
            ]
        )
        self.db.commit()

        self.assertEqual(find_duplicate_groups(self.db), [])


class ChooseMasterTest(unittest.TestCase):
    def test_stored_path_beats_validity_and_completeness(self):
        rich = _paper(
            1,
            "Rich Metadata",
            author="A",
            abstract="B",
            keywords="C",
            publication_year=2020,
            doi="10.1/rich",
            subject_category="D",
            document_type="E",
            is_valid_for_recommendation=True,
        )
        with_pdf = _paper(
            2,
            "Has PDF",
            stored_path="papers/2.pdf",
            is_valid_for_recommendation=False,
        )

        self.assertEqual(choose_master([rich, with_pdf]).id, 2)

    def test_validity_beats_completeness(self):
        sparse_valid = _paper(
            1, "Sparse", is_valid_for_recommendation=True
        )
        complete_invalid = _paper(
            2,
            "Complete",
            author="A",
            abstract="B",
            keywords="C",
            publication_year=2020,
            doi="10.1/x",
            subject_category="D",
            document_type="E",
            is_valid_for_recommendation=False,
        )

        self.assertEqual(choose_master([complete_invalid, sparse_valid]).id, 1)

    def test_completeness_beats_citation_count(self):
        complete = _paper(1, "Complete", author="A", citation_count=0)
        cited = _paper(2, "Sparse", citation_count=500)

        self.assertEqual(choose_master([complete, cited]).id, 1)

    def test_citation_count_breaks_completeness_tie(self):
        low = _paper(1, "One", author="A", citation_count=3)
        high = _paper(2, "Two", author="B", citation_count=9)

        self.assertEqual(choose_master([low, high]).id, 2)

    def test_unknown_citation_count_loses_to_explicit_zero(self):
        unknown = _paper(1, "One", citation_count=None)
        zero = _paper(2, "Two", citation_count=0)

        self.assertEqual(choose_master([unknown, zero]).id, 2)

    def test_smallest_id_breaks_final_tie(self):
        first = _paper(1, "Same", author="A")
        second = _paper(2, "Same", author="A")

        self.assertEqual(choose_master([second, first]).id, 1)

    def test_empty_input_raises(self):
        with self.assertRaises(ValueError):
            choose_master([])


class MergeGroupTest(_DbTestCase):
    def _seed_pair(self, **dup_fields):
        master = _paper(
            1,
            "Master Title",
            is_valid_for_recommendation=True,
        )
        duplicate = _paper(2, "Duplicate Title", **dup_fields)

        self.db.add_all([master, duplicate])
        self.db.commit()

        return master, duplicate

    def test_fills_only_empty_master_fields(self):
        master, duplicate = self._seed_pair(
            author="Dup Author",
            abstract="dup abstract",
            keywords="ml, nlp",
            publication_year=2019,
        )
        master.abstract = "master abstract"
        self.db.commit()

        result = merge_group(self.db, [master, duplicate])
        self.db.commit()

        self.assertEqual(result["fields_filled"], 3)
        self.assertEqual(result["merged_ids"], [2])

        reloaded = self.db.get(Paper, 1)

        self.assertEqual(reloaded.title, "Master Title")
        self.assertEqual(reloaded.abstract, "master abstract")
        self.assertEqual(reloaded.author, "Dup Author")
        self.assertEqual(reloaded.keywords, "ml, nlp")
        self.assertEqual(reloaded.publication_year, 2019)
        self.assertIsNone(reloaded.doi)
        self.assertIsNone(self.db.get(Paper, 2))

    def test_title_filled_only_when_missing(self):
        master = _paper(
            1, "", is_valid_for_recommendation=True
        )
        duplicate = _paper(2, "The Actual Title")

        self.db.add_all([master, duplicate])
        self.db.commit()

        result = merge_group(self.db, [master, duplicate])
        self.db.commit()

        self.assertEqual(result["fields_filled"], 1)
        self.assertEqual(self.db.get(Paper, 1).title, "The Actual Title")

    def test_library_rows_move_to_master(self):
        master, duplicate = self._seed_pair()
        users = [
            User(
                id=1,
                username="one",
                email="one@example.com",
                password_hash="x",
            ),
            User(
                id=2,
                username="two",
                email="two@example.com",
                password_hash="x",
            ),
        ]
        self.db.add_all(users)
        self.db.flush()
        self.db.add_all(
            [
                PersonalLibrary(id=1, user_id=1, paper_id=2),
                PersonalLibrary(id=2, user_id=2, paper_id=1),
            ]
        )
        self.db.commit()

        result = merge_group(self.db, [master, duplicate])
        self.db.commit()

        self.assertEqual(result["library_moved"], 1)
        self.assertEqual(result["library_dropped"], 0)

        rows = (
            self.db.query(PersonalLibrary)
            .order_by(PersonalLibrary.id)
            .all()
        )
        self.assertEqual(
            [(row.user_id, row.paper_id) for row in rows],
            [(1, 1), (2, 1)],
        )

    def test_library_conflict_drops_duplicate_row(self):
        master, duplicate = self._seed_pair()
        self.db.add(
            User(
                id=1,
                username="one",
                email="one@example.com",
                password_hash="x",
            )
        )
        self.db.flush()
        self.db.add_all(
            [
                PersonalLibrary(id=1, user_id=1, paper_id=1),
                PersonalLibrary(id=2, user_id=1, paper_id=2),
            ]
        )
        self.db.commit()

        result = merge_group(self.db, [master, duplicate])
        self.db.commit()

        self.assertEqual(result["library_moved"], 0)
        self.assertEqual(result["library_dropped"], 1)

        rows = self.db.query(PersonalLibrary).all()
        self.assertEqual(
            [(row.user_id, row.paper_id) for row in rows],
            [(1, 1)],
        )
        self.assertEqual(rows[0].id, 1)

    def test_two_duplicates_same_user_first_moves_second_drops(self):
        master = _paper(
            1, "Shared", is_valid_for_recommendation=True
        )
        duplicate_a = _paper(2, "Shared")
        duplicate_b = _paper(3, "Shared")

        self.db.add_all([master, duplicate_a, duplicate_b])
        self.db.add(
            User(
                id=1,
                username="one",
                email="one@example.com",
                password_hash="x",
            )
        )
        self.db.flush()
        self.db.add_all(
            [
                PersonalLibrary(id=1, user_id=1, paper_id=2),
                PersonalLibrary(id=2, user_id=1, paper_id=3),
            ]
        )
        self.db.commit()

        result = merge_group(
            self.db, [duplicate_b, master, duplicate_a]
        )
        self.db.commit()

        self.assertEqual(result["library_moved"], 1)
        self.assertEqual(result["library_dropped"], 1)

        rows = self.db.query(PersonalLibrary).all()
        self.assertEqual(
            [(row.user_id, row.paper_id) for row in rows],
            [(1, 1)],
        )

    def test_citations_paper_id_and_matched_id_repointed(self):
        master, duplicate = self._seed_pair()
        self.db.add_all(
            [
                _citation(1, 2, "cites", "W1"),
                _citation(
                    2,
                    2,
                    "cited_by",
                    "W2",
                    matched_paper_id=2,
                ),
                _citation(
                    3,
                    1,
                    "cited_by",
                    "W3",
                    matched_paper_id=2,
                ),
            ]
        )
        self.db.commit()

        result = merge_group(self.db, [master, duplicate])
        self.db.commit()

        self.assertEqual(result["citations_moved"], 3)
        self.assertEqual(result["citations_dropped"], 0)

        rows = (
            self.db.query(PaperCitation)
            .order_by(PaperCitation.id)
            .all()
        )
        self.assertEqual([row.paper_id for row in rows], [1, 1, 1])
        self.assertIsNone(rows[0].matched_paper_id)
        self.assertEqual(rows[1].matched_paper_id, 1)
        self.assertEqual(rows[2].matched_paper_id, 1)

    def test_citation_conflict_drops_duplicate_row(self):
        master, duplicate = self._seed_pair()
        self.db.add_all(
            [
                _citation(1, 1, "cites", "W1"),
                _citation(2, 2, "cites", "W1"),
                _citation(3, 2, "cites", "W3"),
            ]
        )
        self.db.commit()

        result = merge_group(self.db, [master, duplicate])
        self.db.commit()

        self.assertEqual(result["citations_dropped"], 1)
        self.assertEqual(result["citations_moved"], 1)

        rows = self.db.query(PaperCitation).all()
        self.assertEqual(
            sorted(row.external_work_id for row in rows),
            ["W1", "W3"],
        )
        self.assertTrue(all(row.paper_id == 1 for row in rows))

    def test_self_referencing_duplicate_row_counts_once(self):
        master, duplicate = self._seed_pair()
        self.db.add(
            _citation(
                1,
                2,
                "cites",
                "W1",
                matched_paper_id=2,
            )
        )
        self.db.commit()

        result = merge_group(self.db, [master, duplicate])
        self.db.commit()

        self.assertEqual(result["citations_moved"], 1)

        row = self.db.query(PaperCitation).one()
        self.assertEqual(row.paper_id, 1)
        self.assertEqual(row.matched_paper_id, 1)

    def test_orphaned_paths_reported_and_files_kept(self):
        with tempfile.TemporaryDirectory() as directory:
            master_path = Path(directory) / "master.pdf"
            duplicate_path = Path(directory) / "duplicate.pdf"
            master_path.write_bytes(b"master")
            duplicate_path.write_bytes(b"duplicate")

            master = _paper(
                1,
                "Master Title",
                stored_path=str(master_path),
                is_valid_for_recommendation=True,
            )
            duplicate = _paper(
                2,
                "Duplicate Title",
                stored_path=str(duplicate_path),
            )
            self.db.add_all([master, duplicate])
            self.db.commit()

            result = merge_group(self.db, [master, duplicate])
            self.db.commit()

            self.assertEqual(
                result["orphaned_paths"], [str(duplicate_path)]
            )
            self.assertEqual(
                self.db.get(Paper, 1).stored_path, str(master_path)
            )
            self.assertTrue(master_path.exists())
            self.assertTrue(duplicate_path.exists())

    def test_duplicate_path_equal_to_master_not_orphaned(self):
        master = _paper(
            1,
            "Master Title",
            stored_path="papers/shared.pdf",
            is_valid_for_recommendation=True,
        )
        same_path = _paper(
            2, "Duplicate Title", stored_path="papers/shared.pdf"
        )
        other_path = _paper(
            3, "Another Duplicate", stored_path="papers/other.pdf"
        )
        self.db.add_all([master, same_path, other_path])
        self.db.commit()

        result = merge_group(
            self.db, [master, same_path, other_path]
        )
        self.db.commit()

        self.assertEqual(
            result["orphaned_paths"], ["papers/other.pdf"]
        )
        self.assertEqual(result["merged_ids"], [2, 3])

    def test_outer_rollback_discards_group(self):
        master, duplicate = self._seed_pair()
        merge_group(self.db, [master, duplicate])

        self.db.rollback()

        self.assertEqual(self.db.query(Paper).count(), 2)
        self.assertEqual(self.db.get(Paper, 2).id, 2)

    def test_fewer_than_two_papers_raises(self):
        paper = _paper(1, "Solo")
        self.db.add(paper)
        self.db.commit()

        with self.assertRaises(ValueError):
            merge_group(self.db, [paper])


class MergeAllDuplicatesTest(_DbTestCase):
    def test_merges_all_groups_and_is_idempotent(self):
        self.db.add_all(
            [
                _paper(1, "Paper One", doi="10.1/one"),
                _paper(
                    2,
                    "Completely Other Wording",
                    doi="https://doi.org/10.1/ONE",
                ),
                _paper(3, "Group Two Title"),
                _paper(4, "Group Two Title"),
            ]
        )
        self.db.commit()

        results = merge_all_duplicates(self.db)

        self.assertEqual(len(results), 2)
        self.assertEqual(
            sorted(result["master_id"] for result in results),
            [1, 3],
        )
        self.assertEqual(self.db.query(Paper).count(), 2)

        self.assertEqual(find_duplicate_groups(self.db), [])
        self.assertEqual(merge_all_duplicates(self.db), [])

    def test_error_in_one_group_rolls_it_back_and_continues(self):
        self.db.add_all(
            [
                _paper(1, "Paper One", doi="10.1/one"),
                _paper(2, "Paper One", doi="10.1/one"),
                _paper(3, "Zeta Unique Title", author="A"),
                _paper(4, "Zeta Unique Title"),
            ]
        )
        self.db.commit()

        real_merge_group = merge_duplicates.merge_group
        calls = {"count": 0}

        def flaky_merge_group(db, papers):
            calls["count"] += 1

            if calls["count"] == 1:
                raise RuntimeError("boom")

            return real_merge_group(db, papers)

        with patch.object(
            merge_duplicates,
            "merge_group",
            side_effect=flaky_merge_group,
        ):
            results = merge_all_duplicates(self.db)

        self.assertEqual(len(results), 2)
        self.assertIn("error", results[0])
        self.assertIn("boom", results[0]["error"])
        self.assertEqual(results[0]["paper_ids"], [1, 2])
        self.assertEqual(results[1]["master_id"], 3)

        remaining = (
            self.db.query(Paper).order_by(Paper.id).all()
        )
        self.assertEqual(
            [paper.id for paper in remaining], [1, 2, 3]
        )


class MergeScriptTest(unittest.TestCase):
    def _seed_file_db(self, path: Path) -> None:
        engine = create_engine(f"sqlite:///{path}")
        Base.metadata.create_all(engine)
        session = sessionmaker(bind=engine)()
        session.add_all(
            [
                _paper(1, "Same Title", author=None),
                _paper(2, "Same Title", author="A"),
            ]
        )
        session.commit()
        session.close()
        engine.dispose()

    def _count_papers(self, path: Path) -> int:
        engine = create_engine(f"sqlite:///{path}")
        session = sessionmaker(bind=engine)()

        try:
            return session.query(Paper).count()
        finally:
            session.close()
            engine.dispose()

    def test_dry_run_then_apply_then_idempotent(self):
        with tempfile.TemporaryDirectory() as directory:
            db_path = Path(directory) / "scratch.db"
            self._seed_file_db(db_path)

            output = io.StringIO()

            with redirect_stdout(output):
                code = merge_duplicate_papers.main(
                    ["--db", str(db_path), "--dry-run"]
                )

            self.assertEqual(code, 0)
            self.assertIn("master id=", output.getvalue())
            self.assertIn("Dry run", output.getvalue())
            self.assertEqual(self._count_papers(db_path), 2)

            output = io.StringIO()

            with redirect_stdout(output):
                code = merge_duplicate_papers.main(
                    ["--db", str(db_path), "--apply"]
                )

            self.assertEqual(code, 0)
            self.assertIn("Merged 1 group", output.getvalue())
            self.assertEqual(self._count_papers(db_path), 1)

            output = io.StringIO()

            with redirect_stdout(output):
                code = merge_duplicate_papers.main(
                    ["--db", str(db_path), "--apply"]
                )

            self.assertEqual(code, 0)
            self.assertIn(
                "No duplicate groups found", output.getvalue()
            )
            self.assertEqual(self._count_papers(db_path), 1)

    def test_missing_database_returns_2(self):
        output = io.StringIO()

        with redirect_stdout(output):
            code = merge_duplicate_papers.main(
                ["--db", "/nonexistent/path/scratch.db"]
            )

        self.assertEqual(code, 2)

    def test_help_exits_zero(self):
        output = io.StringIO()

        with redirect_stdout(output):
            with self.assertRaises(SystemExit) as caught:
                merge_duplicate_papers.main(["--help"])

        self.assertEqual(caught.exception.code, 0)
        self.assertIn("--apply", output.getvalue())


if __name__ == "__main__":
    unittest.main()
