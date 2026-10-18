import { useCallback, useEffect, useState } from "react";
import {
  LayoutDashboard,
  BookOpen,
  ClipboardList,
  ChartNoAxesCombined,
  History,
  LogOut,
  Sun,
  Moon,
  Menu,
  X,
  ArrowRight,
  ArrowUpRight,
  GraduationCap,
  RefreshCw,
} from "lucide-react";
import { api } from "./api";
import Student from "./Student";
import Teacher from "./Teacher";

export default function App() {
  const [user, setUser] = useState(null),
    [loading, setLoading] = useState(true),
    [page, setPage] = useState("overview"),
    [error, setError] = useState(""),
    [theme, setTheme] = useState(localStorage.getItem("theme") || "light"),
    [menu, setMenu] = useState(false),
    [refreshKey, setRefreshKey] = useState(0);
  const run = useCallback(async (fn) => {
    setError("");
    try {
      return await fn();
    } catch (e) {
      setError(e.message);
      return undefined;
    }
  }, []);
  useEffect(() => {
    const expired = () => {
      sessionStorage.removeItem("session");
      setUser(null);
      setError("Your session expired. Please log in again.");
    };
    window.addEventListener("session-expired", expired);
    if (sessionStorage.getItem("session"))
      run(async () => setUser(await api("/auth/me"))).finally(() =>
        setLoading(false),
      );
    else setLoading(false);
    return () => window.removeEventListener("session-expired", expired);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);
  const go = (p) => {
    setPage(p);
    setMenu(false);
    setError("");
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const logout = () =>
    run(async () => {
      await api("/auth/logout", { method: "POST" });
      sessionStorage.removeItem("session");
      setUser(null);
      setPage("overview");
    });
  if (loading) return <div className="loading">Opening Beyond the Number…</div>;
  const teacher = user?.role === "teacher";
  const nav = [
    ["overview", "Overview", LayoutDashboard],
    [
      teacher ? "bank" : "riddles",
      teacher ? "Question bank" : "Explore riddles",
      BookOpen,
    ],
    ["quizzes", "Quizzes", ClipboardList],
    [
      "progress",
      teacher ? "Class insights" : "My learning",
      ChartNoAxesCombined,
    ],
    [
      teacher ? "reviews" : "history",
      teacher ? "Review & grade" : "Attempt history",
      History,
    ],
  ];
  return (
    <>
      {!user ? (
        <Auth
          onLogin={(u) => {
            setUser(u);
            setPage("overview");
          }}
          run={run}
          error={error}
        />
      ) : (
        <div className="app-shell">
          <a href="#main" className="skip-link">
            Skip to content
          </a>
          <aside className={`sidebar ${menu ? "open" : ""}`}>
            <a
              className="brand"
              href="#"
              onClick={(e) => {
                e.preventDefault();
                go("overview");
              }}
            >
              <span className="brand-mark">
                b<span>n</span>
                <i />
              </span>
              <div>
                Beyond
                <br />
                the Number<span>AN AI CLUB INITIATIVE</span>
              </div>
            </a>
            <div className="sidebar-divider" />
            <div className="workspace-label">
              {teacher ? "TEACHER WORKSPACE" : "LEARNING WORKSPACE"}
            </div>
            <nav aria-label="Main navigation">
              {nav.map(([id, label, Icon]) => (
                <button
                  key={id}
                  className={`nav-item ${page === id ? "active" : ""}`}
                  onClick={() => go(id)}
                  aria-current={page === id ? "page" : undefined}
                >
                  <Icon size={19} />
                  {label}
                  {page === id && <span className="nav-dot" />}
                </button>
              ))}
            </nav>
            <div className="sidebar-bottom">
              <div className="sidebar-note">
                <span>✳</span>
                <h3>Curiosity looks good on you.</h3>
                <p>
                  The goal isn’t just a better score. It’s a clearer
                  understanding.
                </p>
                <span className="tiny-rule" />
              </div>
              <button className="profile" onClick={logout} title="Log out">
                <span className="avatar">{user.name[0].toUpperCase()}</span>
                <span>
                  <strong>{user.name}</strong>
                  <small>{teacher ? "Teacher" : "Student"} account</small>
                </span>
                <LogOut size={17} />
              </button>
            </div>
          </aside>
          {menu && (
            <button
              className="menu-overlay"
              onClick={() => setMenu(false)}
              aria-label="Close menu"
            />
          )}
          <div className="app-body">
            <header className="topbar">
              <div className="breadcrumb">
                <button
                  className="icon-button mobile-menu"
                  aria-label="Open menu"
                  onClick={() => setMenu(!menu)}
                >
                  <Menu size={21} />
                </button>
                <span>My workspace</span>
                <span>/</span>
                <strong>{nav.find((n) => n[0] === page)?.[1]}</strong>
              </div>
              <div className="topbar-actions">
                <span className="today">
                  {new Date().toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                <button
                  className="icon-button"
                  aria-label="Refresh workspace"
                  onClick={() => setRefreshKey((v) => v + 1)}
                >
                  <RefreshCw size={17} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
                  onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                >
                  {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
                </button>
                <span className="avatar small">
                  {user.name[0].toUpperCase()}
                </span>
              </div>
            </header>
            <main id="main">
              <div className="content">
                {error && (
                  <div className="error toast" role="alert">
                    <span>{error}</span>
                    <button
                      className="icon-button"
                      aria-label="Dismiss error"
                      onClick={() => setError("")}
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
                {teacher ? (
                  <Teacher page={page} run={run} refreshKey={refreshKey} />
                ) : (
                  <Student
                    page={page}
                    go={go}
                    run={run}
                    refreshKey={refreshKey}
                  />
                )}
              </div>
              <footer>
                <span>
                  Beyond the Number <i>·</i> Built for the way you think.
                </span>
                <span>Thoughtful learning. Meaningful progress.</span>
              </footer>
            </main>
          </div>
        </div>
      )}
    </>
  );
}
function Auth({ onLogin, run, error }) {
  const [register, setRegister] = useState(false),
    [busy, setBusy] = useState(false),
    [form, setForm] = useState({ name: "", email: "", password: "" });
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    await run(async () => {
      const result = await api(`/auth/${register ? "register" : "login"}`, {
        method: "POST",
        body: register ? form : { email: form.email, password: form.password },
      });
      sessionStorage.setItem("session", result.token);
      onLogin(result.user);
    });
    setBusy(false);
  };
  return (
    <div className="auth-page">
      <section className="auth-story">
        <a href="#" className="brand">
          <span className="brand-mark">
            b<span>n</span>
            <i />
          </span>
          <div>
            Beyond
            <br />
            the Number<span>AN AI CLUB INITIATIVE</span>
          </div>
        </a>
        <div className="auth-intro">
          <div className="eyebrow">LEARNING IS MORE THAN A NUMBER.</div>
          <h1>
            Right answers
            <br />
            are only the
            <br />
            <em>beginning.</em>
          </h1>
          <p>
            Make space for curiosity, confidence,
            <br />
            and the thinking behind every answer.
          </p>
          <div className="auth-orbit" aria-hidden="true">
            <span>?</span>
            <i>✳</i>
          </div>
        </div>
        <span className="auth-footnote">
          A thoughtful approach to understanding.
        </span>
      </section>
      <section className="auth-form-wrap">
        <div className="auth-form">
          <BadgeLabel />
          <h2>
            {register
              ? "Your next chapter starts here."
              : "Welcome back, curious mind."}
          </h2>
          <p>
            {register
              ? "Create your student account. A good question is waiting."
              : "Pick up where you left off. There’s more to discover."}
          </p>
          <div className="auth-tabs">
            <button
              className={!register ? "active" : ""}
              onClick={() => setRegister(false)}
            >
              Log in
            </button>
            <button
              className={register ? "active" : ""}
              onClick={() => setRegister(true)}
            >
              Create account
            </button>
          </div>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <form onSubmit={submit}>
            {register && (
              <label className="field">
                Your name
                <input
                  required
                  maxLength={100}
                  autoComplete="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
            )}
            <label className="field">
              Email address
              <input
                type="email"
                required
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@example.com"
              />
            </label>
            <label className="field">
              Password
              <input
                type="password"
                required
                minLength={register ? 10 : 1}
                maxLength={128}
                autoComplete={register ? "new-password" : "current-password"}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={
                  register ? "At least 10 characters" : "Enter your password"
                }
              />
            </label>
            <button className="button auth-submit" disabled={busy}>
              {busy
                ? "One moment…"
                : register
                  ? "Create student account"
                  : "Enter your learning space"}
              <ArrowRight size={18} />
            </button>
          </form>
          <p className="auth-note">
            <GraduationCap size={19} />
            {register
              ? "Teacher accounts are created by your institution administrator."
              : "Students and teachers use the same secure login."}
          </p>
          <div className="auth-quote">
            “What does a learner understand
            <br />
            that a number cannot show?”
            <span>THE QUESTION THAT STARTED IT ALL</span>
          </div>
        </div>
      </section>
    </div>
  );
}
function BadgeLabel() {
  return (
    <div className="eyebrow">
      <span className="dot" /> A LITTLE CURIOSITY GOES A LONG WAY
    </div>
  );
}
