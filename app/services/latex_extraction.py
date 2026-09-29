"""
LaTeX (.tex) metadata auto-extraction.

Extracts the same four recommendation-signal fields as extraction.py's
PDF path (Title, Abstract, Keywords, Publication Year), but reads them
directly from LaTeX source commands instead of guessing from page
layout. This is generally MORE reliable than the PDF path when a .tex
source file is available, since \\title{...} and \\begin{abstract}
are unambiguous, unlike font-size guessing.

Supports the common ways these fields show up across templates:
    Title:      \\title{...}
    Abstract:   \\begin{abstract}...\\end{abstract}  or  \\abstract{...}
    Keywords:   \\keywords{...}, \\IEEEkeywords{...},
                \\begin{keywords}...\\end{keywords}, or a plain
                "Keywords:" / "Index Terms:" line (same convention as
                the PDF extractor)
    Year:       \\date{...} if it contains a 4-digit year, otherwise
                the most frequently repeated year anywhere in the file

A field that can't be confidently found comes back as None, same
contract as extract_metadata_from_pdf -- validate_paper() then flags
the paper invalid-for-recommendation and lists what's missing.
"""

import re
from datetime import datetime

YEAR_PATTERN = re.compile(r"\b(19[5-9]\d|20[0-4]\d)\b")
KEYWORDS_LINE = re.compile(r"(?:keywords|index terms)\s*[:\-]\s*(.+)", re.IGNORECASE)

# Formatting commands whose CONTENT should be kept (e.g. \textbf{Foo} -> Foo).
_KEEP_CONTENT_COMMANDS = re.compile(
    r"\\(?:textbf|textit|emph|underline|texttt|textsc|textrm)\{([^{}]*)\}"
)
# Commands whose content should be dropped entirely (citations, refs, labels).
_DROP_CONTENT_COMMANDS = re.compile(r"\\(?:cite\w*|ref|label|footnote)\{[^{}]*\}")


def _strip_comments(text: str) -> str:
    """Removes LaTeX '%' comments, respecting '\\%' as a literal percent."""
    lines = []
    for line in text.split("\n"):
        j = 0
        cut_at = None
        while True:
            j = line.find("%", j)
            if j == -1:
                break
            if j == 0 or line[j - 1] != "\\":
                cut_at = j
                break
            j += 1
        lines.append(line[:cut_at] if cut_at is not None else line)
    return "\n".join(lines)


def _find_command_content(text: str, command_name: str) -> str | None:
    """
    Finds \\command_name{...}, matching braces properly (so a nested
    \\title{A \\textbf{B} C} still extracts the whole thing).
    """
    match = re.search(r"\\" + re.escape(command_name) + r"\s*\{", text)
    if not match:
        return None

    start = match.end()
    depth = 1
    i = start
    while i < len(text) and depth > 0:
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
        i += 1

    if depth != 0:
        return None  # unbalanced braces -- bail rather than guess
    return text[start : i - 1]


def _find_environment_content(text: str, env_name: str) -> str | None:
    """Finds \\begin{env_name}...\\end{env_name}."""
    match = re.search(
        r"\\begin\{" + re.escape(env_name) + r"\}(.*?)\\end\{" + re.escape(env_name) + r"\}",
        text,
        re.DOTALL,
    )
    return match.group(1) if match else None


def _clean_latex_text(raw: str | None) -> str | None:
    """Strips LaTeX markup down to plain, readable text."""
    if raw is None:
        return None

    text = raw
    # Repeatedly unwrap keep-content commands to handle simple nesting.
    for _ in range(3):
        new_text = _KEEP_CONTENT_COMMANDS.sub(r"\1", text)
        if new_text == text:
            break
        text = new_text

    text = _DROP_CONTENT_COMMANDS.sub("", text)
    text = re.sub(r"\\[a-zA-Z]+\*?", " ", text)  # any remaining bare commands
    text = text.replace("{", "").replace("}", "").replace("$", "")
    text = text.replace("\\\\", " ")
    text = " ".join(text.split())
    return text.strip() or None


def _extract_title(text: str) -> str | None:
    title = _clean_latex_text(_find_command_content(text, "title"))
    return title if title and len(title) >= 3 else None


def _extract_abstract(text: str) -> str | None:
    raw = _find_environment_content(text, "abstract") or _find_command_content(text, "abstract")
    abstract = _clean_latex_text(raw)
    return abstract if abstract and len(abstract) >= 40 else None


def _extract_keywords(text: str) -> str | None:
    raw = (
        _find_command_content(text, "keywords")
        or _find_command_content(text, "IEEEkeywords")
        or _find_environment_content(text, "keywords")
        or _find_environment_content(text, "IEEEkeywords")
    )
    if raw is None:
        match = KEYWORDS_LINE.search(text)
        if match:
            raw = match.group(1).split("\\\\")[0].split("\n")[0]

    keywords = _clean_latex_text(raw)
    return keywords.strip(" .") or None if keywords else None


def _extract_publication_year(text: str) -> int | None:
    current_year = datetime.now().year

    date_content = _find_command_content(text, "date")
    if date_content:
        match = YEAR_PATTERN.search(date_content)
        if match and int(match.group(1)) <= current_year:
            return int(match.group(1))

    # Fallback: most frequently repeated year anywhere in the file --
    # same reasoning as the PDF extractor (copyright lines, references,
    # etc. tend to repeat the real publication year).
    years = [int(y) for y in YEAR_PATTERN.findall(text) if int(y) <= current_year]
    if not years:
        return None
    return max(set(years), key=years.count)


def extract_metadata_from_tex(tex_path: str) -> dict:
    """
    Runs all four extractors on a .tex file and returns:
        {
            "title": str | None,
            "abstract": str | None,
            "keywords": str | None,
            "publication_year": int | None,
        }
    """
    with open(tex_path, "r", encoding="utf-8", errors="ignore") as f:
        raw_text = f.read()

    text = _strip_comments(raw_text)

    return {
        "title": _extract_title(text),
        "abstract": _extract_abstract(text),
        "keywords": _extract_keywords(text),
        "publication_year": _extract_publication_year(text),
    }
