"""Render research-chat citations in the user's chosen style.

The language model is asked to cite with bracket numbers only ([1], [2]).
Those are reliable to validate and link, whereas models routinely ignore
formatting instructions. After the answer is final, `apply_style` rewrites
each bracket group into the style's in-text citation and appends the
matching reference list for the sources the answer actually cites.

Styles are the ones offered in Settings (APA 7, MLA 9, Chicago, IEEE).
Reference entries mirror `citationParts()` in
frontend/src/utils/citationStyles.ts on purpose, so a reference in the chat
reads exactly like the "Copy as" output for the same paper (the repository
keeps one author string per paper, so entries are title-level there too).
In-text forms need surnames, which `surnames()` extracts from that string.
The one departure from Copy-as: an entry lists at most MAX_LISTED_AUTHORS
authors and then says "et al." (collaboration papers have hundreds).

Chicago is rendered author-date in text; its entries keep the Settings
layout (`Author. "Title." Year.`) rather than moving the year after the
author, so they stay identical to Copy-as.
"""

import re
from typing import Literal, Sequence

CitationStyle = Literal["apa", "mla", "chicago", "ieee"]

REFERENCE_HEADINGS = {
    "apa": "References",
    "mla": "Works Cited",
    "chicago": "Bibliography",
    "ieee": "References",
}

SHORT_TITLE_WORDS = 4

# Collaboration papers list hundreds of authors; a reference entry keeps the
# first few and says "et al." (the one deliberate departure from Copy-as).
MAX_LISTED_AUTHORS = 10

_CORPORATE = re.compile(
    r"\b(collaboration|consortium|group|team|committee|organi[sz]ation|"
    r"association|institute|university|society|council|agency|commission)\b",
    re.I,
)

_PARTICLES = {
    "van", "von", "de", "der", "den", "da", "di", "del", "della", "la",
    "le", "du", "dos", "das", "bin", "ibn", "al", "el", "ter", "ten",
    "op", "zu", "zur",
}

# "[1]", "[1, 3]", "[2-4]", "[2–4]" — the chat's own source numbers.
_MARKER = re.compile(r"\[\s*(\d+(?:\s*[,–\-]\s*\d+)*)\s*\]")


# ------------------------------------------------------------------
# Authors
# ------------------------------------------------------------------


def _surname_of(part: str) -> str | None:
    part = part.strip(" ,")

    if not part:
        return None

    if _CORPORATE.search(part):
        return part

    if "," in part:
        surname = part.split(",")[0].strip()

        if len(surname) > 1 and surname.isupper():
            surname = surname.title()

        return surname or None

    tokens = part.split()
    index = len(tokens) - 1

    while index > 0 and tokens[index - 1].lower() in _PARTICLES:
        index -= 1

    return " ".join(tokens[index:])


def _split_comma_list(text: str) -> list[str]:
    """'A B, C D, E F' (first-last names) or 'Last, First, Last, First'."""

    segments = [s.strip() for s in text.split(",") if s.strip()]

    if all(len(s.split()) >= 2 for s in segments):
        return segments

    return [
        ", ".join(segments[i : i + 2]) for i in range(0, len(segments), 2)
    ]


def _split_authors(author: str | None) -> tuple[list[str], str]:
    """Raw author parts plus the joiner that reassembles them."""

    text = re.sub(r"\s+", " ", author or "").strip().strip(",;")

    if not text:
        return [], ""

    if ";" in text:
        parts, joiner = text.split(";"), "; "
    elif re.search(r"\s(?:and|&)\s", text):
        parts, joiner = [], " and "

        for chunk in re.split(r"\s+(?:and|&)\s+", text):
            chunk = chunk.strip(" ,")

            if chunk.count(",") >= 2:
                parts.extend(_split_comma_list(chunk))
            else:
                parts.append(chunk)
    elif text.count(",") >= 2:
        parts, joiner = _split_comma_list(text), ", "
    else:
        parts, joiner = [text], ""

    return [part.strip(" ,") for part in parts if part.strip(" ,")], joiner


def surnames(author: str | None) -> list[str]:
    """Best-effort surnames from the repository's free-form author string."""

    parts, _ = _split_authors(author)

    return [name for name in map(_surname_of, parts) if name]


# ------------------------------------------------------------------
# Reference entries (parity with frontend/src/utils/citationStyles.ts)
# ------------------------------------------------------------------


def is_standalone_work(document_type: str | None) -> bool:
    kind = (document_type or "").lower()

    return any(
        word in kind for word in ("thesis", "dissertation", "report", "book")
    )


def _doi_suffix(style: str, doi: str | None, include_doi: bool) -> str:
    doi = (doi or "").strip()

    if not include_doi or not doi:
        return ""

    return {
        "apa": f" https://doi.org/{doi}",
        "mla": f" DOI: {doi}.",
        "chicago": f" https://doi.org/{doi}.",
        "ieee": f" doi: {doi}.",
    }[style]


def _year(source) -> str:
    return str(source.year) if getattr(source, "year", None) else "n.d."


def _names(source) -> str:
    raw = (getattr(source, "author", None) or "").strip()

    if not raw:
        return "Unknown author"

    parts, joiner = _split_authors(raw)

    if len(parts) > MAX_LISTED_AUTHORS:
        return joiner.join(parts[:MAX_LISTED_AUTHORS]) + " et al."

    return raw


