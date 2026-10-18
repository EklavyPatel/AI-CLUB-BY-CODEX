import json
from pathlib import Path
import pytest
from app.assessment import score, diagnostic, normalize
from app.schemas import QuestionIn


def test_all_source_riddles_and_practice_validate():
    rows = json.loads(
        (Path(__file__).parents[1] / "app/seed_questions.json").read_text()
    )
    assert len(rows) == 7
    for row in rows:
        q = QuestionIn.model_validate(row).model_dump()
        if q["kind"] == "reflection":
            assert (
                score(q, {"answer": "An alternative reasoned argument."})["status"]
                == "pending_review"
            )
            assert q["marks"] == 10 and q["rubric"]
        else:
            for answer in q["accepted_answers"]:
                assert score(q, {"answer": answer})["marks"] == q["marks"]
            assert score(q, {"answer": "invalid"})["marks"] == 0


@pytest.mark.parametrize(
    "correct,confidence,probe,expected",
    [
        (True, "sure", None, "secure evidence"),
        (True, "unsure", None, "fragile evidence"),
        (True, "guessing", None, "fragile evidence"),
        (False, "unsure", None, "acknowledged gap"),
        (False, "sure", None, "needs more evidence"),
        (False, "sure", True, "possible execution slip"),
        (False, "sure", False, "possible misconception"),
    ],
)
def test_matrix(correct, confidence, probe, expected):
    r = {"correct": correct, "status": "graded"}
    if probe is not None:
        r["probe_correct"] = probe
    assert diagnostic({"kind": "choice"}, {"confidence": confidence}, r) == expected


def test_unicode_and_hint_floor():
    assert normalize(" ＴＲＡＮＳＦＥＲ ") == normalize("transfer")
    assert (
        score(
            {"kind": "text", "marks": 2, "hint_cost": 2, "accepted_answers": ["yes"]},
            {"answer": "YES"},
            True,
        )["marks"]
        == 0
    )


@pytest.mark.parametrize(
    "change",
    [
        {"hint_cost": 11},
        {"options": ["yes", "yes"]},
        {"accepted_answers": ["maybe"]},
        {"misconceptions": {"yes": "bad"}},
        {"kind": "reflection", "rubric": ""},
        {"probe": {"stem": "Probe prompt", "options": ["a", "b"], "answer": "c"}},
    ],
)
def test_invalid_config(choice, change):
    with pytest.raises(ValueError):
        QuestionIn.model_validate(choice | change)
