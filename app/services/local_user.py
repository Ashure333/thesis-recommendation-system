"""
Default-user helper for single-user local mode.

Real authentication (Login/Register) isn't built yet, but the `users`
table and `personal_library` foreign keys already require a user_id for
every saved paper. Rather than build throwaway fake-auth logic scattered
through the API routes, this isolates the "who is using the system
right now" question to one function -- when real multi-user auth gets
built later, only this function needs to change (to read the actual
signed-in user instead of returning the same default one every time).
"""

from sqlalchemy.orm import Session

from app.models.models import User

DEFAULT_USERNAME = "local"


def get_or_create_default_user(db: Session) -> User:
    """
    Returns the single local user, creating it on first run. Password is
    a placeholder -- this user is never actually authenticated against,
    since there's no login flow yet.
    """
    user = db.query(User).filter(User.username == DEFAULT_USERNAME).first()
    if user:
        return user

    user = User(
        username=DEFAULT_USERNAME,
        email="local@paperrec.local",
        password_hash="unused-single-user-mode",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
