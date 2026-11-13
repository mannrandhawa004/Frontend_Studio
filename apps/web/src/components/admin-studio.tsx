"use client";
import { FormEvent, useEffect, useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";
const API_BASE = API.replace("/api/v1", "");

type Template = {
  id: string;
  slug: string;
  title: string;
  category: string;
  framework: string;
  tags: string[];
  description: string;
  status: string;
  accent: string;
  updatedAt: string;
  version: number;
  publishedVersion?: number;
  sourceFiles?: string[];
  hasPreview?: boolean;
  previewUrl?: string | null;
};

type Job = {
  id: string;
  templateTitle: string;
  status: string;
  stage: string;
  message: string;
  createdAt?: string;
};

type Toast = { text: string; kind: "success" | "error" } | null;

const auth = (token: string) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
});

function frameworkLabel(framework: string) {
  if (framework === "static-html") return "HTML/CSS";
  if (framework === "next-static-export") return "Next.js";
  return "Vite React";
}

function timeAgo(value?: string) {
  if (!value) return "just now";
  const diff = Date.now() - new Date(value).getTime();
  if (Number.isNaN(diff)) return "just now";
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString();
}

const statusFilters = [
  { id: "all", label: "All" },
  { id: "published", label: "Published" },
  { id: "draft", label: "Drafts" },
  { id: "building", label: "Building" },
  { id: "failed", label: "Failed" },
];

