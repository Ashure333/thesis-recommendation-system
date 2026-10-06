"""
Library Mode feature configuration.

Library Mode is the visitor-facing, "smarter librarian" side of the
app. The site admin decides, per feature, how it appears there:

    "shown"  -> normal nav entry and access
    "locked" -> visible but disabled, advertised as a Researcher Mode
                capability (the nav entry and route show a lock panel)
    "hidden" -> not present at all

Researcher Mode ignores these states entirely. The mapping is stored
as a single JSON row in site_settings so the feature list can grow
without schema changes.
"""

import json

from sqlalchemy.orm import Session

from app.models.models import SiteSetting

# Keep in sync with frontend/src/data/siteFeatures.ts.
FEATURE_KEYS = (
    "search",
    "repository",
    "library",
    "faq",
    "settings",
    "changelog",
    "upload",
    "arena",
    "lab",
    "walkthrough",
    "engine",
)

FEATURE_STATES = ("shown", "locked", "hidden")

_SETTING_KEY = "library_features"

# The basic librarian features stay open; everything pro starts
# hidden in Library Mode -- the LIBRARY / RESEARCHER toggle in the
# top bar is the doorway, and the admin can still choose "locked" to
# advertise a feature with a padlock instead.
DEFAULT_LIBRARY_FEATURES: dict[str, str] = {
    "search": "shown",
    "repository": "shown",
    "library": "shown",
    "faq": "shown",
    "settings": "shown",
    "changelog": "shown",
    "upload": "hidden",
    "arena": "hidden",
    "lab": "hidden",
    "walkthrough": "hidden",
    "engine": "hidden",
}


def default_features() -> dict[str, str]:
    return dict(DEFAULT_LIBRARY_FEATURES)


def get_library_features(db: Session) -> dict[str, str]:
    """Stored states merged over defaults; corrupt rows fall back."""
    row = (
        db.query(SiteSetting)
        .filter(SiteSetting.key == _SETTING_KEY)
        .first()
    )

    stored: dict = {}

    if row:
        try:
            raw = json.loads(row.value)
            if isinstance(raw, dict):
                stored = raw
        except (TypeError, ValueError):
            stored = {}

    features = default_features()

    for key in FEATURE_KEYS:
        state = stored.get(key)
        if state in FEATURE_STATES:
            features[key] = state

    return features


def set_library_features(
    db: Session,
    updates: dict[str, str],
) -> dict[str, str]:
    """Validate and persist a partial feature-state update."""
    unknown = sorted(set(updates) - set(FEATURE_KEYS))

    if unknown:
        raise ValueError(
            f"Unknown feature key(s): {', '.join(unknown)}"
        )

    bad = sorted({value for value in updates.values()} - set(FEATURE_STATES))

    if bad:
        raise ValueError(
            "State must be one of " + ", ".join(FEATURE_STATES)
        )

    features = get_library_features(db)
    features.update(updates)

    payload = json.dumps(features, sort_keys=True)
    row = (
        db.query(SiteSetting)
        .filter(SiteSetting.key == _SETTING_KEY)
        .first()
    )

    if row:
        row.value = payload
    else:
        db.add(SiteSetting(key=_SETTING_KEY, value=payload))

    db.commit()
    return features
