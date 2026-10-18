import {
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  Target,
  TrendingUp,
  Info,
} from "lucide-react";
import { percent } from "./api";
export const Icons = {
  score: Target,
  accuracy: TrendingUp,
  attempts: CheckCircle2,
  time: Clock3,
};
export function Badge({ children, tone = "" }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Empty({ title = "A little quiet here", children }) {
  return (
    <div className="empty">
      <BookOpen size={30} />
      <h3>{title}</h3>
      <p>{children || "Your next learning moment starts with a question."}</p>
    </div>
  );
}
export function Heading({ eyebrow, title, children, action }) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{children}</p>
      </div>
      {action}
    </div>
  );
}
export function Stat({ label, value, detail, icon = "score" }) {
  const Icon = Icons[icon];
  return (
    <div className="stat">
      <div className="stat-top">
        <span>{label}</span>
        <span className={`stat-icon ${icon}`}>
          <Icon size={19} />
        </span>
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}
export function Bar({ value, label, detail }) {
  return (
    <div className="bar-row">
      <div>
        <span>{label}</span>
        <strong>{detail || `${value}%`}</strong>
      </div>
      <div
        className="bar-track"
        role="meter"
        aria-label={label}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={value}
      >
        <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}
export function Report({ report, teacher = false }) {
  const total = report.maximum || 0;
  const topics = report.topics || [];
  const strongest = [...topics].sort(
    (a, b) => percent(b.earned, b.maximum) - percent(a.earned, a.maximum),
  );
  return (
    <>
      <div className="stats-grid">
        <Stat
          label="Marks earned"
          value={`${report.earned} / ${total}`}
          detail={
            report.pending
              ? `${report.pending} awaiting teacher review`
              : "Across submitted attempts"
          }
        />
        <Stat
          label="Objective accuracy"
          value={report.accuracy === null ? "—" : `${report.accuracy}%`}
          detail="Excludes reflections and unanswered items"
          icon="accuracy"
        />
        <Stat
          label="Questions attempted"
          value={report.attempted}
          detail={`${report.unanswered} unanswered · ${report.incorrect} incorrect`}
          icon="attempts"
        />
        <Stat
          label="Learning time"
          value={`${Math.round(report.time_seconds / 60)} min`}
          detail="Server-recorded attempt duration"
          icon="time"
        />
      </div>
      <div className="two-col">
        <section className="panel">
          <div className="panel-heading">
            <h2>Understanding by topic</h2>
            <Badge>All attempts</Badge>
          </div>
          {topics.length ? (
            topics.map((t) => (
              <Bar
                key={t.name}
                label={t.name}
                value={percent(t.earned, t.maximum)}
                detail={`${t.earned} / ${t.maximum}`}
              />
            ))
          ) : (
            <Empty title="Your story starts here">
              Complete an activity to see topic evidence.
            </Empty>
          )}
          <p className="muted text-sm">
            Pending reflections count as provisional zero until reviewed.
          </p>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Confidence & correctness</h2>
            <Info size={17} />
          </div>
          <div className="calibration">
            {(report.calibration || []).map((c) => (
              <div
                key={c.confidence}
                tabIndex="0"
                title={`${c.count} objectively graded answers`}
              >
                <div className="chart-column">
                  <span style={{ height: `${c.accuracy || 0}%` }} />
                </div>
                <strong>{c.accuracy === null ? "—" : `${c.accuracy}%`}</strong>
                <span className="capitalize">{c.confidence}</span>
                <small>{c.count} answers</small>
              </div>
            ))}
          </div>
          <p className="muted text-sm">
            Confidence is a reflection tool. It never changes your grade.
          </p>
        </section>
      </div>
      <div className="two-col">
        <section className="panel">
          <h2>Progress over time</h2>
          {report.history?.length ? (
            <div className="history-chart">
              {report.history.map((h, n) => (
                <div
                  key={h.id}
                  tabIndex="0"
                  title={`Attempt ${h.id}: ${h.percentage}%, ${h.pending} pending`}
                >
                  <div>
                    <span style={{ height: `${Math.max(2, h.percentage)}%` }} />
                  </div>
                  <small>#{n + 1}</small>
                  <b>{h.percentage}%</b>
                </div>
              ))}
            </div>
          ) : (
            <Empty title="No submitted attempts yet" />
          )}
        </section>
        <section className="panel">
          <h2>{teacher ? "Class evidence" : "Your next best step"}</h2>
          {!teacher && strongest.length > 0 && (
            <p>
              <strong>{strongest[0].name}</strong> has your highest current
              marks.{" "}
              {strongest.length > 1 && (
                <>
                  Spend your next session on{" "}
                  <strong>{strongest.at(-1).name}</strong>.
                </>
              )}
            </p>
          )}
          <div className="evidence-list">
            {Object.entries(report.diagnostics || {}).map(([name, count]) => (
              <div key={name}>
                <span className="dot" />
                <span className="capitalize">{name}</span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
          <p className="note">
            <Info size={16} />
            These are tentative signals about responses, never labels for people
            or proof of learning.
          </p>
        </section>
      </div>
      <section className="panel">
        <h2>Difficulty breakdown</h2>
        <div className="three-col">
          {(report.difficulties || []).map((d) => (
            <Bar
              key={d.name}
              label={d.name}
              value={percent(d.earned, d.maximum)}
              detail={`${d.earned} / ${d.maximum} marks`}
            />
          ))}
        </div>
      </section>
    </>
  );
}
export function QuestionCard({ q, index, completed, onStart, teacherActions }) {
  return (
    <article className="question-card">
      <div className="card-meta">
        <span className="question-number">
          {String(index + 1).padStart(2, "0")}
        </span>
        <Badge tone={q.difficulty}>{q.difficulty}</Badge>
        {completed && (
          <span className="complete-label">
            <CheckCircle2 size={14} /> Attempted
          </span>
        )}
      </div>
      <div className="eyebrow">{q.topic}</div>
      <h3>{q.title}</h3>
      <p>{q.stem}</p>
      <div className="card-footer">
        <span>
          {q.marks} marks <i>·</i>{" "}
          {q.kind === "reflection"
            ? "Teacher review"
            : q.kind === "choice"
              ? "Multiple choice"
              : "Short answer"}
        </span>
        {teacherActions || (
          <button
            className="icon-button"
            aria-label={`Start ${q.title}`}
            onClick={onStart}
          >
            <ArrowUpRight size={21} />
          </button>
        )}
      </div>
    </article>
  );
}
