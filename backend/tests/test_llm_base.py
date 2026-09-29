import pytest

from app.llm.base import Bullet, InvalidBulletSelectionError, SelectedBullet, validate_selected_bullets


def test_valid_selections_pass_through_unchanged():
    bullets = [Bullet(id="b1", text="did a thing", keywords=["x"])]
    selections = [SelectedBullet(bullet_id="b1", rewritten_text="did the thing, mirrored")]

    result = validate_selected_bullets(bullets, selections)

    assert result == selections


def test_unknown_bullet_id_is_rejected():
    bullets = [Bullet(id="b1", text="did a thing", keywords=["x"])]
    selections = [SelectedBullet(bullet_id="does-not-exist", rewritten_text="fabricated")]

    with pytest.raises(InvalidBulletSelectionError):
        validate_selected_bullets(bullets, selections)


def test_one_unknown_id_among_valid_ones_still_rejects_whole_response():
    bullets = [
        Bullet(id="b1", text="did a thing", keywords=["x"]),
        Bullet(id="b2", text="did another thing", keywords=["y"]),
    ]
    selections = [
        SelectedBullet(bullet_id="b1", rewritten_text="ok"),
        SelectedBullet(bullet_id="fabricated-id", rewritten_text="not ok"),
    ]

    with pytest.raises(InvalidBulletSelectionError):
        validate_selected_bullets(bullets, selections)


def test_empty_selection_list_is_valid():
    bullets = [Bullet(id="b1", text="did a thing", keywords=["x"])]
    assert validate_selected_bullets(bullets, []) == []
