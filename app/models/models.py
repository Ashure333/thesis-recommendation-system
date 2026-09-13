"""
SQLAlchemy ORM models for the Academic Paper Repository & Recommendation System.

Tables:
    - User            : accounts & auth records
    - Paper           : 9 metadata fields + validation + precomputed vectors
    - PersonalLibrary : join table linking users to papers they've saved
"""

from datetime import datetime

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Boolean,
    DateTime,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    email = Column(String(150), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    library_entries = relationship(
        "PersonalLibrary", back_populates="user", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<User id={self.id} username={self.username!r}>"


class Paper(Base):
    __tablename__ = "papers"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # ---- 9 core metadata fields (per thesis spec) ----
    title = Column(String(500), nullable=False)
    author = Column(String(300), nullable=True)
    abstract = Column(Text, nullable=True)
    keywords = Column(Text, nullable=True)          # comma-separated or JSON list
    publication_year = Column(Integer, nullable=True)
    doi = Column(String(100), nullable=True)
    subject_category = Column(String(200), nullable=True)
    document_type = Column(String(100), nullable=True)
    citation_count = Column(Integer, nullable=True)

    # ---- validation tracking ----
    # A paper stays stored even if invalid; this just flags whether it can be
    # used by the Recommendation Layer, and (via missing_fields) why not.
    is_valid_for_recommendation = Column(Boolean, default=False, nullable=False, index=True)
    missing_fields = Column(Text, nullable=True)     # e.g. "abstract, publication_year"

    # ---- upload provenance (for the PDF auto-extraction flow) ----
    source_filename = Column(String(300), nullable=True)   # original uploaded PDF filename, if any
    extraction_method = Column(String(20), nullable=True)  # "auto" (from PDF) or "manual" (typed in)
    stored_path = Column(String(500), nullable=True)        # where the PDF actually lives on disk, e.g. "papers/104.pdf"

    # ---- text prep + precomputed vectors for the recommendation pipeline ----
    # prepared_text = lowercased, whitespace-normalized, punctuation-stripped
    # concatenation of Title + Abstract + Keywords (same text feeds both models).
    prepared_text = Column(Text, nullable=True)
    tfidf_vector = Column(Text, nullable=True)       # JSON-encoded list[float]
    sbert_vector = Column(Text, nullable=True)       # JSON-encoded list[float]

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    library_entries = relationship(
        "PersonalLibrary", back_populates="paper", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<Paper id={self.id} title={self.title[:40]!r}>"


class PersonalLibrary(Base):
    __tablename__ = "personal_library"
    __table_args__ = (
        # a user can only save the same paper once
        UniqueConstraint("user_id", "paper_id", name="uq_user_paper"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    paper_id = Column(Integer, ForeignKey("papers.id"), nullable=False, index=True)
    saved_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="library_entries")
    paper = relationship("Paper", back_populates="library_entries")

    def __repr__(self):
        return f"<PersonalLibrary user_id={self.user_id} paper_id={self.paper_id}>"
