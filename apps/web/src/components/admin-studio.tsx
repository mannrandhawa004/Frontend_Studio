"use client";
import { FormEvent, useEffect, useState } from "react";

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
  version: number;
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
};

const auth = (token: string) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
});

export default function AdminStudio() {
  const [token, setToken] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState<"new" | "edit" | null>(null);
  const [selected, setSelected] = useState<Template | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    setToken(localStorage.getItem("studio-token") || "");
  }, []);

  useEffect(() => {
    if (token) void refresh();
  }, [token]);

  async function refresh() {
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
      setTemplates(tData.templates || []);
      setJobs(jData.jobs || []);
    } catch {
      setNotice("Failed to connect to API server.");
    }
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
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
      setNotice(d.message);
      return;
    }
    localStorage.setItem("studio-token", d.token);
    setToken(d.token);
    setNotice("");
  }

  async function request(url: string, method = "POST", body?: unknown) {
    const r = await fetch(`${API}${url}`, {
      method,
      headers: auth(token),
      body: body ? JSON.stringify(body) : undefined,
    });
    const d = r.status === 204 ? {} : await r.json();
    setNotice(d.message || "Operation completed.");
    if (r.ok) {
      setForm(null);
      setSelected(null);
      await refresh();
    }
    return r.ok;
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
    await request(
      form === "edit" ? `/admin/templates/${selected!.id}` : "/admin/templates",
      form === "edit" ? "PATCH" : "POST",
      data,
    );
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const input = event.currentTarget.elements.namedItem("source") as HTMLInputElement;
    if (!input.files?.length) {
      setNotice("Choose source files or a .zip archive first.");
      return;
    }
    setIsUploading(true);
    setNotice("Uploading files...");
    const data = new FormData();
    Array.from(input.files).forEach((file) => data.append("source", file));
    try {
      const r = await fetch(`${API}/admin/templates/${selected.id}/source`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: data,
      });
      const d = await r.json();
      setNotice(d.message);
      if (r.ok) {
        if (d.template) {
          setSelected(d.template);
        }
        await refresh();
      }
    } catch {
      setNotice("File upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  if (!token) {
    return (
      <main className="login">
        <a className="brand" href="/">
          ◒ frontend studio
        </a>
        <form onSubmit={login}>
          <p className="eyebrow">LOCAL ADMIN ACCESS</p>
          <h1>
            Welcome <i>back.</i>
          </h1>
          <label>
            Username
            <input name="username" defaultValue="admin" required />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              placeholder="studio"
              required
            />
          </label>
          {notice && <p className="formmessage">{notice}</p>}
          <button>Sign in →</button>
          <small>
            Local default credentials: <code>admin</code> / <code>studio</code>.
          </small>
        </form>
      </main>
    );
  }

  const preview = selected
    ? selected.previewUrl ||
      `${API_BASE}/previews/${selected.id}/output/${selected.version}/index.html`
    : "#";

  return (
    <main className="adminpage">
      <header>
        <a className="brand" href="/">
          ◒ frontend studio
        </a>
        <div>
          <a href="/" className="gallerylink" style={{ marginRight: 20 }}>
            ← View Gallery
          </a>
          <span className="localdot">● local storage</span>
          <button
            onClick={() => {
              localStorage.removeItem("studio-token");
              setToken("");
            }}
          >
            Log out
          </button>
        </div>
      </header>

      <section className="adminhero">
        <div>
          <p className="eyebrow">ADMIN WORKSPACE</p>
          <h1>
            Make it <i>yours.</i>
          </h1>
          <p>
            Register your React or static template, upload the production build files or <code>.zip</code>, run a build, then publish it to your live gallery.
          </p>
        </div>
        <button
          className="addbutton"
          onClick={() => {
            setSelected(null);
            setForm("new");
          }}
        >
          + New template
        </button>
      </section>

      {notice && <p className="formmessage wide">{notice}</p>}

      {/* Developer quick reference for React templates */}
      <section className="admin-react-tip">
        <div className="tip-box">
          <strong>💡 How to add React templates:</strong>
          <p>
            1. In your React app folder, run <code>npm run build</code> (Vite produces <code>dist/</code>).<br />
            2. Zip your <code>dist/</code> folder into <code>dist.zip</code> (or select files inside it).<br />
            3. Click <b>+ New template</b> &rarr; choose <i>Vite React</i>.<br />
            4. Click <b>Manage</b> &rarr; upload your <code>.zip</code> &rarr; click <b>Build</b> &rarr; <b>Publish</b>!
          </p>
        </div>
      </section>

      {form && (
        <form className="templateform" onSubmit={saveTemplate}>
          <h2>{form === "new" ? "New template" : "Edit template"}</h2>
          <input
            name="title"
            defaultValue={selected?.title}
            placeholder="Template title (e.g. AI SaaS Studio)"
            required
          />
          <input
            name="category"
            defaultValue={selected?.category}
            placeholder="Category (e.g. Landing page, Portfolio, Agency)"
            required
          />
          <select
            name="framework"
            defaultValue={selected?.framework || "vite-react-static"}
          >
            <option value="vite-react-static">
              ⚛ Vite React (dist folder or dist.zip)
            </option>
            <option value="next-static-export">
              ▲ Next.js Static Export (out folder or zip)
            </option>
            <option value="static-html">
              📄 Static HTML / Vanilla JS
            </option>
          </select>
          <input
            name="tags"
            defaultValue={selected?.tags?.join(", ")}
            placeholder="Tags, separated by commas (e.g. React, Tailwind, SaaS)"
          />
          <textarea
            name="description"
            defaultValue={selected?.description}
            placeholder="Short template description"
          />
          <div>
            <button>
              {form === "new" ? "Create draft" : "Save new version"}
            </button>
            <button
              className="plain"
              type="button"
              onClick={() => setForm(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <section className="admincontent">
        <div className="inventory">
          <div className="tablehead">
            <h2>
              Templates <small>{templates.length}</small>
            </h2>
            <button onClick={() => void refresh()}>Refresh ↻</button>
          </div>
          {templates.map((t) => (
            <div className="row" key={t.id}>
              <div>
                <strong>{t.title}</strong>
                <span>
                  {t.category} · v{t.version} · {t.framework}
                </span>
              </div>
              <span className={`status ${t.status}`}>{t.status}</span>
              <div className="rowbuttons">
                <button onClick={() => setSelected(t)}>Manage</button>
                <a
                  className="previewlink"
                  href={
                    t.previewUrl ||
                    `${API_BASE}/previews/${t.id}/output/${t.version}/index.html`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: "underline", fontSize: 12, color: "inherit" }}
                >
                  Preview ↗
                </a>
                <button
                  onClick={async () => {
                    await request(`/admin/templates/${t.id}/build`);
                    setTimeout(() => refresh(), 1200);
                  }}
                >
                  Build
                </button>
                <button
                  onClick={() =>
                    void request(`/admin/templates/${t.id}/publish`)
                  }
                >
                  Publish
                </button>
              </div>
            </div>
          ))}
        </div>
        <aside>
          <h2>Build activity</h2>
          {jobs.length ? (
            jobs.slice(0, 8).map((j) => (
              <div className="job" key={j.id}>
                <b>{j.templateTitle}</b>
                <span className={`stage-tag ${j.status}`}>
                  {j.stage} · {j.status}
                </span>
                <p>{j.message}</p>
              </div>
            ))
          ) : (
            <p className="muted">No build logs yet.</p>
          )}
        </aside>
      </section>

      {/* Template Management Modal */}
      {selected && (
        <div className="modal" onClick={() => setSelected(null)}>
          <div className="modalbox" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setSelected(null)}>
              ×
            </button>
            <p className="eyebrow">MANAGE TEMPLATE</p>
            <h2>{selected.title}</h2>
            <p className="muted">
              For React templates, run <code>npm run build</code> in your project, then upload your <code>dist.zip</code> or all files from <code>dist/</code> (must include <code>index.html</code>).
            </p>
            <form onSubmit={upload}>
              <input
                name="source"
                type="file"
                multiple
                accept=".zip,application/zip,application/x-zip-compressed,application/octet-stream,*"
                required
              />
              <button disabled={isUploading}>
                {isUploading ? "Uploading & Extracting..." : "Upload files or .zip"}
              </button>
            </form>
            <p className="files">
              {selected.sourceFiles?.length
                ? `Uploaded files (${selected.sourceFiles.length}): ${selected.sourceFiles.slice(0, 8).join(", ")}${selected.sourceFiles.length > 8 ? "..." : ""}`
                : "No source files uploaded yet."}
            </p>
            <div className="modalactions">
              <button
                onClick={() => {
                  setForm("edit");
                  setSelected(selected);
                }}
              >
                Edit metadata
              </button>
              <a
                className="previewlink"
                href={preview}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open preview ↗
              </a>
              <button
                onClick={async () => {
                  await request(`/admin/templates/${selected.id}/build`);
                  setTimeout(() => refresh(), 1200);
                }}
              >
                Build now
              </button>
              <button
                onClick={() =>
                  void request(`/admin/templates/${selected.id}/publish`)
                }
              >
                Publish live
              </button>
              <button
                className="danger"
                onClick={() => {
                  if (
                    confirm(
                      `Delete template "${selected.title}" and its storage?`,
                    )
                  ) {
                    void request(`/admin/templates/${selected.id}`, "DELETE");
                  }
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
