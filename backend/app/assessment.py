"""Pure scoring rules. Confidence informs feedback; it never changes marks."""

import unicodedata
from collections import Counter


def normalize(value):
    return " ".join(unicodedata.normalize("NFKC", value).casefold().split())


def score(item, response, used_hint=False):
    answer = response.get("answer", "").strip()
    deduction = item["hint_cost"] if used_hint else 0
    if not answer:
        return {
            "marks": 0,
            "correct": False,
            "status": "unanswered",
            "feedback": "",
            "deduction": deduction,
        }
    if item["kind"] == "reflection":
        return {
            "marks": None,
            "correct": None,
            "status": "pending_review",
            "feedback": "",
            "deduction": deduction,
        }
    correct = normalize(answer) in {normalize(x) for x in item["accepted_answers"]}
    return {
        "marks": max(0, item["marks"] - deduction) if correct else 0,
        "correct": correct,
        "status": "graded",
        "feedback": "",
        "deduction": deduction,
    }


def diagnostic(item, response, result):
    if (
        result["status"] in ("pending_review", "unanswered")
        or item["kind"] == "reflection"
    ):
        return "not assessed"
    sure = response.get("confidence") == "sure"
    if result["correct"]:
        return "secure evidence" if sure else "fragile evidence"
    if not sure:
        return "acknowledged gap"
    if "probe_correct" not in result:
        return "needs more evidence"
    return (
        "possible execution slip"
        if result["probe_correct"]
        else "possible misconception"
    )


def summarize(attempts):
    records = []
    history = []
    for a in attempts:
        if not a.submitted_at:
            continue
        earned = sum(r.get("marks") or 0 for r in a.results.values())
        maximum = sum(i["marks"] for i in a.items)
        history.append(
            {
                "id": a.id,
                "date": a.submitted_at.isoformat() + "Z",
                "earned": earned,
                "maximum": maximum,
                "percentage": round(100 * earned / maximum, 1) if maximum else 0,
                "pending": sum(
                    r["status"] == "pending_review" for r in a.results.values()
                ),
                "duration_seconds": int(
                    (a.submitted_at - a.started_at).total_seconds()
                ),
            }
        )
        for i in a.items:
            k = str(i["id"])
            r = a.results[k]
            response = a.answers.get(k, {})
            records.append(
                {
                    "topic": i["topic"],
                    "difficulty": i["difficulty"],
                    "maximum": i["marks"],
                    "marks": r.get("marks") or 0,
                    "correct": r["correct"],
                    "status": r["status"],
                    "confidence": response.get("confidence"),
                    "diagnostic": diagnostic(i, response, r),
                    "misconception": i.get("misconceptions", {}).get(
                        response.get("answer")
                    )
                    if r["correct"] is False
                    else None,
                }
            )
    total = sum(r["maximum"] for r in records)
    graded = [
        r for r in records if r["correct"] is not None and r["status"] != "unanswered"
    ]

    def groups(field):
        out = []
        for name in sorted({r[field] for r in records}):
            rows = [r for r in records if r[field] == name]
            out.append(
                {
                    "name": name,
                    "earned": sum(r["marks"] for r in rows),
                    "maximum": sum(r["maximum"] for r in rows),
                    "count": len(rows),
                    "diagnostics": dict(Counter(r["diagnostic"] for r in rows)),
                }
            )
        return out

    calibration = []
    for c in ["sure", "unsure", "guessing"]:
        rs = [r for r in graded if r["confidence"] == c]
        calibration.append(
            {
                "confidence": c,
                "count": len(rs),
                "accuracy": round(100 * sum(r["correct"] for r in rs) / len(rs), 1)
                if rs
                else None,
            }
        )
    return {
        "earned": sum(r["marks"] for r in records),
        "maximum": total,
        "percentage": round(100 * sum(r["marks"] for r in records) / total, 1)
        if total
        else 0,
        "correct": sum(r["correct"] is True for r in records),
        "incorrect": sum(
            r["correct"] is False and r["status"] != "unanswered" for r in records
        ),
        "unanswered": sum(r["status"] == "unanswered" for r in records),
        "pending": sum(r["status"] == "pending_review" for r in records),
        "attempted": sum(r["status"] != "unanswered" for r in records),
        "accuracy": round(100 * sum(r["correct"] for r in graded) / len(graded), 1)
        if graded
        else None,
        "time_seconds": sum(h["duration_seconds"] for h in history),
        "topics": groups("topic"),
        "difficulties": groups("difficulty"),
        "history": history,
        "calibration": calibration,
        "diagnostics": dict(Counter(r["diagnostic"] for r in records)),
        "misconceptions": dict(
            Counter(r["misconception"] for r in records if r["misconception"])
        ),
    }