def _work(source) -> str:
    return (getattr(source, "title", None) or "").strip() or "Untitled"


def reference_entry(
    style: str,
    source,
    include_doi: bool = True,
    number: int | None = None,
) -> str:
    names = _names(source)
    when = _year(source)
    work = _work(source)
    doi = _doi_suffix(style, getattr(source, "doi", None), include_doi)
    standalone = is_standalone_work(getattr(source, "document_type", None))

    if style == "apa":
        return f"{names} ({when}). {work}.{doi}"

    if style in ("mla", "chicago"):
        shown = work if standalone else f'"{work}"'

        return f"{names}. {shown}. {when}.{doi}"

    prefix = f"[{number}] " if number is not None else ""

    if standalone:
        return f"{prefix}{names}, {work}, {when}.{doi}"

    return f'{prefix}{names}, "{work}," {when}.{doi}'


# ------------------------------------------------------------------
# In-text citations
# ------------------------------------------------------------------


def _short_title(source) -> str:
    short = " ".join(_work(source).split()[:SHORT_TITLE_WORDS])

    return short.title() if short.isupper() else short


def _in_text_part(style: str, source) -> str:
    names = surnames(getattr(source, "author", None))
    when = _year(source)
    count = len(names)

    if style == "apa":
        if count == 0:
            return f'"{_short_title(source)}," {when}'
        if count == 1:
            return f"{names[0]}, {when}"
        if count == 2:
            return f"{names[0]} & {names[1]}, {when}"
        return f"{names[0]} et al., {when}"

    if style == "mla":
        if count == 0:
            return f'"{_short_title(source)}"'
        if count == 1:
            return names[0]
        if count == 2:
            return f"{names[0]} and {names[1]}"
        return f"{names[0]} et al."

    # chicago, author-date
    if count == 0:
        return f'"{_short_title(source)}" {when}'
    if count == 1:
        return f"{names[0]} {when}"
    if count == 2:
        return f"{names[0]} and {names[1]} {when}"
    if count == 3:
        return f"{names[0]}, {names[1]}, and {names[2]} {when}"
    return f"{names[0]} et al. {when}"


def _sort_key(source) -> tuple[str, str]:
    names = surnames(getattr(source, "author", None))
    lead = names[0] if names else _short_title(source)

    return (lead.lower(), _year(source))


def _expand(group: str) -> list[int]:
    numbers: list[int] = []

    for piece in re.split(r"\s*,\s*", group):
        bounds = re.split(r"\s*[–\-]\s*", piece)

        if len(bounds) == 2 and 0 <= int(bounds[1]) - int(bounds[0]) < 50:
            numbers.extend(range(int(bounds[0]), int(bounds[1]) + 1))
        else:
            numbers.extend(int(b) for b in bounds)

    return numbers


def _runs(answer: str):
    """Yield (start, end, numbers) for each run of adjacent [n] markers."""

    current = None

    for match in _MARKER.finditer(answer):
        numbers = _expand(match.group(1))

        if current and answer[current[1] : match.start()].strip() == "":
            current = (current[0], match.end(), current[2] + numbers)
        else:
            if current:
                yield current

            current = (match.start(), match.end(), numbers)

    if current:
        yield current


def apply_style(
    answer: str,
    sources: Sequence,
    style: str | None,
    include_doi: bool = True,
) -> str:
    """Rewrite [n] markers into `style` and append the reference list."""

    if not style or not sources:
        return answer

    ieee_number: dict[int, int] = {}
    cited: list[int] = []
    pieces: list[str] = []
    cursor = 0

    for start, end, numbers in _runs(answer):
        valid = [n for n in dict.fromkeys(numbers) if 1 <= n <= len(sources)]

        # Swallow spaces/tabs (never newlines) before a marker we drop.
        lead = start

        while lead > cursor and answer[lead - 1] in " \t":
            lead -= 1

        if not valid:
            pieces.append(answer[cursor:lead])
            cursor = end
            continue

        for n in valid:
            if n not in cited:
                cited.append(n)
            ieee_number.setdefault(n, len(ieee_number) + 1)

        if style == "ieee":
            rendered = ", ".join(f"[{ieee_number[n]}]" for n in valid)
        else:
            ordered = sorted(valid, key=lambda n: _sort_key(sources[n - 1]))
            rendered = "(" + "; ".join(
                _in_text_part(style, sources[n - 1]) for n in ordered
            ) + ")"

        pieces.append(answer[cursor:start])
        pieces.append(rendered)
        cursor = end

    pieces.append(answer[cursor:])
    body = "".join(pieces)

    if not cited:
        return body

    if style == "ieee":
        ordered_refs = sorted(cited, key=lambda n: ieee_number[n])
        entries = [
            reference_entry("ieee", sources[n - 1], include_doi, ieee_number[n])
            for n in ordered_refs
        ]
    else:
        ordered_refs = sorted(cited, key=lambda n: _sort_key(sources[n - 1]))
        entries = [
            reference_entry(style, sources[n - 1], include_doi)
            for n in ordered_refs
        ]

    return (
        body
        + f"\n\n{REFERENCE_HEADINGS[style]}\n"
        + "\n".join(entries)
    )
