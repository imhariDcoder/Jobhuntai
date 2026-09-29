import pytest

from app.latex.escape import escape_latex


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("&", r"\&"),
        ("%", r"\%"),
        ("_", r"\_"),
        ("#", r"\#"),
        ("$", r"\$"),
        ("~", r"\textasciitilde{}"),
        ("^", r"\textasciicircum{}"),
        ("\\", r"\textbackslash{}"),
        ("{", r"\{"),
        ("}", r"\}"),
    ],
)
def test_individual_special_characters(raw, expected):
    assert escape_latex(raw) == expected


def test_plain_text_is_unchanged():
    assert escape_latex("Hello World 123") == "Hello World 123"


def test_combination_of_special_characters():
    raw = "100% & C_2H_5 #1 costs $5 ~approx ^2 back\\slash {brace}"
    expected = (
        r"100\% \& C\_2H\_5 \#1 costs \$5 "
        r"\textasciitilde{}approx \textasciicircum{}2 "
        r"back\textbackslash{}slash \{brace\}"
    )
    assert escape_latex(raw) == expected


def test_backslash_is_not_reescaped():
    # A literal backslash followed by "&" must become
    # \textbackslash{} followed by \&, not something that
    # re-escapes the backslash emitted for the escaping itself.
    assert escape_latex("\\&") == r"\textbackslash{}\&"


def test_none_returns_empty_string():
    assert escape_latex(None) == ""


def test_empty_string_returns_empty_string():
    assert escape_latex("") == ""


def test_non_string_input_is_stringified():
    assert escape_latex(42) == "42"


def test_consecutive_special_characters():
    assert escape_latex("&&%%__") == r"\&\&\%\%\_\_"


def test_real_world_bullet_with_ampersand_and_percent():
    raw = "Improved R&D efficiency by 30% using Python & SQL"
    expected = r"Improved R\&D efficiency by 30\% using Python \& SQL"
    assert escape_latex(raw) == expected


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("–", "--"),  # en dash
        ("—", "---"),  # em dash
        ("‘", "`"),  # left single quote
        ("’", "'"),  # right single quote / apostrophe
        ("“", "``"),  # left double quote
        ("”", "''"),  # right double quote
        ("…", "..."),  # ellipsis
        (" ", " "),  # non-breaking space
    ],
)
def test_smart_typographic_punctuation_is_normalized(raw, expected):
    # These Unicode code points have no glyph in the document's classic
    # 8-bit Latin Modern fonts -- tectonic drops them silently ("Missing
    # character... in font ec-lmbx9") instead of erroring, so text pasted
    # from Word/Google Docs/LinkedIn would otherwise vanish from the PDF.
    assert escape_latex(raw) == expected


def test_title_with_pasted_en_dash_is_normalized_to_latex_ligament():
    raw = "Facial Emotion Recognition – Deep Learning & Computer Vision"
    expected = r"Facial Emotion Recognition -- Deep Learning \& Computer Vision"
    assert escape_latex(raw) == expected
