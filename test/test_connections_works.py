"""Connections data: local prior/derivative clustering and the
OpenAlex web neighborhood.

Run from the project root:

    .venv/bin/python -m unittest test.test_connections_works -v
"""

import os
import tempfile
import unittest
from unittest import mock

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.models import Base, Paper, PaperCitation
from app.services.citations import clustered_works
from app.services.web_connections import fetch_web_neighborhood


class ClusteredWorksTest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()

        self.alpha = Paper(title="Alpha")
        self.beta = Paper(title="Beta")
        self.gamma = Paper(title="Gamma")
        self.db.add_all([self.alpha, self.beta, self.gamma])
        self.db.commit()

        rows = [
            # references (direction="cites")
            (self.alpha.id, "cites", "W1", None, None),
            (self.alpha.id, "cites", "W2", None, None),
            (self.alpha.id, "cites", "W4", "10.9/gamma", self.gamma.id),
            (self.beta.id, "cites", "W1", None, None),
            (self.beta.id, "cites", "W4", "10.9/gamma", self.gamma.id),
            (self.gamma.id, "cites", "W1", None, None),
            # citers (direction="cited_by")
            (self.alpha.id, "cited_by", "W9", None, None),
            (self.beta.id, "cited_by", "W9", None, None),
            (self.beta.id, "cited_by", "W8", "10.5555/x", None),
            (self.gamma.id, "cited_by", "W9", None, None),
        ]

        for paper_id, direction, work_id, doi, matched in rows:
            self.db.add(
                PaperCitation(
                    paper_id=paper_id,
                    direction=direction,
                    external_work_id=work_id,
                    external_doi=doi,
                    matched_paper_id=matched,
                )
            )

        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_prior_works_cluster_by_mention_count(self):
        prior, _ = clustered_works(
            self.db,
            [self.alpha.id, self.beta.id, self.gamma.id],
        )

        by_work = {work["work_id"]: work for work in prior}

        # W1 cited by all three; W4 by two (and matched locally);
        # W2 by one -> excluded.
        self.assertEqual(
            [work["work_id"] for work in prior],
            ["W1", "W4"],
        )
        self.assertEqual(by_work["W1"]["count"], 3)
        self.assertFalse(by_work["W1"]["is_local"])
        self.assertEqual(
            by_work["W1"]["graph_paper_ids"],
            sorted([self.alpha.id, self.beta.id, self.gamma.id]),
        )
        self.assertTrue(by_work["W4"]["is_local"])
        self.assertEqual(by_work["W4"]["label"], "Gamma")
        self.assertEqual(
            by_work["W4"]["matched_paper_id"],
            self.gamma.id,
        )

    def test_derivative_works_cluster_by_mention_count(self):
        _, derivative = clustered_works(
            self.db,
            [self.alpha.id, self.beta.id, self.gamma.id],
        )

        self.assertEqual(
            [work["work_id"] for work in derivative],
            ["W9"],
        )
        self.assertEqual(derivative[0]["count"], 3)

    def test_empty_set_and_min_mentions(self):
        prior, derivative = clustered_works(self.db, [])
        self.assertEqual(prior, [])
        self.assertEqual(derivative, [])

        prior, derivative = clustered_works(
            self.db,
            [self.alpha.id],
            min_mentions=1,
        )
        self.assertEqual(
            {work["work_id"] for work in prior},
            {"W1", "W2", "W4"},
        )
        self.assertEqual(
            {work["work_id"] for work in derivative},
            {"W9"},
        )


