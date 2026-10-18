import re
from typing import Literal
from pydantic import BaseModel, Field, model_validator, field_validator, ConfigDict


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Register(Strict):
    name: str = Field(min_length=1, max_length=100)
    email: str = Field(max_length=254)
    password: str = Field(min_length=10, max_length=128)

    @field_validator("email")
    @classmethod
    def email_valid(cls, v):
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", v):
            raise ValueError("Enter a valid email address")
        return v.lower()


class Login(Strict):
    email: str = Field(max_length=254)
    password: str = Field(max_length=128)


class Probe(Strict):
    stem: str = Field(min_length=5, max_length=5000)
    options: list[str] = Field(min_length=2, max_length=8)
    answer: str

    @model_validator(mode="after")
    def valid(self):
        if (
            len(set(self.options)) != len(self.options)
            or self.answer not in self.options
        ):
            raise ValueError("Probe answer must match a unique option")
        return self


class QuestionIn(Strict):
    title: str = Field(min_length=3, max_length=150)
    stem: str = Field(min_length=5, max_length=10000)
    topic: str = Field(min_length=1, max_length=80)
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    kind: Literal["choice", "text", "reflection"] = "reflection"
    marks: int = Field(default=10, ge=1, le=100)
    options: list[str] = Field(default_factory=list, max_length=12)
    accepted_answers: list[str] = Field(default_factory=list, max_length=50)
    explanation: str = Field(default="", max_length=10000)
    rubric: str = Field(default="", max_length=10000)
    hint: str = Field(default="", max_length=2000)
    hint_cost: int = Field(default=0, ge=0, le=100)
    misconceptions: dict[str, str] = Field(default_factory=dict)
    probe: Probe | None = None
    published: bool = False

    @model_validator(mode="after")
    def valid(self):
        if self.hint_cost > self.marks:
            raise ValueError("Hint deduction cannot exceed marks")
        if any(
            not x.strip() or len(x) > 1000 for x in self.options + self.accepted_answers
        ):
            raise ValueError(
                "Options and accepted answers must contain 1–1000 characters"
            )
        if len(set(self.options)) != len(self.options):
            raise ValueError("Options must be unique")
        if self.kind == "choice" and (
            len(self.options) < 2
            or not self.accepted_answers
            or any(a not in self.options for a in self.accepted_answers)
        ):
            raise ValueError(
                "Choice questions need options and accepted answers drawn from those options"
            )
        if self.kind == "text" and not self.accepted_answers:
            raise ValueError("Text questions need at least one accepted answer")
        if self.kind == "reflection" and not self.rubric:
            raise ValueError("Reflection questions require a grading rubric")
        if any(
            k not in self.options or k in self.accepted_answers
            for k in self.misconceptions
        ):
            raise ValueError("Misconception codes must refer to incorrect options")
        return self


class QuizIn(Strict):
    title: str = Field(min_length=3, max_length=150)
    question_ids: list[int] = Field(min_length=1, max_length=100)
    student_ids: list[int] = Field(default_factory=list, max_length=1000)
    time_limit: int = Field(default=1800, ge=60, le=14400)
    published: bool = False
    reveal_answers: bool = True
    randomize: bool = False

    @model_validator(mode="after")
    def unique(self):
        if len(set(self.question_ids)) != len(self.question_ids):
            raise ValueError("A question may appear only once")
        return self


class Response(Strict):
    answer: str = Field(default="", max_length=10000)
    confidence: Literal["sure", "unsure", "guessing"] = "unsure"


class Answers(Strict):
    answers: dict[str, Response]


class ProbeAnswer(Strict):
    answer: str = Field(max_length=1000)


class Grade(Strict):
    marks: float = Field(ge=0, le=100)
    feedback: str = Field(min_length=1, max_length=5000)
