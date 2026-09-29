from app.latex.compile import compile_tex_to_pdf
from app.latex.injector import render_resume_tex
from fixtures.dummy_profile import DUMMY_PROFILE


def test_dummy_profile_compiles_to_a_valid_pdf(tmp_path):
    tex = render_resume_tex(DUMMY_PROFILE)
    pdf_path = compile_tex_to_pdf(tex, output_dir=tmp_path)

    assert pdf_path.exists()
    assert pdf_path.stat().st_size > 1000

    with open(pdf_path, "rb") as f:
        header = f.read(5)
    assert header == b"%PDF-"