class WebNeighbourhoodTest(unittest.TestCase):
    def _fake_fetch(self):
        def fetch(url: str) -> dict:
            if "filter=ids.openalex:" in url:
                return {
                    "results": [
                        {
                            "id": "https://openalex.org/W2",
                            "title": "Prior Two",
                            "doi": None,
                            "publication_year": 2003,
                            "cited_by_count": 50,
                            "authorships": [],
                            "referenced_works": [
                                "https://openalex.org/W9",
                                "https://openalex.org/W10",
                            ],
                        },
                        {
                            "id": "https://openalex.org/W1",
                            "title": "Prior One",
                            "doi": "https://doi.org/10.1/a",
                            "publication_year": 1999,
                            "cited_by_count": 500,
                            "authorships": [
                                {
                                    "author": {
                                        "display_name": "Ada Lovelace",
                                    }
                                }
                            ],
                            "referenced_works": [
                                "https://openalex.org/W9",
                                "https://openalex.org/W10",
                                "https://openalex.org/W11",
                            ],
                        },
                    ]
                }

            if "filter=cites:" in url:
                return {
                    "results": [
                        {
                            "id": "https://openalex.org/W3",
                            "title": "Derivative One",
                            "doi": "https://doi.org/10.2/b",
                            "publication_year": 2020,
                            "cited_by_count": 10,
                            "authorships": [
                                {
                                    "author": {
                                        "display_name": "Grace Hopper",
                                    }
                                }
                            ],
                            "referenced_works": [
                                "https://openalex.org/W100",
                                "https://openalex.org/W1",
                                "https://openalex.org/W9",
                                "https://openalex.org/W10",
                            ],
                        },
                        {
                            "id": "https://openalex.org/W4",
                            "title": "Derivative Two",
                            "doi": None,
                            "publication_year": 2021,
                            "cited_by_count": 5,
                            "authorships": [],
                            "referenced_works": [
                                "https://openalex.org/W9",
                                "https://openalex.org/W10",
                            ],
                        },
                    ]
                }

            if "/doi:" in url:
                return {
                    "id": "https://openalex.org/W100",
                    "title": "Center",
                    "referenced_works": [
                        "https://openalex.org/W2",
                        "https://openalex.org/W1",
                    ],
                    "cited_by_api_url": (
                        "https://api.openalex.org/works?filter=cites:W100"
                    ),
                }

            raise AssertionError(f"unexpected URL: {url}")

        return fetch

    def test_resolves_prior_and_derivative_works(self):
        paper = Paper(id=1, title="Center", doi="10.0/center")

        result = fetch_web_neighborhood(
            paper,
            fetch=self._fake_fetch(),
        )

        self.assertTrue(result["ok"])
        self.assertEqual(result["doi"], "10.0/center")

        # Prior works sorted by OpenAlex citation count, seminal first.
        self.assertEqual(
            [work["work_id"] for work in result["prior_works"]],
            ["W1", "W2"],
        )
        self.assertEqual(
            result["prior_works"][0]["author"],
            "Ada Lovelace",
        )
        self.assertEqual(
            result["prior_works"][0]["doi"],
            "10.1/a",
        )

        self.assertEqual(
            [work["work_id"] for work in result["derivative_works"]],
            ["W3", "W4"],
        )

    def test_builds_inter_work_edges(self):
        paper = Paper(id=1, title="Center", doi="10.0/center")

        result = fetch_web_neighborhood(
            paper,
            fetch=self._fake_fetch(),
        )

        edges = {
            (source, target, kind)
            for source, target, _weight, kind in result["edges"]
        }

        # Star edges.
        self.assertIn(("W1", "center", "ref"), edges)
        self.assertIn(("W2", "center", "ref"), edges)
        self.assertIn(("W3", "center", "cit"), edges)

        # Citer → prior work it also cites.
        self.assertIn(("W3", "W1", "cites"), edges)

        # Priors W1/W2 share W9 + W10 (co-reference).
        self.assertTrue(
            ("W1", "W2", "coref") in edges
            or ("W2", "W1", "coref") in edges
        )

        # Citers W3/W4 share W9 + W10 (co-citation).
        self.assertTrue(
            ("W3", "W4", "cocite") in edges
            or ("W4", "W3", "cocite") in edges
        )

    def test_requires_doi(self):
        result = fetch_web_neighborhood(
            Paper(id=2, title="No DOI", doi=None),
            fetch=self._fake_fetch(),
        )

        self.assertEqual(
            result,
            {"ok": False, "reason": "no_doi"},
        )

    def test_network_failure_is_reported(self):
        def failing_fetch(_url: str) -> dict:
            raise OSError("connection refused")

        result = fetch_web_neighborhood(
            Paper(id=3, title="Center", doi="10.0/center"),
            fetch=failing_fetch,
        )

        self.assertFalse(result["ok"])
        self.assertEqual(result["reason"], "lookup_failed")


