"""LaTeX text escaping.

Every user-supplied string must pass through escape_latex() before it is
injected into the resume template. This is the only place that knows how
to make arbitrary text safe for LaTeX.
"""

_SPECIAL_CHARS = {
    "&": r"\&",
    "%": r"\%",
    "_": r"\_",
    "#": r"\#",
    "$": r"\$",
    "~": r"\textasciitilde{}",
    "^": r"\textasciicircum{}",
    "\\": r"\textbackslash{}",
    "{": r"\{",
    "}": r"\}",
    # "Smart" typographic punctuation that Word/Google Docs/LinkedIn love
    # to auto-insert on paste. The document's fonts are classic 8-bit
    # Latin Modern (loaded via fontenc[T1]), which have no glyph for
    # these Unicode code points -- tectonic silently drops them ("Missing
    # character... in font ec-lmbx9") rather than erroring, so a pasted
    # en-dash or curly quote would otherwise vanish from the PDF with no
    # warning to the user. Map them to the plain-ASCII/ligature forms
    # LaTeX already knows how to typeset with these fonts.
    "–": "--",  # en dash –
    "—": "---",  # em dash —
    "‘": "`",  # left single quote '
    "’": "'",  # right single quote / apostrophe '
    "“": "``",  # left double quote "
    "”": "''",  # right double quote "
    "…": "...",  # ellipsis …
    " ": " ",  # non-breaking space
}


def escape_latex(text: str) -> str:
    """Escape characters that are special to LaTeX so `text` renders literally.

    Iterates character by character (rather than chained str.replace calls)
    so that backslashes introduced by escaping one character are never
    mistaken for input and re-escaped.
    """
    if text is None:
        return ""

    result = []
    for char in str(text):
        result.append(_SPECIAL_CHARS.get(char, char))
    return "".join(result)
