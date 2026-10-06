"""Library Mode & site editor API surface.

Covers the admin credential flow (real PBKDF2 login, signed bearer
tokens), announcement CRUD with the public active-only read, the
shown/locked/hidden feature states, and the password change.

Run from the project root:

    .venv/bin/python -m unittest test.test_admin_site -v
"""

import os
import tempfile
import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.models import Base
from app.services.admin_auth import ensure_admin_user


class AdminSiteTest(unittest.TestCase):
    def setUp(self):
        # File-backed (not :memory:) because TestClient runs the app in
        # a worker thread; an in-memory DB can't cross threads.
        self._temporary_directory = tempfile.TemporaryDirectory()

        engine = create_engine(
            "sqlite:///"
            + os.path.join(
                self._temporary_directory.name,
                "admin.db",
            )
        )
        Base.metadata.create_all(engine)
        self.db = sessionmaker(bind=engine)()
        self.addCleanup(self.db.close)
        self.addCleanup(engine.dispose)
        self.addCleanup(self._temporary_directory.cleanup)

        ensure_admin_user(
            self.db,
            username="admin",
            password="secret-pass",
        )

    # ----------------------------------------------------------
    # Helpers
    # ----------------------------------------------------------

    def _client(self):
        from fastapi.testclient import TestClient

        from app.api import app
        from app.database import get_session

        def override_get_session():
            yield self.db

        app.dependency_overrides[get_session] = override_get_session
        self.addCleanup(app.dependency_overrides.clear)

        return TestClient(app)

    def _login(self, password="secret-pass", username="admin"):
        return self._client().post(
            "/api/admin/login",
            json={"username": username, "password": password},
        )

    def _token(self):
        return self._login().json()["token"]

    def _auth(self, token=None):
        return {
            "Authorization": f"Bearer {token or self._token()}",
        }

    # ----------------------------------------------------------
    # Auth
    # ----------------------------------------------------------

    def test_login_me_and_token_rejects(self):
        client = self._client()

        response = self._login()
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["username"], "admin")
        self.assertGreater(payload["expires_at"], 0)

        me = client.get("/api/admin/me", headers=self._auth())
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.json()["username"], "admin")

        missing = client.get("/api/admin/me")
        self.assertEqual(missing.status_code, 401)

        tampered = self._token()[:-1] + (
            "0" if self._token()[-1] != "0" else "1"
        )
        bad = client.get(
            "/api/admin/me",
            headers={"Authorization": f"Bearer {tampered}"},
        )
        self.assertEqual(bad.status_code, 401)

    def test_login_rejects_wrong_password_and_non_admins(self):
        self.assertEqual(
            self._login(password="wrong").status_code,
            401,
        )
        self.assertEqual(
            self._login(username="nobody").status_code,
            401,
        )

        ensure_admin_user(
            self.db,
            username="visitor",
            password="visitor-pass",
        )
        # simulate a non-admin account with the same username path
        from app.models.models import User

        visitor = (
            self.db.query(User)
            .filter(User.username == "visitor")
            .one()
        )
        visitor.is_admin = False
        self.db.commit()

        response = self._login(
            username="visitor",
            password="visitor-pass",
        )
        self.assertEqual(response.status_code, 401)

    def test_admin_endpoints_require_a_token(self):
        client = self._client()

        for method, path in (
            ("get", "/api/admin/announcements"),
            ("get", "/api/admin/library-features"),
        ):
            response = getattr(client, method)(path)
            self.assertEqual(response.status_code, 401, path)

    # ----------------------------------------------------------
    # Announcements
    # ----------------------------------------------------------

    def test_announcement_crud_and_public_read(self):
        client = self._client()
        headers = self._auth()

        first = client.post(
            "/api/admin/announcements",
            headers=headers,
            json={
                "title": "Library closed Friday",
                "body": "We close for maintenance.",
                "level": "important",
            },
        )
        self.assertEqual(first.status_code, 201)
        first_id = first.json()["id"]
        self.assertEqual(first.json()["position"], 0)

        second = client.post(
            "/api/admin/announcements",
            headers=headers,
            json={
                "title": "New databases",
                "body": "Three new collections are live.",
                "active": False,
            },
        )
        self.assertEqual(second.status_code, 201)
        self.assertEqual(second.json()["position"], 1)

        # Public read: active only, in position order.
        public = client.get("/api/library/announcements")
        self.assertEqual(public.status_code, 200)
        self.assertEqual(
            [row["title"] for row in public.json()],
            ["Library closed Friday"],
        )

        # Flip the second on; it now trails the first.
        update = client.put(
            f"/api/admin/announcements/{second.json()['id']}",
            headers=headers,
            json={"active": True, "title": "New databases (live)"},
        )
        self.assertEqual(update.status_code, 200)
        self.assertEqual(update.json()["title"], "New databases (live)")

        public = client.get("/api/library/announcements").json()
        self.assertEqual(
            [row["title"] for row in public],
            ["Library closed Friday", "New databases (live)"],
        )

        # Reorder: move the second to the front.
        reorder = client.put(
            f"/api/admin/announcements/{second.json()['id']}",
            headers=headers,
            json={"position": 0},
        )
        self.assertEqual(reorder.status_code, 200)

        # Delete removes it from both reads.
        delete = client.delete(
            f"/api/admin/announcements/{second.json()['id']}",
            headers=headers,
        )
        self.assertEqual(delete.status_code, 200)

        admin_list = client.get(
            "/api/admin/announcements",
            headers=headers,
        ).json()
        self.assertEqual([row["id"] for row in admin_list], [first_id])

        missing = client.delete(
            f"/api/admin/announcements/{second.json()['id']}",
            headers=headers,
        )
        self.assertEqual(missing.status_code, 404)

    def test_announcement_validation(self):
        client = self._client()
        headers = self._auth()

        empty_title = client.post(
            "/api/admin/announcements",
            headers=headers,
            json={"title": "", "body": "Body"},
        )
        self.assertEqual(empty_title.status_code, 422)

        bad_level = client.post(
            "/api/admin/announcements",
            headers=headers,
            json={"title": "T", "body": "B", "level": "urgent"},
        )
        self.assertEqual(bad_level.status_code, 422)

    # ----------------------------------------------------------
    # Feature states
    # ----------------------------------------------------------

    def test_feature_states_default_and_roundtrip(self):
        client = self._client()

        public = client.get("/api/site/library-features")
        self.assertEqual(public.status_code, 200)
        defaults = public.json()["features"]
        self.assertEqual(defaults["search"], "shown")
        self.assertEqual(defaults["lab"], "hidden")
        self.assertEqual(defaults["engine"], "hidden")

        headers = self._auth()

        update = client.put(
            "/api/admin/library-features",
            headers=headers,
            json={"features": {"lab": "locked", "upload": "shown"}},
        )
        self.assertEqual(update.status_code, 200)
        features = update.json()["features"]
        self.assertEqual(features["lab"], "locked")
        self.assertEqual(features["upload"], "shown")
        # Untouched keys keep their defaults.
        self.assertEqual(features["arena"], "hidden")

        persisted = client.get(
            "/api/site/library-features",
        ).json()["features"]
        self.assertEqual(persisted, features)

        bad_state = client.put(
            "/api/admin/library-features",
            headers=headers,
            json={"features": {"lab": "disabled"}},
        )
        self.assertEqual(bad_state.status_code, 422)

        bad_key = client.put(
            "/api/admin/library-features",
            headers=headers,
            json={"features": {"teleporter": "shown"}},
        )
        self.assertEqual(bad_key.status_code, 422)

    # ----------------------------------------------------------
    # Password change
    # ----------------------------------------------------------

    def test_password_change(self):
        client = self._client()

        wrong = client.post(
            "/api/admin/password",
            headers=self._auth(),
            json={
                "current_password": "nope",
                "new_password": "long-enough-pass",
            },
        )
        self.assertEqual(wrong.status_code, 400)

        short = client.post(
            "/api/admin/password",
            headers=self._auth(),
            json={
                "current_password": "secret-pass",
                "new_password": "short",
            },
        )
        self.assertEqual(short.status_code, 422)

        changed = client.post(
            "/api/admin/password",
            headers=self._auth(),
            json={
                "current_password": "secret-pass",
                "new_password": "long-enough-pass",
            },
        )
        self.assertEqual(changed.status_code, 200)

        self.assertEqual(
            self._login(password="secret-pass").status_code,
            401,
        )
        self.assertEqual(
            self._login(password="long-enough-pass").status_code,
            200,
        )


if __name__ == "__main__":
    unittest.main()