export default function AdminStudio() {
  const [token, setToken] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [toast, setToast] = useState<Toast>(null);
  const [form, setForm] = useState<"new" | "edit" | null>(null);
  const [selected, setSelected] = useState<Template | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pickedFiles, setPickedFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setToken(localStorage.getItem("studio-token") || "");
  }, []);

  useEffect(() => {
    if (token) void refresh();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh(true);
    }, 5000);
    return () => window.clearInterval(id);
  }, [token]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (!selected && !form) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSelected(null);
        setForm(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [selected, form]);

  async function refresh(silent = false) {
    if (!silent) setIsRefreshing(true);
    try {
      const [templatesRes, jobsRes] = await Promise.all([
        fetch(`${API}/admin/templates`, { headers: auth(token) }),
        fetch(`${API}/admin/jobs`, { headers: auth(token) }),
      ]);
      if (templatesRes.status === 401) {
        localStorage.removeItem("studio-token");
        setToken("");
        return;
      }
      const tData = await templatesRes.json();
      const jData = await jobsRes.json();
      const nextTemplates = tData.templates || [];
      setTemplates(nextTemplates);
      setJobs(jData.jobs || []);
      setSelected((prev) =>
        prev ? nextTemplates.find((t) => t.id === prev.id) || prev : null,
      );
    } catch {
      if (!silent) {
        setToast({ text: "Failed to connect to the API server.", kind: "error" });
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    const f = new FormData(event.currentTarget);
    try {
      const r = await fetch(`${API}/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: f.get("username"),
          password: f.get("password"),
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        setLoginError(d.message || "Unable to sign in.");
        return;
      }
      localStorage.setItem("studio-token", d.token);
      setToken(d.token);
      setToast({ text: "Welcome back — you're signed in.", kind: "success" });
    } catch {
      setLoginError("Could not reach the API server.");
    } finally {
      setLoginLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("studio-token");
    setToken("");
    setTemplates([]);
    setJobs([]);
  }

  async function request(
    url: string,
    method = "POST",
    body?: unknown,
    successText = "Operation completed.",
  ) {
    try {
      const r = await fetch(`${API}${url}`, {
        method,
        headers: auth(token),
        body: body ? JSON.stringify(body) : undefined,
      });
      const d = r.status === 204 ? {} : await r.json();
      if (!r.ok) {
        setToast({
          text: d.message || "Something went wrong. Please try again.",
          kind: "error",
        });
        return null;
      }
      setToast({ text: d.message || successText, kind: "success" });
      await refresh(true);
      return d;
    } catch {
      setToast({ text: "Failed to connect to the API server.", kind: "error" });
      return null;
    }
  }

  async function saveTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const data = {
      title: f.get("title"),
      category: f.get("category"),
      framework: f.get("framework"),
      description: f.get("description"),
      tags: String(f.get("tags") || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
    };
    const result = await request(
      form === "edit" ? `/admin/templates/${selected!.id}` : "/admin/templates",
      form === "edit" ? "PATCH" : "POST",
      data,
      form === "edit" ? "Template metadata updated." : "Draft created.",
    );
    if (result) {
      setForm(null);
      setSelected(null);
    }
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    if (!pickedFiles.length) {
      setToast({
        text: "Choose source files or a .zip archive first.",
        kind: "error",
      });
      return;
    }
    setIsUploading(true);
    const data = new FormData();
    pickedFiles.forEach((file) => data.append("source", file));
    try {
      const r = await fetch(`${API}/admin/templates/${selected.id}/source`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: data,
      });
      const d = await r.json();
      if (!r.ok) {
        setToast({ text: d.message || "Upload failed.", kind: "error" });
        return;
      }
      setToast({ text: d.message || "Files uploaded.", kind: "success" });
      if (d.template) setSelected(d.template);
      setPickedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await refresh(true);
    } catch {
      setToast({ text: "File upload failed.", kind: "error" });
    } finally {
      setIsUploading(false);
    }
  }

  function addFiles(list: FileList | null) {
    if (!list?.length) return;
    setPickedFiles(Array.from(list));
  }

  function openEdit(t: Template) {
    setSelected(t);
    setForm("edit");
  }

  function openManage(t: Template) {
    setSelected(t);
    setPickedFiles([]);
    setDragActive(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const preview = selected
    ? selected.previewUrl ||
      `${API_BASE}/previews/${selected.id}/output/${
        selected.publishedVersion || selected.version
      }/index.html`
    : "#";

  const filteredTemplates = templates.filter((t) => {
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    const haystack = `${t.title} ${t.category} ${t.tags.join(" ")} ${t.framework}`.toLowerCase();
    return matchStatus && haystack.includes(search.trim().toLowerCase());
  });

  const stats = {
    total: templates.length,
    published: templates.filter((t) => t.status === "published").length,
    review: templates.filter(
      (t) => t.status === "draft" || t.status === "building",
    ).length,
    failed: templates.filter((t) => t.status === "failed").length,
  };

  const toastNode = toast && (
    <div className={`toast ${toast.kind}`} role="status">
      <span aria-hidden="true">{toast.kind === "success" ? "✓" : "!"}</span>
      {toast.text}
    </div>
  );

  if (!token) {
    return (
      <main className="loginpage">
        <div className="login-shell">
          <aside className="login-art">
            <a className="brand" href="/">
              <span className="brand-mark">◒</span> <b>tessera</b>
            </a>
            <div className="login-art-copy">
              <p className="eyebrow">Private workspace</p>
              <h1>
                Ship beautiful
                <br />
                <i>first impressions.</i>
              </h1>
              <p>
                Collect, review, and publish your best React and static
                templates from one calm dashboard.
              </p>
              <ul className="login-points">
                <li>
                  <span>01</span> Upload a production build or .zip
                </li>
                <li>
                  <span>02</span> Preview across desktop, tablet, mobile
                </li>
                <li>
                  <span>03</span> Publish to your live gallery
                </li>
              </ul>
            </div>
            <span className="login-foot">
              <i /> Local storage • Admin access only
            </span>
          </aside>

          <form className="login-card" onSubmit={login}>
            <div className="login-card-head">
              <p className="eyebrow">Admin access</p>
              <h2>
                Welcome <i>back.</i>
              </h2>
              <p>Sign in to manage your template collection.</p>
            </div>

            <label className="field">
              <span>Username</span>
              <input name="username" defaultValue="admin" autoComplete="username" required />
            </label>

            <label className="field">
              <span>Password</span>
              <div className="password-wrap">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            {loginError && <p className="form-error">{loginError}</p>}

            <button className="btn btn-primary btn-block" disabled={loginLoading}>
              {loginLoading ? "Signing in…" : "Sign in →"}
            </button>

            <small className="login-hint">
              Local default credentials: <code>admin</code> / <code>studio</code>
            </small>
            <a className="login-back" href="/">
              ← Back to gallery
            </a>
          </form>
        </div>
        {toastNode}
      </main>
    );
  }

  return (
    <main className="adminpage">
      <header className="admin-topbar">
        <a className="brand" href="/">
          <span className="brand-mark">◒</span> <b>tessera</b>
        </a>
        <div className="admin-topbar-actions">
          <a href="/" className="gallerylink">
            ← View gallery
          </a>
          <span className="localdot">
            <i /> Local storage
          </span>
          <button
            className={`icon-btn bordered ${isRefreshing ? "is-spinning" : ""}`}
            onClick={() => void refresh()}
            title="Refresh data"
            aria-label="Refresh data"
          >
            ↻
          </button>
          <button className="logout-btn" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      <section className="adminhero">
        <div className="adminhero-copy">
          <p className="eyebrow">Admin workspace</p>
          <h1>
            Good to see you, <i>admin.</i>
          </h1>
          <p>
            Register a template, upload the production build, run a build, then
            publish it to your live gallery — all from here.
          </p>
          <div className="adminhero-actions">
            <button
              className="btn btn-primary"
              onClick={() => {
                setSelected(null);
                setForm("new");
              }}
            >
              + New template
            </button>
            <a className="btn btn-ghost" href="/">
              View gallery ↗
            </a>
          </div>
        </div>

        <div className="stat-grid">
          <div className="stat-card">
            <span>Total</span>
            <strong>{stats.total}</strong>
            <small>templates in workspace</small>
          </div>
          <div className="stat-card">
            <span>Published</span>
            <strong>{stats.published}</strong>
            <small>visible in the gallery</small>
          </div>
          <div className="stat-card">
            <span>In review</span>
            <strong>{stats.review}</strong>
            <small>draft or building</small>
          </div>
          <div className="stat-card">
            <span>Needs attention</span>
            <strong>{stats.failed}</strong>
            <small>failed builds</small>
          </div>
        </div>
      </section>

      <details className="admin-tip">
        <summary>
          <span>💡 How to add a React template</span>
          <small>Build → zip → upload → publish</small>
        </summary>
        <div className="tip-body">
          <p>
            <b>1.</b> Run <code>npm run build</code> in your React project
            (Vite produces <code>dist/</code>).
          </p>
          <p>
            <b>2.</b> Zip the <code>dist/</code> folder into{" "}
            <code>dist.zip</code>, or select the files inside it.
          </p>
          <p>
            <b>3.</b> Click <b>+ New template</b> and choose <i>Vite React</i>.
          </p>
          <p>
            <b>4.</b> Open <b>Manage</b> → upload → <b>Build</b> →{" "}
            <b>Publish</b>.
          </p>
        </div>
      </details>

      <section className="admincontent">
        <div className="inventory">
          <div className="inventory-head">
            <div>
              <h2>
                Templates <small>{templates.length}</small>
              </h2>
              <p>Manage source builds, previews, and publishing state.</p>
            </div>
            <div className="inventory-tools">
              <div className="searchbox compact">
                <span aria-hidden="true">⌕</span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search templates…"
                  aria-label="Search templates"
                />
              </div>
            </div>
          </div>

          <div className="status-filters">
            {statusFilters.map((f) => (
              <button
                key={f.id}
                className={statusFilter === f.id ? "active" : ""}
                aria-pressed={statusFilter === f.id}
                onClick={() => setStatusFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="row-skeletons" aria-label="Loading templates">
              {Array.from({ length: 4 }).map((_, i) => (
                <div className="row-skeleton" key={i}>
                  <span />
                  <span />
                  <span />
                </div>
              ))}
            </div>
          ) : filteredTemplates.length ? (
            <div className="template-list">
              {filteredTemplates.map((t) => (
                <div className="template-row" key={t.id}>
                  <div className="row-identity">
                    <span
                      className="accent-thumb"
                      style={{ background: t.accent }}
                      aria-hidden="true"
                    >
                      {t.title.slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <strong>{t.title}</strong>
                      <span className="row-sub">
                        {t.category} · v{t.version} · {frameworkLabel(t.framework)}
                      </span>
                      <div className="row-tags">
                        {t.tags.slice(0, 3).map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <span className={`status-pill ${t.status}`}>
                    <i /> {t.status}
                  </span>

                  <span className="row-updated">{timeAgo(t.updatedAt)}</span>

                  <div className="row-actions">
                    <button
                      className="btn-sm primary"
                      onClick={() => openManage(t)}
                    >
                      Manage
                    </button>
                    <a
                      className="icon-action"
                      href={
                        t.previewUrl ||
                        `${API_BASE}/previews/${t.id}/output/${
                          t.publishedVersion || t.version
                        }/index.html`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open preview"
                      aria-label={`Open preview of ${t.title}`}
                    >
                      ↗
                    </a>
                    <button
                      className="icon-action"
                      onClick={() =>
                        void request(
                          `/admin/templates/${t.id}/build`,
                          "POST",
                          undefined,
                          "Build queued. Activity will update automatically.",
                        )
                      }
                      title="Run build"
                      aria-label={`Build ${t.title}`}
                    >
                      ↻
                    </button>
                    <button
                      className="icon-action"
                      onClick={() =>
                        void request(
                          `/admin/templates/${t.id}/publish`,
                          "POST",
                          undefined,
                          "Template published to the gallery.",
                        )
                      }
                      title="Publish live"
                      aria-label={`Publish ${t.title}`}
                    >
                      ↑
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty compact">
              <span aria-hidden="true">⌕</span>
              <h3>No templates found.</h3>
              <p>Adjust the search or status filter to see more.</p>
              {(search || statusFilter !== "all") && (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("all");
                  }}
                >
                  Reset filters
                </button>
              )}
            </div>
          )}
        </div>

        <aside className="activity">
          <div className="activity-head">
            <h2>Build activity</h2>
            <span className="live">
              <i /> live
            </span>
          </div>
          {jobs.length ? (
            <div className="activity-list">
              {jobs.slice(0, 8).map((j) => (
                <div className="job" key={j.id}>
                  <div className="job-top">
                    <b>{j.templateTitle}</b>
                    <span className={`stage-tag ${j.status}`}>
                      <i /> {j.status}
                    </span>
                  </div>
                  <span className="job-stage">{j.stage}</span>
                  <p>{j.message}</p>
                  <small>{timeAgo(j.createdAt)}</small>
                </div>
              ))}
            </div>
          ) : (
            <div className="activity-empty">
              <span aria-hidden="true">◎</span>
              <p>No build logs yet.</p>
              <small>Run a build to see live progress here.</small>
            </div>
          )}
        </aside>
      </section>

      {selected && !form && (
        <div className="modal" onClick={() => setSelected(null)}>
          <div
            className="modalbox manage-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="manage-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="manage-head">
              <span
                className="accent-thumb large"
                style={{ background: selected.accent }}
                aria-hidden="true"
              >
                {selected.title.slice(0, 2).toUpperCase()}
              </span>
              <div>
                <p className="eyebrow">Manage template</p>
                <h2 id="manage-title">{selected.title}</h2>
                <div className="manage-meta">
                  <span className={`status-pill ${selected.status}`}>
                    <i /> {selected.status}
                  </span>
                  <span>v{selected.version}</span>
                  <span>{frameworkLabel(selected.framework)}</span>
                </div>
              </div>
              <button
                className="close"
                onClick={() => setSelected(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="manage-grid">
              <section className="manage-panel">
                <h3>Source files</h3>
                <p className="manage-help">
                  Upload your built output or a <code>.zip</code>. The build
                  entry must include <code>index.html</code>.
                </p>
                <form onSubmit={upload}>
                  <label
                    className={`dropzone ${dragActive ? "is-drag" : ""}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragActive(true);
                    }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragActive(false);
                      addFiles(e.dataTransfer.files);
                    }}
                  >
                    <input
                      ref={fileInputRef}
                      name="source"
                      type="file"
                      multiple
                      accept=".zip,application/zip,application/x-zip-compressed,application/octet-stream,*"
                      onChange={(e) => addFiles(e.target.files)}
                    />
                    <span className="drop-icon" aria-hidden="true">
                      ⇪
                    </span>
                    <strong>Drop files here or browse</strong>
                    <small>.zip or built files · index.html required</small>
                  </label>

                  {pickedFiles.length > 0 && (
                    <ul className="picked-files">
                      {pickedFiles.slice(0, 6).map((file) => (
                        <li key={file.name}>
                          <span>{file.name}</span>
                          <small>
                            {(file.size / 1024 / 1024).toFixed(1)} MB
                          </small>
                        </li>
                      ))}
                      {pickedFiles.length > 6 && (
                        <li className="muted">
                          +{pickedFiles.length - 6} more files
                        </li>
                      )}
                    </ul>
                  )}

                  <button
                    className="btn btn-primary btn-block"
                    disabled={isUploading || !pickedFiles.length}
                  >
                    {isUploading ? "Uploading & extracting…" : "Upload files"}
                  </button>
                </form>

                <p className="files">
                  {selected.sourceFiles?.length
                    ? `Uploaded files (${selected.sourceFiles.length}): ${selected.sourceFiles
                        .slice(0, 6)
                        .join(", ")}${selected.sourceFiles.length > 6 ? "…" : ""}`
                    : "No source files uploaded yet."}
                </p>
              </section>

              <section className="manage-panel">
                <h3>Actions</h3>
                <div className="manage-actions">
                  <button
                    className="action-tile"
                    onClick={() => openEdit(selected)}
                  >
                    <span aria-hidden="true">✎</span>
                    <div>
                      <b>Edit metadata</b>
                      <small>Title, category, tags, description</small>
                    </div>
                  </button>
                  <a
                    className="action-tile"
                    href={preview}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span aria-hidden="true">↗</span>
                    <div>
                      <b>Open preview</b>
                      <small>View the built template</small>
                    </div>
                  </a>
                  <button
                    className="action-tile"
                    onClick={() =>
                      void request(
                        `/admin/templates/${selected.id}/build`,
                        "POST",
                        undefined,
                        "Build queued. Activity will update automatically.",
                      )
                    }
                  >
                    <span aria-hidden="true">↻</span>
                    <div>
                      <b>Build now</b>
                      <small>Stage the latest source files</small>
                    </div>
                  </button>
                  <button
                    className="action-tile"
                    onClick={() =>
                      void request(
                        `/admin/templates/${selected.id}/publish`,
                        "POST",
                        undefined,
                        "Template published to the gallery.",
                      )
                    }
                  >
                    <span aria-hidden="true">↑</span>
                    <div>
                      <b>Publish live</b>
                      <small>Show this version in the gallery</small>
                    </div>
                  </button>
                </div>

                <div className="danger-zone">
                  <h4>Danger zone</h4>
                  <p>
                    Deleting removes this template and all of its stored files.
                  </p>
                  <button
                    className="btn btn-danger"
                    onClick={async () => {
                      if (
                        !confirm(
                          `Delete template "${selected.title}" and its storage?`,
                        )
                      )
                        return;
                      const result = await request(
                        `/admin/templates/${selected.id}`,
                        "DELETE",
                        undefined,
                        "Template deleted.",
                      );
                      if (result !== null) setSelected(null);
                    }}
                  >
                    Delete template
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {form && (
        <div
          className="modal"
          onClick={() => {
            setForm(null);
            setSelected(null);
          }}
        >
          <form
            className="modalbox form-modal"
            onSubmit={saveTemplate}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="form-head">
              <div>
                <p className="eyebrow">
                  {form === "new" ? "New entry" : "Edit entry"}
                </p>
                <h2>{form === "new" ? "New template" : "Edit template"}</h2>
                <p>
                  {form === "new"
                    ? "Start with the metadata — upload the build next."
                    : "Saving creates a new version of this template."}
                </p>
              </div>
              <button
                className="close"
                type="button"
                onClick={() => {
                  setForm(null);
                  setSelected(null);
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="form-grid">
              <label className="field">
                <span>Title</span>
                <input
                  name="title"
                  defaultValue={selected?.title}
                  placeholder="e.g. AI SaaS Studio"
                  required
                  autoFocus
                />
              </label>
              <label className="field">
                <span>Category</span>
                <input
                  name="category"
                  defaultValue={selected?.category}
                  placeholder="e.g. Agency, Portfolio, SaaS"
                  required
                />
              </label>
              <label className="field">
                <span>Framework</span>
                <select
                  name="framework"
                  defaultValue={selected?.framework || "vite-react-static"}
                >
                  <option value="vite-react-static">
                    ⚛ Vite React (dist folder or dist.zip)
                  </option>
                  <option value="next-static-export">
                    ▲ Next.js static export (out folder or zip)
                  </option>
                  <option value="static-html">
                    📄 Static HTML / Vanilla JS
                  </option>
                </select>
              </label>
              <label className="field">
                <span>Tags</span>
                <input
                  name="tags"
                  defaultValue={selected?.tags?.join(", ")}
                  placeholder="React, Tailwind, SaaS"
                />
              </label>
              <label className="field full">
                <span>Description</span>
                <textarea
                  name="description"
                  defaultValue={selected?.description}
                  placeholder="A short, useful description of this template."
                />
              </label>
            </div>

            <div className="form-actions">
              <button className="btn btn-primary">
                {form === "new" ? "Create draft →" : "Save new version →"}
              </button>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => {
                  setForm(null);
                  setSelected(null);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {toastNode}
    </main>
  );
}
