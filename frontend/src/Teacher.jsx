import { useEffect, useState } from "react";
import {
  Plus,
  Upload,
  Download,
  Search,
  ArrowLeft,
  Trash2,
  Pencil,
  Check,
  ClipboardList,
} from "lucide-react";
import { api, download } from "./api";
import { Heading, Badge, Empty, QuestionCard, Report, Stat } from "./ui";
const blank = {
  title: "",
  stem: "",
  topic: "",
  difficulty: "medium",
  kind: "reflection",
  marks: 10,
  options: [],
  accepted_answers: [],
  explanation: "",
  rubric: "",
  hint: "",
  hint_cost: 0,
  misconceptions: {},
  probe: null,
  published: false,
};
const quizBlank = {
  title: "",
  question_ids: [],
  student_ids: [],
  time_limit: 1800,
  published: false,
  reveal_answers: true,
  randomize: false,
};
const strip = (q) =>
  Object.fromEntries(Object.keys(blank).map((k) => [k, q[k] ?? blank[k]]));

export default function Teacher({ page, run, refreshKey }) {
  const [questions, setQuestions] = useState([]),
    [quizzes, setQuizzes] = useState([]),
    [students, setStudents] = useState([]),
    [submissions, setSubmissions] = useState([]),
    [report, setReport] = useState(null),
    [editing, setEditing] = useState(null),
    [quiz, setQuiz] = useState(null),
    [search, setSearch] = useState(""),
    [loading, setLoading] = useState(true),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    setLoading(true);
    try {
      const [q, z, s, a, r] = await Promise.all([
        api("/questions"),
        api("/quizzes"),
        api("/teacher/students"),
        api("/teacher/submissions"),
        api("/teacher/analytics"),
      ]);
      setQuestions(q);
      setQuizzes(z);
      setStudents(s);
      setSubmissions(a);
      setReport(r);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    run(load);
  }, [refreshKey]);
  useEffect(() => {
    setEditing(null);
    setQuiz(null);
    setMessage("");
  }, [page]);
  const act = (fn) =>
    run(async () => {
      setBusy(true);
      try {
        await fn();
      } finally {
        setBusy(false);
      }
    });
  const exportCSV = () =>
    act(async () =>
      download(
        await api("/teacher/export", { download: true }),
        "class-results.csv",
      ),
    );
  if (loading)
    return (
      <div className="loading" role="status">
        Opening your teaching workspace…
      </div>
    );
  if (editing)
    return (
      <QuestionEditor
        initial={editing}
        busy={busy}
        cancel={() => setEditing(null)}
        save={(data) =>
          act(async () => {
            await api(`/questions${editing.id ? "/" + editing.id : ""}`, {
              method: editing.id ? "PUT" : "POST",
              body: data,
            });
            setEditing(null);
            setMessage("Question saved");
            await load();
          })
        }
      />
    );
  if (quiz)
    return (
      <QuizEditor
        initial={quiz}
        questions={questions}
        students={students}
        busy={busy}
        cancel={() => setQuiz(null)}
        save={(data) =>
          act(async () => {
            await api(`/quizzes${quiz.id ? "/" + quiz.id : ""}`, {
              method: quiz.id ? "PUT" : "POST",
              body: data,
            });
            setQuiz(null);
            setMessage("Quiz saved");
            await load();
          })
        }
      />
    );
  if (!report)
    return (
      <Empty title="Could not load your workspace">
        Refresh the page to try again.
      </Empty>
    );
  if (page === "progress")
    return (
      <>
        <Heading
          eyebrow="EVIDENCE FOR BETTER TEACHING"
          title="See the learning behind the marks."
          action={
            <button className="button secondary" onClick={exportCSV}>
              <Download size={16} /> Export results
            </button>
          }
        >
          Formative class signals, with individual evidence when you need it.
        </Heading>
        <Report report={report} teacher />
        <section className="panel">
          <h2>Misconception signals</h2>
          {Object.entries(report.misconceptions || {}).length ? (
            Object.entries(report.misconceptions).map(([code, count]) => (
              <div className="evidence-list" key={code}>
                <div>
                  <span>{code}</span>
                  <strong>{count} responses</strong>
                </div>
              </div>
            ))
          ) : (
            <p className="muted">No misconception-coded errors recorded yet.</p>
          )}
        </section>
        <section className="panel">
          <h2>Individual performance</h2>
          {report.students.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Marks</th>
                    <th>Accuracy</th>
                    <th>Pending</th>
                    <th>Topics</th>
                  </tr>
                </thead>
                <tbody>
                  {report.students.map((s) => (
                    <tr key={s.id}>
                      <td>
                        {s.name}
                        <small>{s.email}</small>
                      </td>
                      <td>
                        {s.report.earned} / {s.report.maximum}
                      </td>
                      <td>
                        {s.report.accuracy === null
                          ? "—"
                          : `${s.report.accuracy}%`}
                      </td>
                      <td>{s.report.pending}</td>
                      <td>
                        {s.report.topics
                          .map((t) => `${t.name}: ${t.earned}/${t.maximum}`)
                          .join(" · ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="No submitted student work yet" />
          )}
        </section>
      </>
    );
  if (page === "reviews")
    return (
      <>
        <Heading
          eyebrow="FEEDBACK THAT MOVES LEARNING FORWARD"
          title="A human eye makes the difference."
          action={
            <button className="button secondary" onClick={exportCSV}>
              <Download size={16} /> Export CSV
            </button>
          }
        >
          Review the reasoning. Use the rubric, and make your feedback specific.
        </Heading>
        {submissions.map((a) => (
          <section className="panel" key={a.id}>
            <div className="panel-heading">
              <div>
                <h2>{a.student.name}</h2>
                <p className="muted text-sm">
                  {a.student.email} · Attempt #{a.id} ·{" "}
                  {new Date(a.submitted_at).toLocaleString()}
                </p>
              </div>
              <Badge>
                {a.earned} / {a.maximum}
              </Badge>
            </div>
            {a.items.map((q) => (
              <ReviewItem
                key={q.id}
                q={q}
                attempt={a}
                busy={busy}
                onGrade={(marks, feedback) =>
                  act(async () => {
                    await api(`/teacher/attempts/${a.id}/grade/${q.id}`, {
                      method: "POST",
                      body: { marks: Number(marks), feedback },
                    });
                    setMessage("Feedback saved");
                    await load();
                  })
                }
              />
            ))}
          </section>
        ))}
        {!submissions.length && (
          <Empty title="A fresh review queue">
            Student submissions will appear here.
          </Empty>
        )}
      </>
    );
  if (page === "quizzes")
    return (
      <>
        <Heading
          eyebrow="FROM QUESTIONS TO A LEARNING JOURNEY"
          title="Quizzes with a purpose."
          action={
            <button
              className="button"
              onClick={() => setQuiz({ ...quizBlank })}
            >
              <Plus size={17} /> Create quiz
            </button>
          }
        >
          Choose questions, assign learners, and control when solutions are
          shared.
        </Heading>
        {message && (
          <p className="success" role="status">
            {message}
          </p>
        )}
        <div className="question-grid">
          {quizzes.map((q) => (
            <article className="question-card" key={q.id}>
              <div className="card-meta">
                <Badge tone={q.published ? "easy" : ""}>
                  {q.published ? "Published" : "Draft"}
                </Badge>
                <span>{Math.round(q.time_limit / 60)} min</span>
              </div>
              <h3>{q.title}</h3>
              <p>
                {q.question_ids.length} questions ·{" "}
                {q.student_ids.length
                  ? `${q.student_ids.length} assigned students`
                  : "All registered students"}
              </p>
              <p>
                {q.reveal_answers
                  ? "Solutions after submission"
                  : "Solutions hidden"}{" "}
                · {q.randomize ? "Random order" : "Fixed order"}
              </p>
              <div className="button-row">
                <button className="button secondary" onClick={() => setQuiz(q)}>
                  <Pencil size={15} /> Edit & assign
                </button>
                {q.published && (
                  <button
                    className="icon-button"
                    aria-label={`Unpublish ${q.title}`}
                    onClick={() =>
                      act(async () => {
                        await api(`/quizzes/${q.id}`, { method: "DELETE" });
                        await load();
                      })
                    }
                  >
                    <Trash2 size={17} />
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
        {!quizzes.length && (
          <Empty title="Build your first quiz">
            Publish a few questions, then bring them together here.
          </Empty>
        )}
      </>
    );
  const overview = page === "overview";
  return (
    <>
      <Heading
        eyebrow={overview ? "YOUR TEACHING WORKSPACE" : "THE QUESTION BANK"}
        title={
          overview
            ? "Understand more. Teach better."
            : "Good assessment starts here."
        }
        action={
          <button className="button" onClick={() => setEditing({ ...blank })}>
            <Plus size={17} /> Add question
          </button>
        }
      >
        {overview
          ? "A thoughtful space for questions, evidence, and meaningful feedback."
          : "Create, refine, and publish questions without changing a line of code."}
      </Heading>
      {message && (
        <p className="success" role="status">
          {message}
        </p>
      )}
      {overview && (
        <>
          <section className="teacher-banner">
            <div>
              <Badge>TEACHER WORKSPACE</Badge>
              <h2>
                Make room for the
                <br />
                thinking behind the answer.
              </h2>
              <p>
                {report.pending} reflections are waiting for your perspective.
              </p>
            </div>
            <ClipboardList size={100} strokeWidth={1} />
          </section>
          <div className="stats-grid">
            <Stat
              label="Question bank"
              value={questions.length}
              detail={`${questions.filter((q) => q.published).length} published`}
            />
            <Stat
              label="Registered learners"
              value={students.length}
              detail="Within this institution"
              icon="attempts"
            />
            <Stat
              label="Awaiting review"
              value={report.pending}
              detail="Open-ended reflections"
              icon="time"
            />
            <Stat
              label="Class accuracy"
              value={report.accuracy === null ? "—" : `${report.accuracy}%`}
              detail="Objective responses only"
              icon="accuracy"
            />
          </div>
        </>
      )}
      <section className="panel import-panel">
        <div>
          <h3>
            <Upload size={18} /> Bring your question bank
          </h3>
          <p>
            Upload a UTF-8 JSON or CSV file. Up to 100 questions, under 1 MB.
            The entire file is validated before anything is saved.
          </p>
          <button
            className="text-button"
            onClick={() =>
              act(async () =>
                download(
                  await api("/teacher/template/json", { download: true }),
                  "question-bank.example.json",
                ),
              )
            }
          >
            Download a JSON template <Download size={14} />
          </button>
          <button
            className="text-button"
            onClick={() =>
              act(async () =>
                download(
                  await api("/teacher/template/csv", { download: true }),
                  "question-bank.example.csv",
                ),
              )
            }
          >
            CSV template <Download size={14} />
          </button>
        </div>
        <label
          className={`button secondary file-button ${busy ? "disabled" : ""}`}
        >
          <Upload size={16} /> Choose file
          <input
            type="file"
            accept=".json,.csv"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files[0];
              e.target.value = "";
              if (f)
                act(async () => {
                  const data = new FormData();
                  data.append("file", f);
                  const result = await api("/questions/import", {
                    method: "POST",
                    body: data,
                  });
                  setMessage(`${result.imported} questions imported`);
                  await load();
                });
            }}
          />
        </label>
      </section>
      <div className="filters">
        <label className="search">
          <Search size={18} />
          <input
            aria-label="Search question bank"
            placeholder="Search your question bank…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <span className="muted text-sm">
          {questions.length} questions in your bank
        </span>
      </div>
      <div className="question-grid">
        {questions
          .filter((q) =>
            `${q.title} ${q.topic}`
              .toLowerCase()
              .includes(search.toLowerCase()),
          )
          .map((q, n) => (
            <QuestionCard
              key={q.id}
              q={q}
              index={n}
              teacherActions={
                <div className="button-row">
                  <Badge tone={q.published ? "easy" : ""}>
                    {q.published ? "Published" : "Draft"}
                  </Badge>
                  <button
                    className="icon-button"
                    aria-label={`Edit ${q.title}`}
                    onClick={() => setEditing(q)}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    className="icon-button danger"
                    aria-label={`Archive ${q.title}`}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Archive this question? Historical attempts will be preserved.",
                        )
                      )
                        act(async () => {
                          await api(`/questions/${q.id}`, { method: "DELETE" });
                          await load();
                        });
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              }
            />
          ))}
      </div>
      {!questions.length && (
        <Empty title="A blank page, full of possibility">
          Add a question or import a bank to begin.
        </Empty>
      )}
    </>
  );
}
function ReviewItem({ q, attempt, busy, onGrade }) {
  const r = attempt.results[String(q.id)],
    answer = attempt.answers[String(q.id)],
    [marks, setMarks] = useState(r.marks ?? 0),
    [feedback, setFeedback] = useState(r.feedback || "");
  return (
    <div className="review-item">
      <div className="panel-heading">
        <h3>{q.title}</h3>
        <Badge tone={r.status === "pending_review" ? "medium" : "easy"}>
          {r.status.replaceAll("_", " ")}
        </Badge>
      </div>
      <p>{q.stem}</p>
      <div className="student-response">
        <strong>Student response</strong>
        <p>{answer?.answer || "Unanswered"}</p>
        <small>Confidence: {answer?.confidence || "not provided"}</small>
      </div>
      {q.kind === "reflection" && r.status !== "unanswered" ? (
        <>
          <details>
            <summary>Grading rubric</summary>
            <p>{attempt.rubrics[String(q.id)]}</p>
          </details>
          <form
            className="grade-form"
            onSubmit={(e) => {
              e.preventDefault();
              onGrade(marks, feedback);
            }}
          >
            <label className="field">
              Marks before hint deduction
              <input
                type="number"
                min="0"
                max={q.marks}
                step="0.5"
                required
                value={marks}
                onChange={(e) => setMarks(e.target.value)}
              />
              <small>
                Maximum {q.marks} · deduction {r.deduction}
              </small>
            </label>
            <label className="field">
              Specific feedback
              <textarea
                required
                rows={2}
                maxLength={5000}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="What was strong? What evidence or reasoning would help next?"
              />
            </label>
            <button className="button" disabled={busy}>
              <Check size={16} /> Save grade
            </button>
          </form>
        </>
      ) : (
        <p>
          {r.marks} / {q.marks} · {r.diagnostic}
        </p>
      )}
    </div>
  );
}
function QuestionEditor({ initial, save, cancel, busy }) {
  const [form, setForm] = useState(strip(initial)),
    [options, setOptions] = useState(initial.options?.join("\n") || ""),
    [accepted, setAccepted] = useState(
      initial.accepted_answers?.join("\n") || "",
    );
  const field = (name, value) => setForm({ ...form, [name]: value });
  const lines = (s) =>
    s
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);
  const input = (name, label, type = "text") => (
    <label className="field">
      {label}
      <input
        type={type}
        required={["title", "topic", "marks"].includes(name)}
        value={form[name]}
        min={name === "marks" ? 1 : 0}
        max={type === "number" ? 100 : 150}
        onChange={(e) =>
          field(
            name,
            type === "number" ? Number(e.target.value) : e.target.value,
          )
        }
      />
    </label>
  );
  return (
    <>
      <button className="text-button back" onClick={cancel}>
        <ArrowLeft size={16} /> Back to question bank
      </button>
      <Heading
        eyebrow="QUESTION STUDIO"
        title={
          initial.id ? "Refine the question." : "Start with a good question."
        }
      >
        Draft privately, then publish when you’re ready. Existing attempts keep
        their original version.
      </Heading>
      <form
        className="panel editor"
        onSubmit={(e) => {
          e.preventDefault();
          save({
            ...form,
            options: form.kind === "choice" ? lines(options) : [],
            accepted_answers: form.kind === "reflection" ? [] : lines(accepted),
            misconceptions:
              form.kind === "choice"
                ? Object.fromEntries(
                    Object.entries(form.misconceptions).filter(
                      ([k, v]) =>
                        lines(options).includes(k) &&
                        !lines(accepted).includes(k) &&
                        v,
                    ),
                  )
                : {},
          });
        }}
      >
        {input("title", "Question title")}
        <label className="field">
          Question prompt
          <textarea
            required
            minLength={5}
            maxLength={10000}
            rows={5}
            value={form.stem}
            onChange={(e) => field("stem", e.target.value)}
          />
        </label>
        <div className="three-col">
          {input("topic", "Topic")}
          <label className="field">
            Difficulty
            <select
              value={form.difficulty}
              onChange={(e) => field("difficulty", e.target.value)}
            >
              {["easy", "medium", "hard"].map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          {input("marks", "Maximum marks", "number")}
        </div>
        <label className="field">
          Answer type
          <select
            value={form.kind}
            onChange={(e) => field("kind", e.target.value)}
          >
            <option value="reflection">Reflection · teacher reviewed</option>
            <option value="choice">Multiple choice · automatic</option>
            <option value="text">
              Short answer · automatic accepted variants
            </option>
          </select>
        </label>
        {form.kind === "choice" && (
          <label className="field">
            Options · one per line
            <textarea
              required
              rows={4}
              value={options}
              onChange={(e) => setOptions(e.target.value)}
            />
          </label>
        )}
        {form.kind !== "reflection" && (
          <label className="field">
            Accepted answers · one per line
            <textarea
              required
              rows={3}
              value={accepted}
              onChange={(e) => setAccepted(e.target.value)}
            />
            <small>
              {form.kind === "choice"
                ? "Each accepted answer must match a whole option."
                : "Matching ignores case, Unicode width and extra whitespace. Add every accepted alternative explicitly."}
            </small>
          </label>
        )}
        {form.kind === "reflection" && (
          <label className="field">
            Teacher grading rubric
            <textarea
              required
              rows={4}
              value={form.rubric}
              onChange={(e) => field("rubric", e.target.value)}
            />
            <small>
              Use clear point allocations. Valid interpretations may differ.
            </small>
          </label>
        )}
        <label className="field">
          Explanation for students after release
          <textarea
            rows={4}
            maxLength={10000}
            value={form.explanation}
            onChange={(e) => field("explanation", e.target.value)}
          />
        </label>
        <div className="two-col">
          {input("hint", "Optional hint")}
          {input("hint_cost", "Hint mark deduction", "number")}
        </div>
        {form.kind === "choice" && (
          <>
            <h3>
              Misconception codes <span className="muted">· optional</span>
            </h3>
            <p className="muted text-sm">
              Name the mistaken idea behind each wrong option. Codes stay hidden
              from students.
            </p>
            {lines(options)
              .filter((o) => !lines(accepted).includes(o))
              .map((o) => (
                <label className="field" key={o}>
                  {o}
                  <input
                    placeholder="e.g. correct-means-mastery"
                    value={form.misconceptions[o] || ""}
                    onChange={(e) =>
                      field("misconceptions", {
                        ...form.misconceptions,
                        [o]: e.target.value,
                      })
                    }
                  />
                </label>
              ))}
          </>
        )}
        {form.kind !== "reflection" && (
          <>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={!!form.probe}
                onChange={(e) =>
                  field(
                    "probe",
                    e.target.checked
                      ? { stem: "", options: [], answer: "" }
                      : null,
                  )
                }
              />{" "}
              Add an optional reworded diagnostic probe
            </label>
            {form.probe && (
              <div className="inset">
                <label className="field">
                  Probe prompt
                  <textarea
                    required
                    value={form.probe.stem}
                    onChange={(e) =>
                      field("probe", { ...form.probe, stem: e.target.value })
                    }
                  />
                </label>
                <label className="field">
                  Probe options · one per line
                  <textarea
                    required
                    value={form.probe.options.join("\n")}
                    onChange={(e) =>
                      field("probe", {
                        ...form.probe,
                        options: e.target.value.split("\n"),
                      })
                    }
                  />
                </label>
                <label className="field">
                  Correct probe answer
                  <input
                    required
                    value={form.probe.answer}
                    onChange={(e) =>
                      field("probe", { ...form.probe, answer: e.target.value })
                    }
                  />
                </label>
              </div>
            )}
          </>
        )}
        <label className="checkbox">
          <input
            type="checkbox"
            checked={form.published}
            onChange={(e) => field("published", e.target.checked)}
          />{" "}
          Publish for students
        </label>
        <div className="button-row">
          <button type="button" className="button secondary" onClick={cancel}>
            Cancel
          </button>
          <button className="button" disabled={busy}>
            {busy ? "Saving…" : "Save question"}
          </button>
        </div>
      </form>
    </>
  );
}
function QuizEditor({ initial, questions, students, busy, save, cancel }) {
  const [form, setForm] = useState(
    Object.fromEntries(Object.keys(quizBlank).map((k) => [k, initial[k]])),
  );
  const field = (name, value) => setForm({ ...form, [name]: value });
  const toggle = (key, id) =>
    field(
      key,
      form[key].includes(id)
        ? form[key].filter((x) => x !== id)
        : [...form[key], id],
    );
  return (
    <>
      <button className="text-button back" onClick={cancel}>
        <ArrowLeft size={16} /> Back to quizzes
      </button>
      <Heading
        eyebrow="QUIZ BUILDER"
        title={
          initial.id ? "Shape the next attempt." : "Connect the questions."
        }
      >
        Each attempt gets a stable question snapshot and a server-enforced
        timer.
      </Heading>
      <form
        className="panel editor"
        onSubmit={(e) => {
          e.preventDefault();
          save(form);
        }}
      >
        <label className="field">
          Quiz title
          <input
            required
            minLength={3}
            maxLength={150}
            value={form.title}
            onChange={(e) => field("title", e.target.value)}
          />
        </label>
        <label className="field">
          Time limit (minutes)
          <input
            type="number"
            required
            min={1}
            max={240}
            value={form.time_limit / 60}
            onChange={(e) =>
              field("time_limit", Math.round(Number(e.target.value) * 60))
            }
          />
        </label>
        <fieldset>
          <legend>
            Choose questions ({form.question_ids.length} selected)
          </legend>
          <div className="check-list">
            {questions.map((q) => (
              <label className="checkbox" key={q.id}>
                <input
                  type="checkbox"
                  checked={form.question_ids.includes(q.id)}
                  onChange={() => toggle("question_ids", q.id)}
                />
                <span>
                  {q.title}{" "}
                  <small>
                    {q.marks} marks · {q.published ? "Published" : "Draft"}
                  </small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>
            Assign students · leave empty for all registered students
          </legend>
          <div className="check-list">
            {students.map((s) => (
              <label className="checkbox" key={s.id}>
                <input
                  type="checkbox"
                  checked={form.student_ids.includes(s.id)}
                  onChange={() => toggle("student_ids", s.id)}
                />
                <span>
                  {s.name} <small>{s.email}</small>
                </span>
              </label>
            ))}
            {!students.length && (
              <p className="muted">Students will appear after registration.</p>
            )}
          </div>
        </fieldset>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={form.reveal_answers}
            onChange={(e) => field("reveal_answers", e.target.checked)}
          />{" "}
          Release solutions after submission and completed diagnostic probes
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={form.randomize}
            onChange={(e) => field("randomize", e.target.checked)}
          />{" "}
          Randomize question order per attempt
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={form.published}
            onChange={(e) => field("published", e.target.checked)}
          />{" "}
          Publish quiz · all selected questions must be published
        </label>
        <p className="note">
          Retakes are allowed and reported as separate attempts. Unpublishing
          affects new starts; existing attempts keep their settings.
        </p>
        <div className="button-row">
          <button type="button" className="button secondary" onClick={cancel}>
            Cancel
          </button>
          <button
            className="button"
            disabled={!form.question_ids.length || busy}
          >
            {busy ? "Saving…" : "Save quiz"}
          </button>
        </div>
      </form>
    </>
  );
}
