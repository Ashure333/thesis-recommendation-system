#!/usr/bin/env python3
"""
md2tex.py -- build the LaTeX edition of the thesis from its Markdown sources.

The Markdown files stay the source of truth. This script converts each of
them to a LaTeX *fragment* (no preamble) that follows the full-thesis
format; the look itself lives in ../thesis-template.sty and ../main.tex
stitches the fragments together.

    python3 thesis-paper/latex/tools/md2tex.py

Reads   thesis-paper/front-matter.md
        thesis-paper/chapters/chapter-{1,2,3}-*.md
        thesis-paper/references.md
        thesis-paper/appendix-a-system-screenshots.md
        thesis-paper/appendix-b-recommendation-math.md
Writes  thesis-paper/latex/front-matter.tex
        thesis-paper/latex/chapters/chapter-{1,2,3}.tex
        thesis-paper/latex/references.tex
        thesis-paper/latex/appendices/appendix-{a,b}.tex
Needs   pandoc >= 3 on PATH (it does the escaping, tables, lists and links).

Nothing is rewritten or reordered: the text, the order of sections and the
reference lists are exactly the Markdown's. The script only adds formatting,
and it asserts its counts (headings, captions, tables, code blocks) so that
a construct it does not understand fails loudly instead of disappearing.
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

LATEX_DIR = Path(__file__).resolve().parents[1]
ROOT = LATEX_DIR.parent  # thesis-paper/

JOBS = [
    dict(
        src=ROOT / "front-matter.md",
        out=LATEX_DIR / "front-matter.tex",
        figure_pages=False,
        frontmatter=True,
    ),
    dict(
        src=ROOT / "chapters" / "chapter-1-the-problem-and-its-background.md",
        out=LATEX_DIR / "chapters" / "chapter-1.tex",
        figure_pages=False,
    ),
    dict(
        src=ROOT / "chapters" / "chapter-2-review-of-related-literature-and-studies.md",
        out=LATEX_DIR / "chapters" / "chapter-2.tex",
        figure_pages=False,
    ),
    dict(
        src=ROOT / "chapters" / "chapter-3-methodology.md",
        out=LATEX_DIR / "chapters" / "chapter-3.tex",
        figure_pages=False,
    ),
    dict(
        src=ROOT / "references.md",
        out=LATEX_DIR / "references.tex",
        figure_pages=False,
        refsonly=True,   # the unified reference list: heading + entries, no chapter
    ),
    dict(
        src=ROOT / "appendix-a-system-screenshots.md",
        out=LATEX_DIR / "appendices" / "appendix-a.tex",
        figure_pages=True,  # one screenshot per page, as in the template
    ),
    dict(
        src=ROOT / "appendix-b-recommendation-math.md",
        out=LATEX_DIR / "appendices" / "appendix-b.tex",
        figure_pages=False,
    ),
]

TEXT_WIDTH_PT = 468.0  # 6.5 in
MONO_ADVANCE_EM = 0.602  # Menlo / DejaVu Sans Mono advance width


# ----------------------------------------------------------------------
# pandoc
# ----------------------------------------------------------------------

def pandoc(markdown: str, shift: int = -2) -> str:
    """Markdown -> LaTeX body. `###` becomes \\section, `####` \\subsection..."""
    result = subprocess.run(
        [
            "pandoc",
            "-f", "markdown+autolink_bare_uris",
            "-t", "latex",
            "--wrap=none",
            "--columns=20",  # forces relative-width (wrapping) table columns
            "--syntax-highlighting=none",
            f"--shift-heading-level-by={shift}",
        ],
        input=markdown,
        text=True,
        capture_output=True,
        check=True,
    )
    return result.stdout


def inline(text: str) -> str:
    """Escape one line of Markdown for use inside a LaTeX argument."""
    return pandoc(text, shift=0).strip()


# ----------------------------------------------------------------------
# splitting a Markdown file
# ----------------------------------------------------------------------

OPENER = re.compile(r"\A# (?P<label>[^\n]+)\n+## (?P<title>[^\n]+)\n", re.M)
REFERENCES = re.compile(r"^## (?P<title>References[^\n]*)\n", re.M)
NEXT_SECTION = re.compile(r"^#{1,3} ", re.M)


def split_source(markdown: str):
    """-> (label, title, body, references_title, references_md, tail)."""
    opener = OPENER.match(markdown)
    if not opener:
        sys.exit("expected '# LABEL' then '## TITLE' at the top of the file")

    rest = markdown[opener.end():]
    refs = REFERENCES.search(rest)

    if not refs:
        return opener["label"], opener["title"], rest, None, "", ""

    body = rest[: refs.start()]
    after = rest[refs.end():]
    boundary = NEXT_SECTION.search(after)

    if boundary:
        refs_md, tail = after[: boundary.start()], after[boundary.start():]
    else:
        refs_md, tail = after, ""

    return opener["label"], opener["title"], body, refs["title"], refs_md, tail


# ----------------------------------------------------------------------
# tables: column widths from the content
# ----------------------------------------------------------------------

def pipe_tables(markdown: str) -> list[list[list[str]]]:
    """Every pipe table as rows of cells (header first, separator dropped)."""
    tables, current = [], []
    for line in markdown.splitlines() + [""]:
        if line.startswith("|"):
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            if all(re.fullmatch(r":?-{3,}:?", c) for c in cells):
                continue
            current.append(cells)
        elif current:
            tables.append(current)
            current = []
    return tables


CHAR_PT = 5.7          # average Times New Roman 12 pt character, with margin
CELL_PAD_PT = 12.0     # 2 x \\tabcolsep


def longest_unbreakable(cells: list[str]) -> int:
    """Longest run of characters in the column that LaTeX cannot break."""
    longest = 0
    for cell in cells:
        # inline code is made breakable at _ . / , by breakable_code()
        splitter = r"[\s._/,]+" if "`" in cell else r"\s+"
        for token in re.split(splitter, cell.replace("`", "").replace("*", "")):
            longest = max(longest, len(token))
    return longest


def column_shares(table: list[list[str]]) -> list[float]:
    """
    Relative column widths. A column needs room in proportion to how much
    text it holds, but a short label column must not be starved: weight =
    the larger of the average cell length and the longest cell capped at 28.
    No column may be narrower than its longest unbreakable word, or that
    word overflows into the next column.
    """
    columns = len(table[0])
    weights, floors = [], []
    for index in range(columns):
        cells = [row[index] for row in table if index < len(row)]
        lengths = [len(cell) for cell in cells]
        average = sum(lengths) / len(lengths)
        weights.append(max(average, min(max(lengths), 28)))
        usable = TEXT_WIDTH_PT - CELL_PAD_PT * columns
        floors.append((longest_unbreakable(cells) * CHAR_PT + CELL_PAD_PT) / usable)

    total = sum(weights)
    shares = [max(weight / total, 0.09) for weight in weights]

    # honour the floors: pin a too-narrow column at its floor, take the
    # difference from the columns that still have slack
    for _ in range(columns):
        deficit = sum(max(floor - share, 0) for share, floor in zip(shares, floors))
        if deficit <= 1e-9:
            break
        slack = [share - floor if share > floor else 0 for share, floor in zip(shares, floors)]
        room = sum(slack)
        shares = [
            floor if share < floor else share - deficit * (extra / room if room else 0)
            for share, floor, extra in zip(shares, floors, slack)
        ]

    total = sum(shares)
    return [share / total for share in shares]


LONGTABLE = re.compile(
    r"(\\begin\{longtable\}\[\]\{@\{\}\n(?:  >\{\\raggedright\\arraybackslash\}"
    r"p\{\(\\linewidth - \d+\\tabcolsep\) \* \\real\{[0-9.]+\}\}\n?)+@\{\}\})"
    r"(.*?)(\\end\{longtable\})",
    re.S,
)


def restyle_tables(tex: str, shares: list[list[float]]) -> str:
    found = LONGTABLE.findall(tex)
    if len(found) != len(shares):
        sys.exit(f"{len(found)} longtables in the LaTeX but {len(shares)} pipe tables in the Markdown")

    queue = iter(shares)

    def one(match: re.Match) -> str:
        spec, body, end = match.groups()
        values = iter(queue.__next__())
        spec = re.sub(r"\\real\{[0-9.]+\}", lambda _m: "\\real{%.4f}" % next(values), spec)
        # bold header row: the cells between \toprule and \midrule
        head, sep, rest = body.partition("\\midrule\\noalign{}")
        head = head.replace("\\raggedright\n", "\\raggedright\\bfseries\n")
        return spec + head + sep + rest + end

    return LONGTABLE.sub(one, tex)


# ----------------------------------------------------------------------
# captions, figures, verbatim blocks
# ----------------------------------------------------------------------

CAPTION_MD = re.compile(r"^(Table|Figure) [A-Za-z0-9][A-Za-z0-9.\-]*$", re.M)
CAPTION_TEX = re.compile(
    r"^(?P<kind>Table|Figure) (?P<num>[A-Za-z0-9][A-Za-z0-9.\-]*)\n\n(?P<title>[^\n]+)\n\n", re.M
)


def captions(tex: str, expected: int, figure_pages: bool) -> str:
    def one(match: re.Match) -> str:
        label = f"{match['kind']} {match['num']}"
        if match["kind"] == "Table":
            macro, option = "tablecap", ""
        elif figure_pages:
            macro, option = "figcappage", ""
        else:
            # a diagram (code block) right after the caption: keep them together
            following = VERBATIM.match(tex, match.end())
            height = verbatim_metrics(following.group(1))[2] if following else 0
            if height > KEEP_TOGETHER_MAX_PT:
                height = 0  # longer than most of a page: it has to break anyway
            macro, option = "figcap", f"[{height:.0f}]" if height else ""
        return f"\\{macro}{option}{{{label}}}{{{match['title']}}}\n\n"

    tex, count = CAPTION_TEX.subn(one, tex)
    if count != expected:
        sys.exit(f"{expected} caption lines in the Markdown but {count} converted")
    return tex


FIGURE = re.compile(
    r"\\pandocbounded\{\\includegraphics\[keepaspectratio,(alt=\{.*?\})\]\{(.*?)\}\}"
)


TEXTTT = re.compile(r"\\texttt\{((?:[^{}]|\{[^{}]*\})*)\}")


def breakable_code(tex: str) -> str:
    """
    Inline code (file paths, event names) has no spaces to break at, so it
    overflows the margin. Allow a break after `_`, `.`, `/` and `,`.
    """
    def one(match: re.Match) -> str:
        body = re.sub(r"(\\_|\.|/|,)", r"\1\\allowbreak{}", match.group(1))
        return "\\texttt{" + body + "}"

    return TEXTTT.sub(one, tex)


def figures(tex: str) -> str:
    return FIGURE.sub(
        r"\\includegraphics[width=\\linewidth,height=0.55\\textheight,keepaspectratio,\1]{\2}", tex
    )


VERBATIM = re.compile(r"\\begin\{verbatim\}\n(.*?)\\end\{verbatim\}", re.S)
TEXT_HEIGHT_PT = 648.0  # 9 in
KEEP_TOGETHER_MAX_PT = 0.7 * TEXT_HEIGHT_PT  # a diagram stays with its caption up to this height
KEEP_BLOCK_MAX_PT = 150.0  # a short formula block is never split; longer ones may break


def verbatim_metrics(code: str) -> tuple[float, float, float]:
    """(font size, leading, block height) for a code block, in points."""
    lines = code.splitlines()
    longest = max(len(line) for line in lines)
    size = min(10.0, TEXT_WIDTH_PT / (MONO_ADVANCE_EM * max(longest, 1)))
    size = max(6.5, int(size * 2) / 2)  # floor to half points
    leading = round(size * 1.2, 1)
    return size, leading, len(lines) * leading + 18.0


def verbatim_blocks(tex: str, expected: int) -> str:
    def one(match: re.Match) -> str:
        code = match.group(1)
        size, leading, height = verbatim_metrics(code)
        # a short block is kept in one piece (long ones may break across pages)
        keep = f"\\Needspace{{{height:.0f}pt}}\n" if height <= KEEP_BLOCK_MAX_PT else ""
        return (
            keep
            + "\\begin{singlespace}\n"
            f"\\begin{{Verbatim}}[fontsize=\\fontsize{{{size}}}{{{leading}}}\\selectfont,"
            "breaklines=true,breakanywhere=true]\n"
            f"{code}\\end{{Verbatim}}\n"
            "\\end{singlespace}"
        )

    tex, count = VERBATIM.subn(one, tex)
    if count != expected:
        sys.exit(f"{expected} fenced code blocks in the Markdown but {count} converted")
    return tex


# ----------------------------------------------------------------------
# one file
# ----------------------------------------------------------------------

def convert(job: dict) -> None:
    markdown = job["src"].read_text(encoding="utf-8")
    label, title, body_md, refs_title, refs_md, tail_md = split_source(markdown)
    stem = job["out"].stem

    def block(markdown_part: str) -> str:
        tex = pandoc(markdown_part)
        tables = pipe_tables(markdown_part)
        fences = len(re.findall(r"^```", markdown_part, re.M))
        if fences % 2:
            sys.exit("unbalanced code fence")
        tex = restyle_tables(tex, [column_shares(t) for t in tables])
        tex = captions(tex, len(CAPTION_MD.findall(markdown_part)), job["figure_pages"])
        tex = figures(tex)
        tex = breakable_code(tex)
        return verbatim_blocks(tex, fences // 2)

    comment = (
        f"% GENERATED by tools/md2tex.py from {job['src'].relative_to(ROOT)}.\n"
        "% Do not edit here: change the Markdown and re-run the script.\n"
    )

    if job.get("refsonly"):
        # The unified thesis reference list: no chapter opener, no body --
        # just a page of its own with the heading and the entries.
        parts = [
            comment,
            "\\clearpage\n",
            "\\phantomsection\n",
            f"\\addcontentsline{{toc}}{{thesisrefs}}{{{inline(title)}}}\n",
            f"\\thesisrefheading{{{inline(title)}}}\n",
            "\\begin{thesisrefs}\n" + pandoc(body_md, shift=0) + "\\end{thesisrefs}\n",
        ]
        emitted_tex = "\n".join(parts)

    elif job.get("frontmatter"):
        # Title page (raw \\thesistitlepage call), acknowledgment at full
        # width, abstract in its narrow centred column, then the TOC.
        tex = block(body_md)
        tex = re.sub(r"\\label\{[^}]*\}", "", tex)
        head, sep, rest = tex.partition("\\section{ABSTRACT}")
        if not sep:
            sys.exit(f"{job['src'].name}: ABSTRACT heading not found")
        abstract, sep2, toc = rest.partition("\\section{TABLE OF CONTENTS}")
        if not sep2:
            sys.exit(f"{job['src'].name}: TABLE OF CONTENTS heading not found")
        tex = (
            head
            + "\\thesisfrontheading{ABSTRACT}\n"
            + "\\begin{thesisabstract}\n"
            + abstract.strip()
            + "\n\\end{thesisabstract}\n"
            + "\\thesisfrontheading{TABLE OF CONTENTS}\n"
            + toc
        )
        tex = re.sub(r"\\section\{([^}]*)\}", r"\\thesisfrontheading{\1}", tex)
        emitted_tex = comment + tex

    else:
        opener = "thesisappendix" if label.startswith("APPENDIX") else "thesischapter"
        parts = [
            comment,
            f"\\{opener}{{{inline(label)}}}{{{inline(title)}}}\n",
        ]
        parts.append(block(body_md))

        if refs_title is not None:
            # The main reference list starts a page of its own; a list that
            # closes an appendix simply follows the text.
            if "Appendix" not in refs_title:
                parts.append("\\clearpage\n")
            parts.append(f"\\thesisrefheading{{{inline(refs_title)}}}\n")
            parts.append("\\begin{thesisrefs}\n" + pandoc(refs_md, shift=0) + "\\end{thesisrefs}\n")

        if tail_md.strip():
            parts.append(block(tail_md))
        emitted_tex = "\n".join(parts)

    # pandoc gives every generated heading the same \label, so anchor names
    # would collide across files; prefix them with the file name.
    emitted_tex = re.sub(
        r"\\label\{([^}]+)\}", lambda m: f"\\label{{{stem}-{m.group(1)}}}", emitted_tex
    )

    job["out"].parent.mkdir(parents=True, exist_ok=True)
    job["out"].write_text(emitted_tex, encoding="utf-8")

    headings = len(re.findall(r"^#{3,6} ", markdown, re.M))
    emitted = len(
        re.findall(
            r"\\(?:sub)*section\{|\\paragraph\{|\\thesisfrontheading\{",
            job["out"].read_text(encoding="utf-8"),
        )
    )
    if headings != emitted:
        sys.exit(f"{job['src'].name}: {headings} headings in the Markdown, {emitted} in the LaTeX")

    print(f"{job['src'].name:62} -> {job['out'].relative_to(LATEX_DIR)}"
          f"  ({headings} headings, {len(pipe_tables(markdown))} tables)")


def main() -> None:
    pandoc_version = subprocess.run(["pandoc", "--version"], capture_output=True, text=True).stdout.splitlines()[0]
    print(pandoc_version)
    for job in JOBS:
        convert(job)


if __name__ == "__main__":
    main()
