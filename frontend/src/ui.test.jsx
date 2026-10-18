import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { QuestionCard, Report } from "./ui";
import { Runner } from "./Student";
import { percent } from "./api";
afterEach(cleanup);
const q = {
  id: 1,
  title: "The Same Number",
  stem: "What does a score hide?",
  topic: "Learning",
  difficulty: "easy",
  kind: "reflection",
  marks: 10,
  options: [],
  has_hint: false,
};
describe("student interactions", () => {
  it("opens the real question action and displays teacher review type", () => {
    const start = vi.fn();
    render(<QuestionCard q={q} index={0} onStart={start} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Start The Same Number" }),
    );
    expect(start).toHaveBeenCalledOnce();
    expect(screen.getByText(/Teacher review/)).toBeInTheDocument();
  });
  it("retains reasoning across navigation and asks for submission confirmation", () => {
    const second = { ...q, id: 2, title: "Second reflection" };
    render(
      <Runner
        attempt={{
          id: 1,
          items: [q, second],
          answers: {},
          results: {},
          hints: [],
        }}
        setAttempt={vi.fn()}
        run={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "A score hides the process." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Next question/ }));
    expect(screen.getByRole("textbox")).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: /Previous/ }));
    expect(screen.getByRole("textbox")).toHaveValue(
      "A score hides the process.",
    );
    fireEvent.click(screen.getByRole("button", { name: /Next question/ }));
    fireEvent.click(screen.getByRole("button", { name: /Review & submit/ }));
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "1 of 2 questions answered",
    );
    fireEvent.click(screen.getByRole("button", { name: "Keep thinking" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("does not invent solutions for a pending teacher review", () => {
    render(
      <Runner
        attempt={{
          id: 1,
          items: [q],
          answers: { 1: { answer: "My reasoning", confidence: "sure" } },
          results: {
            1: {
              marks: null,
              status: "pending_review",
              deduction: 0,
              diagnostic: "not assessed",
            },
          },
          hints: [],
          submitted_at: "2026-10-18T00:00:00Z",
          earned: 0,
          maximum: 10,
        }}
        setAttempt={vi.fn()}
        run={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(
      screen.getByText("Your teacher will review this reflection"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Reasoning & explanation"),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeDisabled();
  });
  it("shows provisional marks and handles no objective evidence", () => {
    render(
      <Report
        report={{
          maximum: 10,
          earned: 0,
          pending: 1,
          attempted: 1,
          unanswered: 0,
          incorrect: 0,
          accuracy: null,
          time_seconds: 0,
          topics: [],
          difficulties: [],
          history: [],
          calibration: [],
          diagnostics: {},
        }}
      />,
    );
    expect(screen.getByText("1 awaiting teacher review")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(percent(0, 0)).toBe(0);
    expect(percent(2, 5)).toBe(40);
  });
});
