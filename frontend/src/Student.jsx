import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Search,
  Clock3,
  Lightbulb,
  Save,
  Send,
  CheckCircle2,
  FileText,
  Download,
} from "lucide-react";
import { api, download } from "./api";
import { Heading, Badge, QuestionCard, Empty, Report, Stat } from "./ui";

export default function Student({ page, go, run, refreshKey }) {
  const [questions, setQuestions] = useState([]),
    [quizzes, setQuizzes] = useState([]),
    [report, setReport] = useState(null),
    [attempts, setAttempts] = useState([]),
    [active, setActive] = useState(null),
    [search, setSearch] = useState(""),
    [difficulty, setDifficulty] = useState("all"),
    [kind, setKind] = useState("all"),
    [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true);
    try {
      const [q, z, p, a] = await Promise.all([
        api("/questions"),
        api("/quizzes"),
        api("/progress"),
        api("/attempts"),
      ]);
      setQuestions(q);
      setQuizzes(z);
      setReport(p);
      setAttempts(a);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    run(load);
  }, [refreshKey]);
  useEffect(() => {
    setActive(null);
  }, [page]);
  const open = (path) =>
    run(async () => {
      setLoading(true);
      try {
        setActive(await api(path, { method: "POST" }));
      } finally {
        setLoading(false);
      }
    });
  const resume = (id) =>
    run(async () => {
      setLoading(true);
      try {
        setActive(await api(`/attempts/${id}`));
      } finally {
        setLoading(false);
      }
    });
  const complete = report?.completed_question_ids || [];
  const filtered = questions.filter(
    (q) =>
      `${q.title} ${q.stem} ${q.topic}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (difficulty === "all" || q.difficulty === difficulty) &&
      (kind === "all" || q.kind === kind),
  );
  if (loading)
    return (
      <div className="loading" role="status">
        Gathering your learning space…
      </div>
    );
  if (active)
    return (
      <Runner
        attempt={active}
        setAttempt={setActive}
        run={run}
        onClose={() => {
          setActive(null);
          run(load);
        }}
      />
    );
  if (!report)
    return (
      <Empty title="Could not load your workspace">
        Check the connection and refresh the page.
      </Empty>
    );
  if (page === "progress")
    return (
      <>
        <Heading
          eyebrow="YOUR LEARNING, IN CONTEXT"
          title="More than a mark."
          action={
            <button
              className="button secondary"
              onClick={() =>
                download(
                  new Blob([JSON.stringify(report, null, 2)], {
                    type: "application/json",
                  }),
                  "my-performance-report.json",
                )
              }
            >
              <Download size={16} /> Download report
            </button>
          }
        >
          A clearer picture of what feels solid, and what needs another look.
        </Heading>
        <Report report={report} />
      </>
    );
  if (page === "history")
    return (
      <>
        <Heading
          eyebrow="A RECORD OF YOUR THINKING"
          title="Every attempt counts."
        >
          Revisit your responses, feedback, and next steps.
        </Heading>
        <section className="panel">
          {attempts.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Activity</th>
                    <th>Started</th>
                    <th>Status</th>
                    <th>Marks</th>
                    <th>Review</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <strong>
                          {a.items.length === 1
                            ? a.items[0].title
                            : `Quiz · ${a.items.length} questions`}
                        </strong>
                        <small>Attempt #{a.id}</small>
                      </td>
                      <td>{new Date(a.started_at).toLocaleDateString()}</td>
                      <td>
                        <Badge tone={a.submitted_at ? "easy" : "medium"}>
                          {a.submitted_at ? "Submitted" : "In progress"}
                        </Badge>
                      </td>
                      <td>
                        {a.submitted_at ? `${a.earned} / ${a.maximum}` : "—"}
                      </td>
                      <td>
                        <button
                          className="text-button"
                          onClick={() => resume(a.id)}
                        >
                          {a.submitted_at ? "Review" : "Resume"}{" "}
                          <ArrowRight size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="Your first attempt is waiting">
              <button className="button" onClick={() => go("riddles")}>
                Explore riddles
              </button>
            </Empty>
          )}
        </section>
      </>
    );
  if (page === "quizzes")
    return (
      <>
        <Heading
          eyebrow="PUT YOUR IDEAS TO WORK"
          title="A little challenge. A lot to learn."
        >
          Teacher-created quizzes, with time to think and room to grow.
        </Heading>
        <div className="question-grid">
          {quizzes.map((q) => (
            <article className="question-card" key={q.id}>
              <div className="card-meta">
                <Badge>Assigned quiz</Badge>
                <Clock3 size={20} />
              </div>
              <h3>{q.title}</h3>
              <p>
                {q.question_ids.length} questions ·{" "}
                {Math.round(q.time_limit / 60)} minutes
              </p>
              <p>
                {q.reveal_answers
                  ? "Feedback is available after submission and diagnostic probes."
                  : "Your teacher has kept solutions hidden."}
              </p>
              <button
                className="button"
                onClick={() => open(`/quizzes/${q.id}/start`)}
              >
                Start or resume <ArrowRight size={17} />
              </button>
            </article>
          ))}
        </div>
        {!quizzes.length && (
          <Empty title="No quizzes assigned yet">
            Your teacher’s published quizzes will appear here.
          </Empty>
        )}
      </>
    );
  const overview = page === "overview";
  return (
    <>
      <Heading
        eyebrow={overview ? "YOUR LEARNING SPACE" : "THE QUESTION COLLECTION"}
        title={
          overview
            ? "Good questions. Deeper understanding."
            : "Stay curious. Think it through."
        }
      >
        {overview
          ? "Go beyond getting it right. Discover the thinking behind your answers."
          : "Four original learning riddles, plus clearly labeled diagnostic practice."}
      </Heading>
      {overview && (
        <>
          <section className="hero">
            <div className="hero-content">
              <Badge>BEYOND THE NUMBER</Badge>
              <h2>
                There’s a story
                <br />
                behind every answer.
              </h2>
              <p>
                Explore a riddle. Notice your confidence.
                <br />
                Learn something about how you learn.
              </p>
              <button className="button light" onClick={() => go("riddles")}>
                Find your next question <ArrowRight size={17} />
              </button>
            </div>
            <div className="hero-art" aria-hidden="true">
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <span className="art-label">THINK · QUESTION · UNDERSTAND</span>
              <span className="art-number">?</span>
              <div className="art-spark">✳</div>
              <div className="art-note">
                A mark tells you <em>what.</em>
                <br />
                Curiosity asks <em>why.</em>
              </div>
            </div>
          </section>
          <div className="stats-grid">
            <Stat
              label="Marks earned"
              value={`${report.earned} / ${report.maximum}`}
              detail={
                report.pending
                  ? `${report.pending} awaiting review`
                  : "Your submitted work"
              }
            />
            <Stat
              label="Riddles explored"
              value={`${complete.length} / ${questions.length}`}
              detail="Unique questions attempted"
              icon="attempts"
            />
            <Stat
              label="Objective accuracy"
              value={report.accuracy === null ? "—" : `${report.accuracy}%`}
              detail="Evidence, with context"
              icon="accuracy"
            />
            <Stat
              label="Learning time"
              value={`${Math.round(report.time_seconds / 60)} min`}
              detail="A little effort goes a long way"
              icon="time"
            />
          </div>
          <div className="section-heading">
            <div>
              <div className="eyebrow">A PLACE TO BEGIN</div>
              <h2>Your next thinking moment</h2>
            </div>
            <button className="text-button" onClick={() => go("riddles")}>
              Explore all riddles <ArrowRight size={16} />
            </button>
          </div>
        </>
      )}
      {!overview && (
        <div className="filters">
          <label className="search">
            <Search size={18} />
            <input
              aria-label="Search riddles"
              placeholder="Search a question, idea, or topic…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select
            aria-label="Filter difficulty"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
          >
            <option value="all">All difficulties</option>
            {["easy", "medium", "hard"].map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
          <select
            aria-label="Filter answer type"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="all">All activities</option>
            <option value="reflection">Reflections</option>
            <option value="choice">Multiple choice</option>
            <option value="text">Short answer</option>
          </select>
        </div>
      )}
      <div className="question-grid">
        {(overview ? questions.slice(0, 3) : filtered).map((q, n) => (
          <QuestionCard
            key={q.id}
            q={q}
            index={n}
            completed={complete.includes(q.id)}
            onStart={() => open(`/practice/${q.id}`)}
          />
        ))}
      </div>
      {!overview && !filtered.length && (
        <Empty title="No questions match">
          Try a different search or filter.
        </Empty>
      )}
      {overview && (
        <section className="insight-strip">
          <span className="insight-icon">
            <Lightbulb size={23} />
          </span>
          <div>
            <h3>Knowing what you don’t know is progress, too.</h3>
            <p>
              Choose “Sure,” “Unsure,” or “Guessing” as you answer. Your
              confidence helps you reflect—it never changes your marks.
            </p>
          </div>
          <button className="text-button" onClick={() => go("progress")}>
            My learning insights <ArrowRight size={16} />
          </button>
        </section>
      )}
    </>
  );
}

export function Runner({ attempt, setAttempt, run, onClose }) {
  const [answers, setAnswers] = useState(attempt.answers),
    [index, setIndex] = useState(0),
    [hint, setHint] = useState(""),
    [remaining, setRemaining] = useState(null),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(false),
    [saved, setSaved] = useState(""),
    [probeChoice, setProbeChoice] = useState("");
  const item = attempt.items[index],
    key = String(item.id),
    response = answers[key] || { answer: "", confidence: "unsure" },
    result = attempt.results[key];
  const closed = !!attempt.submitted_at;
  const answered = Object.values(answers).filter((a) => a.answer.trim()).length;
  const act = (fn) =>
    run(async () => {
      setBusy(true);
      try {
        await fn();
      } finally {
        setBusy(false);
      }
    });
  useEffect(() => {
    setHint("");
    setProbeChoice("");
    setSaved("");
  }, [index]);
  useEffect(() => {
    if (!attempt.deadline || closed) return;
    const tick = () =>
      setRemaining(
        Math.max(
          0,
          Math.ceil((new Date(attempt.deadline) - Date.now()) / 1000),
        ),
      );
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [attempt.deadline, closed]);
  useEffect(() => {
    if (remaining === 0 && !closed)
      act(async () => {
        setAttempt(await api(`/attempts/${attempt.id}`));
        setSaved("Time is up. Your last saved responses were submitted.");
      });
  }, [remaining, closed]);
  // Autosave after edits; server rejects writes after the deadline.
  useEffect(() => {
    if (closed) return;
    const timer = setTimeout(() => {
      run(async () => {
        const a = await api(`/attempts/${attempt.id}/draft`, {
          method: "PUT",
          body: { answers },
        });
        setSaved("Progress saved");
        if (a.submitted_at) setAttempt(a);
      });
    }, 900);
    return () => clearTimeout(timer);
  }, [answers, closed]);
  function change(field, value) {
    setAnswers({ ...answers, [key]: { ...response, [field]: value } });
    setSaved("Unsaved changes");
  }
  return (
    <>
      <button
        className="text-button back"
        onClick={() => {
          if (closed) {
            onClose();
          } else
            act(async () => {
              await api(`/attempts/${attempt.id}/draft`, {
                method: "PUT",
                body: { answers },
              });
              onClose();
            });
        }}
      >
        <ArrowLeft size={16} /> {closed ? "Back to learning" : "Save & leave"}
      </button>
      <div className="runner-heading">
        <div>
          <div className="eyebrow">
            {closed
              ? "YOUR RESPONSE, IN CONTEXT"
              : `QUESTION ${index + 1} OF ${attempt.items.length}`}
          </div>
          <h1>{closed ? "A moment to reflect." : "Take a moment to think."}</h1>
        </div>
        {!closed && remaining !== null && (
          <Badge tone={remaining < 60 ? "hard" : ""}>
            <Clock3 size={15} /> {Math.floor(remaining / 60)}:
            {String(remaining % 60).padStart(2, "0")}
          </Badge>
        )}
        {closed && (
          <Badge>
            {attempt.earned} / {attempt.maximum} marks · provisional if pending
          </Badge>
        )}
      </div>
      <div className="runner-layout">
        <section className="panel runner">
          <div className="card-meta">
            <Badge tone={item.difficulty}>{item.difficulty}</Badge>
            <span>
              {item.marks} marks · {item.topic}
            </span>
          </div>
          <h2>{item.title}</h2>
          <p className="question-stem">{item.stem}</p>
          <fieldset disabled={closed || busy}>
            <legend className="sr-only">Your answer</legend>
            {item.kind === "choice" ? (
              <div className="answer-options">
                {item.options.map((o, n) => (
                  <label
                    key={o}
                    className={`answer-option ${response.answer === o ? "selected" : ""}`}
                  >
                    <input
                      type="radio"
                      name={`q-${item.id}`}
                      checked={response.answer === o}
                      onChange={() => change("answer", o)}
                    />
                    <span className="option-letter">
                      {String.fromCharCode(65 + n)}
                    </span>
                    <span>{o}</span>
                  </label>
                ))}
              </div>
            ) : (
              <label className="field">
                Your {item.kind === "reflection" ? "reasoning" : "answer"}
                <textarea
                  rows={item.kind === "reflection" ? 7 : 3}
                  maxLength={10000}
                  placeholder={
                    item.kind === "reflection"
                      ? "Share your interpretation, the evidence you would need, and your reasoning…"
                      : "Write your answer…"
                  }
                  value={response.answer}
                  onChange={(e) => change("answer", e.target.value)}
                />
              </label>
            )}
            <div className="confidence-box">
              <h3>How confident do you feel?</h3>
              <p>
                This helps us understand your thinking. It doesn’t affect marks.
              </p>
              <div className="confidence-buttons">
                {["sure", "unsure", "guessing"].map((c) => (
                  <label
                    key={c}
                    className={response.confidence === c ? "selected" : ""}
                  >
                    <input
                      type="radio"
                      name={`confidence-${item.id}`}
                      checked={response.confidence === c}
                      onChange={() => change("confidence", c)}
                    />
                    <span>
                      {c === "sure" ? "●" : c === "unsure" ? "◐" : "○"}
                    </span>{" "}
                    {c[0].toUpperCase() + c.slice(1)}
                  </label>
                ))}
              </div>
            </div>
          </fieldset>
          {!closed && item.has_hint && (
            <div className="hint-box">
              <button
                className="text-button"
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    const h = await api(
                      `/attempts/${attempt.id}/hints/${item.id}`,
                      { method: "POST" },
                    );
                    setHint(h.hint);
                    setAttempt({
                      ...attempt,
                      hints: [...new Set([...attempt.hints, item.id])],
                    });
                  })
                }
              >
                <Lightbulb size={17} />
                {attempt.hints.includes(item.id)
                  ? "Show hint again"
                  : `Use a hint (−${item.hint_cost} mark${item.hint_cost === 1 ? "" : "s"})`}
              </button>
              {hint && <p>{hint}</p>}
            </div>
          )}
          {closed && result && (
            <div className="result-box">
              <div className="panel-heading">
                <h3>
                  {result.status === "pending_review"
                    ? "Your teacher will review this reflection"
                    : result.status === "unanswered"
                      ? "No answer submitted"
                      : result.status === "reviewed"
                        ? "Teacher feedback"
                        : result.correct
                          ? "A well-reasoned step"
                          : "A chance to look again"}
                </h3>
                <Badge>
                  {result.marks === null
                    ? "Pending"
                    : `${result.marks} / ${item.marks}`}
                </Badge>
              </div>
              <p className="capitalize">{result.diagnostic}</p>
              {result.deduction > 0 && (
                <p>Hint deduction: {result.deduction} mark(s).</p>
              )}
              {result.feedback && <p>{result.feedback}</p>}
              {result.explanation && (
                <>
                  <h4>Reasoning & explanation</h4>
                  <p>{result.explanation}</p>
                  {result.accepted_answers?.length > 0 && (
                    <p>
                      <strong>
                        Accepted answer
                        {result.accepted_answers.length > 1 ? "s" : ""}:
                      </strong>{" "}
                      {result.accepted_answers.join(" / ")}
                    </p>
                  )}
                </>
              )}
              {result.probe && (
                <div className="probe">
                  <Badge>OPTIONAL DIAGNOSTIC · NO MARKS</Badge>
                  <h3>One more question, a little more clarity.</h3>
                  <p>{result.probe.stem}</p>
                  <label className="field">
                    Your probe answer
                    <select
                      value={probeChoice}
                      onChange={(e) => setProbeChoice(e.target.value)}
                    >
                      <option value="">Choose an option</option>
                      {result.probe.options.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="button"
                    disabled={!probeChoice || busy}
                    onClick={() =>
                      act(async () =>
                        setAttempt(
                          await api(
                            `/attempts/${attempt.id}/probes/${item.id}`,
                            { method: "POST", body: { answer: probeChoice } },
                          ),
                        ),
                      )
                    }
                  >
                    Share this extra evidence
                  </button>
                  <p className="muted text-sm">
                    You may leave without answering. Solutions stay hidden while
                    probes are pending to avoid coaching the result.
                  </p>
                </div>
              )}
              {!attempt.reveal_answers && (
                <p className="muted">Your teacher has kept solutions hidden.</p>
              )}
            </div>
          )}
          <div className="runner-footer">
            <button
              className="button secondary"
              disabled={index === 0 || busy}
              onClick={() => setIndex(index - 1)}
            >
              <ArrowLeft size={16} /> Previous
            </button>
            <span className="muted text-sm" role="status">
              {saved}
            </span>
            {index < attempt.items.length - 1 ? (
              <button className="button" onClick={() => setIndex(index + 1)}>
                Next question <ArrowRight size={16} />
              </button>
            ) : !closed ? (
              <button
                className="button"
                disabled={busy}
                onClick={() => setConfirm(true)}
              >
                <Send size={16} /> Review & submit
              </button>
            ) : (
              <button className="button" onClick={onClose}>
                Continue learning <ArrowRight size={16} />
              </button>
            )}
          </div>
        </section>
        <aside>
          <section className="panel question-nav">
            <div className="eyebrow">YOUR JOURNEY</div>
            <h3>{closed ? "Submitted" : "One question at a time."}</h3>
            <div className="nav-numbers">
              {attempt.items.map((q, n) => (
                <button
                  key={q.id}
                  aria-label={`Go to question ${n + 1}`}
                  className={`${index === n ? "active" : ""} ${answers[String(q.id)]?.answer ? "answered" : ""}`}
                  onClick={() => setIndex(n)}
                >
                  {n + 1}
                </button>
              ))}
            </div>
            <p>
              {answered} of {attempt.items.length} answered
            </p>
            {!closed && (
              <button
                className="button secondary"
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    await api(`/attempts/${attempt.id}/draft`, {
                      method: "PUT",
                      body: { answers },
                    });
                    setSaved("Progress saved");
                  })
                }
              >
                <Save size={16} /> Save progress
              </button>
            )}
          </section>
          <div className="quiet-note">
            <Lightbulb size={22} />
            <h3>Thinking is the point.</h3>
            <p>
              {item.kind === "reflection"
                ? "There is no single secret phrase. Make a case, consider alternatives, and show your reasoning."
                : "Take your time and be honest about your confidence. A wrong answer can still be useful evidence."}
            </p>
          </div>
        </aside>
      </div>
      {confirm && (
        <div className="modal-backdrop">
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
          >
            <Send size={28} />
            <h2 id="confirm-title">Ready to share your thinking?</h2>
            <p>
              {answered} of {attempt.items.length} questions answered.{" "}
              {attempt.items.length - answered > 0
                ? "Unanswered questions receive zero marks. "
                : ""}
              You cannot edit this attempt after submission. Reflections will
              wait for teacher review.
            </p>
            <div className="button-row">
              <button
                className="button secondary"
                onClick={() => setConfirm(false)}
              >
                Keep thinking
              </button>
              <button
                className="button"
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    const a = await api(`/attempts/${attempt.id}/submit`, {
                      method: "POST",
                      body: { answers },
                    });
                    setAttempt(a);
                    setAnswers(a.answers);
                    setConfirm(false);
                    setIndex(0);
                  })
                }
              >
                Submit attempt
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