class WebConnectionsEndpointTest(unittest.TestCase):
    def setUp(self):
        self._temporary_directory = tempfile.TemporaryDirectory()

        engine = create_engine(
            "sqlite:///"
            + os.path.join(
                self._temporary_directory.name,
                "web.db",
            )
        )
        Base.metadata.create_all(engine)
        self.db = sessionmaker(bind=engine)()
        self.addCleanup(self.db.close)
        self.addCleanup(engine.dispose)
        self.addCleanup(self._temporary_directory.cleanup)

        self.paper = Paper(
            title="Center",
            doi="10.0/center",
            is_valid_for_recommendation=True,
        )
        self.db.add(self.paper)
        self.db.commit()

    def _client(self):
        from fastapi.testclient import TestClient

        from app.api import app
        from app.database import get_session

        def override_get_session():
            yield self.db

        app.dependency_overrides[get_session] = override_get_session
        self.addCleanup(app.dependency_overrides.clear)

        return TestClient(app)

    def test_endpoint_returns_service_payload(self):
        payload = {
            "ok": True,
            "doi": "10.0/center",
            "work_id": "W100",
            "prior_works": [{"work_id": "W1"}],
            "derivative_works": [],
        }

        with mock.patch(
            "app.api.fetch_web_neighborhood",
            return_value=payload,
        ):
            response = self._client().get(
                f"/api/papers/{self.paper.id}/web-connections"
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["paper_id"], self.paper.id)
        self.assertEqual(body["prior_works"], [{"work_id": "W1"}])

    def test_endpoint_maps_no_doi_to_400(self):
        with mock.patch(
            "app.api.fetch_web_neighborhood",
            return_value={"ok": False, "reason": "no_doi"},
        ):
            response = self._client().get(
                f"/api/papers/{self.paper.id}/web-connections"
            )

        self.assertEqual(response.status_code, 400)

    def test_similar_graph_nodes_carry_citation_count(self):
        similar = Paper(
            title="Neighbor",
            doi="10.0/neighbor",
            is_valid_for_recommendation=True,
            citation_count=37,
            prepared_text="neighbor prepared text",
        )
        self.db.add(similar)
        self.db.commit()

        self.paper.prepared_text = "center prepared text"
        self.db.commit()

        graph_fixture = {
            "start_id": self.paper.id,
            "edges": [[self.paper.id, similar.id, 0.6]],
            "path_lengths": {self.paper.id: 0.0, similar.id: 0.4},
            "node_paths": {
                self.paper.id: [self.paper.id],
                similar.id: [self.paper.id, similar.id],
            },
            "common_authors": [],
            "common_topics": [],
            "common_references": [],
            "common_citers": [],
        }

        with mock.patch(
            "app.api.run_search",
            return_value=[{"paper": similar, "score": 0.6}],
        ), mock.patch(
            "app.api.build_connected_graph",
            return_value=graph_fixture,
        ), mock.patch(
            "app.api.clustered_works",
            return_value=([], []),
        ), mock.patch(
            "app.api.resolve_work_titles",
            return_value={},
        ):
            response = self._client().get(
                f"/api/papers/{self.paper.id}/similar-graph"
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()

        nodes = {node["id"]: node for node in body["nodes"]}

        self.assertEqual(
            nodes[self.paper.id]["citation_count"],
            None,
        )
        self.assertEqual(
            nodes[similar.id]["citation_count"],
            37,
        )

    def test_endpoint_maps_failure_to_502(self):
        with mock.patch(
            "app.api.fetch_web_neighborhood",
            return_value={"ok": False, "reason": "lookup_failed"},
        ):
            response = self._client().get(
                f"/api/papers/{self.paper.id}/web-connections"
            )

        self.assertEqual(response.status_code, 502)

    def test_endpoint_404s_for_missing_paper(self):
        response = self._client().get(
            "/api/papers/999999/web-connections"
        )
        self.assertEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()


class ResolveWorkTitlesTest(unittest.TestCase):
    """The local graph's prior/derivative labels get real titles.

    One batch OpenAlex lookup, cached in-process; a later offline
    call still resolves the already-cached ids.
    """

    def setUp(self):
        from app.services import web_connections

        self.service = web_connections
        self.service._TITLE_CACHE.clear()
        self.addCleanup(self.service._TITLE_CACHE.clear)

    def test_resolves_missing_titles_and_caches(self):
        calls: list[str] = []

        def fetch(url: str) -> dict:
            calls.append(url)
            return {
                "results": [
                    {
                        "id": "https://openalex.org/W1",
                        "title": "Prior One",
                        "cited_by_count": 5,
                        "authorships": [],
                    },
                    {
                        "id": "https://openalex.org/W2",
                        "title": "Prior Two",
                        "cited_by_count": 2,
                        "authorships": [],
                    },
                ]
            }

        titles = self.service.resolve_work_titles(
            ["W1", "W2", "W3"],
            fetch=fetch,
        )

        self.assertEqual(titles, {"W1": "Prior One", "W2": "Prior Two"})
        self.assertEqual(len(calls), 1)

        def failing(_url: str) -> dict:
            raise OSError("offline")

        cached = self.service.resolve_work_titles(
            ["W1", "W2"],
            fetch=failing,
        )
        self.assertEqual(
            cached,
            {"W1": "Prior One", "W2": "Prior Two"},
        )

    def test_empty_ids_and_resolution_failure(self):
        self.assertEqual(self.service.resolve_work_titles([]), {})

        def failing(_url: str) -> dict:
            raise OSError("offline")

        self.assertEqual(
            self.service.resolve_work_titles(["W9"], fetch=failing),
            {},
        )
