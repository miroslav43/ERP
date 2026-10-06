#!/usr/bin/env python3
"""Recount every answer in form-answers.md and rewrite its "<!-- N chars -->" line.

An answer block is:

    **Short** (max 300)          <- label line: "Short" -> limit 300, "Long" -> limit 1000
    <!-- 287 chars -->           <- rewritten by this script
    The answer text, one paragraph, until the next blank line.

Characters are counted the way a web form counts them (JavaScript string
length = UTF-16 code units), so "ș", "ț" and "€" count as one character each.
Lines inside one answer are joined with a single space (answers should be one line anyway).

Usage:
    python3 tools/count_chars.py              # rewrite counts in place, report
    python3 tools/count_chars.py --check      # do not write; exit 1 if a count is stale or a limit is exceeded
    python3 tools/count_chars.py --final      # as --check, and also fail on any "[TO CONFIRM" left in an answer

A green --check only means the lengths are right. Run --final before pasting:
it is the one that says the text is ready to submit.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

FILE = Path(__file__).resolve().parent.parent / "form-answers.md"
COUNT_RE = re.compile(r"^<!-- (\?|\d+) chars -->$")
LIMITS = {"short": 300, "long": 1000}


def form_length(text: str) -> int:
    """Length as a browser form counts it (UTF-16 code units)."""
    return len(text.encode("utf-16-le")) // 2


def main() -> int:
    final = "--final" in sys.argv
    check_only = "--check" in sys.argv or final
    markers = 0
    lines = FILE.read_text(encoding="utf-8").split("\n")
    out = list(lines)
    problems: list[str] = []
    stale = 0
    answers = 0
    section = "?"

    for i, line in enumerate(lines):
        if line.startswith("## "):
            section = line[3:].strip()
        m = COUNT_RE.match(line)
        if not m:
            continue
        # Label = nearest non-empty line above the counter.
        j = i - 1
        while j >= 0 and not lines[j].strip():
            j -= 1
        label = lines[j].lower() if j >= 0 else ""
        kind = "short" if "short" in label else "long" if "long" in label else None
        # Answer = following lines until a blank line.
        k = i + 1
        body: list[str] = []
        while k < len(lines) and lines[k].strip():
            body.append(lines[k].strip())
            k += 1
        text = " ".join(body)
        n = form_length(text)
        answers += 1
        new = f"<!-- {n} chars -->"
        if line != new:
            stale += 1
            out[i] = new
        if kind is None:
            problems.append(f"{section}: counter at line {i + 1} has no Short/Long label above it")
        elif n > LIMITS[kind]:
            problems.append(f"{section} ({kind}): {n} > {LIMITS[kind]} chars")
        if n == 0:
            problems.append(f"{section} ({kind}): empty answer at line {i + 1}")
        if re.search(r"^\s*([-*+>]|\d+[.)])\s", text) or "**" in text or "`" in text:
            problems.append(f"{section} ({kind}): markdown markup inside the answer text")
        if final and "[TO CONFIRM" in text:
            markers += text.count("[TO CONFIRM")
            problems.append(f"{section} ({kind}): [TO CONFIRM] still in the answer (line {i + 2})")

    if not check_only and stale:
        FILE.write_text("\n".join(out), encoding="utf-8")

    print(f"{answers} answers, {stale} counter(s) {'stale' if check_only else 'updated'}")
    if final:
        print(f"{markers} [TO CONFIRM] marker(s) left in answer text")
    for p in problems:
        print("PROBLEM:", p)
    if problems or (check_only and stale):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
