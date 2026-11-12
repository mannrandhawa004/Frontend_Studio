"use client";
import { useEffect, useMemo, useState } from "react";

type Template = {
  id: string;
  title: string;
  slug: string;
  category: string;
  framework: string;
  tags: string[];
  description: string;
  status: string;
  accent: string;
  updatedAt: string;
  hasPreview?: boolean;
  previewUrl?: string | null;
  publishedVersion?: number;
  version?: number;
};

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";
const API_BASE = API.replace("/api/v1", "");

export default function Studio() {
  const [items, setItems] = useState<Template[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [frameworkFilter, setFrameworkFilter] = useState("All");
  const [notice, setNotice] = useState("");
  const [activePreview, setActivePreview] = useState<Template | null>(null);
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [iframeKey, setIframeKey] = useState(0);

  useEffect(() => {
    fetch(`${API}/templates`)
      .then((r) => r.json())
      .then((d) => setItems(d.templates || []))
      .catch(() => setNotice("API is starting — refresh in a moment."));
  }, []);

  // Keyboard shortcut to close preview modal
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setActivePreview(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const categories = ["All", ...Array.from(new Set(items.map((x) => x.category)))];
  const frameworks = ["All", "React (Vite)", "Static HTML"];

  const visible = useMemo(() => {
    return items.filter((x) => {
      const matchCat = category === "All" || x.category === category;
      const matchFw =
        frameworkFilter === "All" ||
        (frameworkFilter === "React (Vite)" && x.framework.includes("react")) ||
        (frameworkFilter === "Static HTML" && x.framework === "static-html");
      const text = `${x.title} ${x.description} ${x.tags.join(" ")} ${x.category} ${x.framework}`.toLowerCase();
      const matchQuery = text.includes(query.toLowerCase());
      return matchCat && matchFw && matchQuery;
    });
  }, [items, query, category, frameworkFilter]);

  function getPreviewUrl(t: Template): string {
    if (t.previewUrl) return t.previewUrl;
    const v = t.publishedVersion || t.version || 1;
    return `${API_BASE}/previews/${t.id}/output/${v}/index.html`;
  }

  function openPreview(t: Template) {
    setActivePreview(t);
    setIframeKey((k) => k + 1);
  }

  return (
    <main>
      <nav>
        <a className="brand" href="#top">
          <span>◒</span> frontend studio
        </a>
        <div className="navlinks">
          <a href="#templates">Collection</a>
          <a href="#react-guide">How to add React templates</a>
          <a href="#workflow">Workflow</a>
          <a className="portal" href="/admin">
            Admin portal ↗
          </a>
        </div>
      </nav>

      <section className="hero" id="top">
        <p className="eyebrow">CURATED DIGITAL EXPERIENCES</p>
        <h1>
          Build a better
          <br />
          <i>first impression.</i>
        </h1>
        <p className="intro">
          A visual showcase and private workspace for collecting, reviewing, and publishing standout React and web templates.
        </p>
        <div className="actions">
          <a className="primary" href="#templates">
            Browse templates <b>→</b>
          </a>
          <a className="secondary" href="#react-guide">
            Add React template <span>↓</span>
          </a>
        </div>
        <div className="orb orb1" />
        <div className="orb orb2" />
      </section>

      <section className="ticker">
        <span>DESIGNED TO SHIP</span>
        <span>✦</span>
        <span>BUILT WITH REACT & VITE</span>
        <span>✦</span>
        <span>CURATED FOR IMPACT</span>
        <span>✦</span>
      </section>

      <section className="collection" id="templates">
        <div className="sectionhead">
          <div>
            <p className="eyebrow">THE COLLECTION</p>
            <h2>
              Made to be <i>noticed.</i>
            </h2>
          </div>
          <p>
            Browse interactive live previews of polished
            <br />
            starting points for your next project.
          </p>
        </div>

        <div className="filters">
          <input
            aria-label="Search templates"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="⌕  Search templates, tags, frameworks..."
          />
          <div className="filter-group">
            {categories.map((c) => (
              <button
                key={c}
                className={category === c ? "active" : ""}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {notice && <p className="notice">{notice}</p>}

        <div className="grid">
          {visible.map((t, i) => (
            <article
              className="card"
              key={t.id}
              onClick={() => openPreview(t)}
              style={{ cursor: "pointer" }}
            >
              <div className="preview" style={{ background: t.accent }}>
                <span className="previewMark">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="card-badge">
                  {t.framework.includes("react") ? "⚛ React" : "HTML/CSS"}
                </span>
                <div className="fakeUI">
                  <small>{t.framework}</small>
                  <strong>{t.title}</strong>
                  <em>
                    {t.tags[0] || "Web"} · {t.tags[1] || t.category}
                  </em>
                </div>
                <div className="hover-overlay">
                  <span>Open Live Demo ↗</span>
                </div>
              </div>
              <div className="cardmeta">
                <div>
                  <p>{t.category}</p>
                  <h3>{t.title}</h3>
                </div>
                <button
                  aria-label={`Preview ${t.title}`}
                  className="preview-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    openPreview(t);
                  }}
                  title="View live template preview"
                >
                  ↗
                </button>
              </div>
            </article>
          ))}
        </div>

        {!visible.length && (
          <p className="empty">Nothing matched that search or filter.</p>
        )}
      </section>

      {/* Guide: How to showcase React templates */}
      <section className="react-guide-section" id="react-guide">
        <div className="guide-card">
          <p className="eyebrow">DEVELOPER GUIDE</p>
          <h2>
            How to add & showcase <i>React templates.</i>
          </h2>
          <p className="guide-desc">
            Frontend Studio lets you showcase any React project (Vite, Next.js, or Create React App) in 3 simple steps:
          </p>

          <div className="guide-steps">
            <div className="guide-step">
              <span className="step-num">01</span>
              <h4>Build your React project</h4>
              <p>In your React project folder, run your production build command:</p>
              <code>npm run build</code>
              <p className="subtext">
                For Vite, this creates a <code>dist/</code> folder. For Next.js static export, this creates an <code>out/</code> folder.
              </p>
            </div>

            <div className="guide-step">
              <span className="step-num">02</span>
              <h4>Package or choose files</h4>
              <p>Zip your build folder into a <code>dist.zip</code> archive, or select the files inside it:</p>
              <code>index.html + assets/ images/</code>
              <p className="subtext">
                Frontend Studio automatically extracts <code>.zip</code> uploads and locates your bundled React code!
              </p>
            </div>

            <div className="guide-step">
              <span className="step-num">03</span>
              <h4>Register & Publish in Admin</h4>
              <p>Head over to the Admin portal:</p>
              <ol>
                <li>Click <b>+ New template</b> and select <i>Vite React</i></li>
                <li>Click <b>Manage</b> &rarr; upload your <code>.zip</code> or build files</li>
                <li>Click <b>Build</b> &rarr; then <b>Publish</b></li>
              </ol>
              <a className="guide-link" href="/admin">
                Open Admin Portal →
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="workflow" id="workflow">
        <p className="eyebrow">A DELIBERATE PROCESS</p>
        <h2>
          From source to <i>showcase.</i>
        </h2>
        <div className="steps">
          <div>
            <b>01</b>
            <h3>Import safely</h3>
            <p>Upload built React packages or static assets into isolated template folders.</p>
          </div>
          <div>
            <b>02</b>
            <h3>Review & build</h3>
            <p>Validate the output bundles with our responsive multi-device previewer.</p>
          </div>
          <div>
            <b>03</b>
            <h3>Publish boldly</h3>
            <p>Make standout designs accessible to visitors and clients worldwide.</p>
          </div>
        </div>
      </section>

      <section id="admin" className="admin">
        <div>
          <p className="eyebrow">ADMIN WORKSPACE</p>
          <h2>
            Everything in its <i>place.</i>
          </h2>
          <p>
            Manage template metadata, upload React bundles, inspect build jobs, and publish updates from one focused dashboard.
          </p>
        </div>
        <div className="admincard">
          <span className="live">● LOCAL STORAGE READY</span>
          <strong>
            {items.length || "—"}
            <small> published templates</small>
          </strong>
          <a href="/admin">Open dashboard →</a>
        </div>
      </section>

      {/* Interactive Live Preview Modal */}
      {activePreview && (
        <div
          className="live-modal-backdrop"
          onClick={() => setActivePreview(null)}
        >
          <div
            className="live-modal-window"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="live-modal-header">
              <div className="live-modal-meta">
                <span className="live-modal-badge">
                  {activePreview.framework.includes("react") ? "⚛ React" : "HTML"}
                </span>
                <strong>{activePreview.title}</strong>
                <span className="live-modal-cat">
                  {activePreview.category}
                </span>
              </div>

              <div className="viewport-toggles">
                <button
                  className={viewport === "desktop" ? "active" : ""}
                  onClick={() => setViewport("desktop")}
                  title="Desktop View (100%)"
                >
                  💻 Desktop
                </button>
                <button
                  className={viewport === "tablet" ? "active" : ""}
                  onClick={() => setViewport("tablet")}
                  title="Tablet View (768px)"
                >
                  📱 Tablet
                </button>
                <button
                  className={viewport === "mobile" ? "active" : ""}
                  onClick={() => setViewport("mobile")}
                  title="Mobile View (375px)"
                >
                  📱 Mobile
                </button>
              </div>

              <div className="live-modal-actions">
                <button
                  onClick={() => setIframeKey((k) => k + 1)}
                  title="Reload preview"
                  className="icon-btn"
                >
                  ↻
                </button>
                <a
                  href={getPreviewUrl(activePreview)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="external-link-btn"
                  title="Open in new window"
                >
                  Open in tab ↗
                </a>
                <button
                  className="close-btn"
                  onClick={() => setActivePreview(null)}
                  title="Close preview (Esc)"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className={`live-iframe-wrapper viewport-${viewport}`}>
              <iframe
                key={iframeKey}
                src={getPreviewUrl(activePreview)}
                title={activePreview.title}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                className="live-iframe"
              />
            </div>
          </div>
        </div>
      )}

      <footer>
        <a className="brand" href="#top">
          <span>◒</span> frontend studio
        </a>
        <span>© 2026 — Crafted with care for modern React developers.</span>
        <a href="#top">Back to top ↑</a>
      </footer>
    </main>
  );
}
