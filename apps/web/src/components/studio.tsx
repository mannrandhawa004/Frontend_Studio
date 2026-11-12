"use client";
import { useEffect, useMemo, useRef, useState } from "react";

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

type Toast = { text: string; kind: "success" | "error" } | null;

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";
const API_BASE = API.replace("/api/v1", "");

function frameworkLabel(framework: string) {
  if (framework === "static-html") return "HTML/CSS";
  if (framework === "next-static-export") return "Next.js";
  return "React";
}

export default function Studio() {
  const [items, setItems] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [frameworkFilter, setFrameworkFilter] = useState("all");
  const [sort, setSort] = useState("newest");
  const [toast, setToast] = useState<Toast>(null);
  const [activePreview, setActivePreview] = useState<Template | null>(null);
  const [viewport, setViewport] =
    useState<"desktop" | "tablet" | "mobile">("desktop");
  const [iframeKey, setIframeKey] = useState(0);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  async function loadTemplates() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/templates`);
      if (!r.ok) throw new Error("Unable to load templates");
      const d = await r.json();
      setItems(d.templates || []);
      setLoadError("");
    } catch {
      setLoadError("The API is starting up — refresh in a moment.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTemplates();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setActivePreview(null);
        setNavOpen(false);
      }
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if ((e.key === "/" && !typing) || ((e.metaKey || e.ctrlKey) && e.key === "k")) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!activePreview) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [activePreview]);

  useEffect(() => {
    setIframeLoaded(false);
  }, [iframeKey, activePreview]);

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(items.map((x) => x.category)))],
    [items],
  );

  const visible = useMemo(() => {
    const filtered = items.filter((x) => {
      const matchCat = category === "All" || x.category === category;
      const matchFw =
        frameworkFilter === "all" ||
        (frameworkFilter === "react" && x.framework.includes("react")) ||
        (frameworkFilter === "next" && x.framework === "next-static-export") ||
        (frameworkFilter === "static" && x.framework === "static-html");
      const text =
        `${x.title} ${x.description} ${x.tags.join(" ")} ${x.category} ${x.framework}`.toLowerCase();
      return matchCat && matchFw && text.includes(query.trim().toLowerCase());
    });

    return [...filtered].sort((a, b) => {
      if (sort === "az") return a.title.localeCompare(b.title);
      if (sort === "category") return a.category.localeCompare(b.category);
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [items, query, category, frameworkFilter, sort]);

  const publishedCount = items.length;
  const categoryCount = Math.max(categories.length - 1, 0);
  const heroItems = items.slice(0, 3);
  const hasFilters =
    query !== "" || category !== "All" || frameworkFilter !== "all";

  function getPreviewUrl(t: Template): string {
    if (t.previewUrl) return t.previewUrl;
    const v = t.publishedVersion || t.version || 1;
    return `${API_BASE}/previews/${t.id}/output/${v}/index.html`;
  }

  function openPreview(t: Template) {
    setViewport("desktop");
    setFullscreen(false);
    setIframeLoaded(false);
    setActivePreview(t);
    setIframeKey((k) => k + 1);
    setNavOpen(false);
  }

  function resetFilters() {
    setQuery("");
    setCategory("All");
    setFrameworkFilter("all");
    setSort("newest");
  }

  async function copyPreviewLink() {
    if (!activePreview) return;
    try {
      await navigator.clipboard.writeText(getPreviewUrl(activePreview));
      setToast({ text: "Preview link copied to clipboard.", kind: "success" });
    } catch {
      setToast({ text: "Could not copy the preview link.", kind: "error" });
    }
  }

  const frameworks = [
    { id: "all", label: "All builds" },
    { id: "react", label: "React" },
    { id: "next", label: "Next.js" },
    { id: "static", label: "HTML/CSS" },
  ];

  return (
    <div className="site">
      <a className="skip-link" href="#templates">
        Skip to templates
      </a>

      <nav className="nav" aria-label="Main navigation">
        <a className="brand" href="#top">
          <span className="brand-mark">◒</span>
          frontend <b>studio</b>
        </a>

        <div className="navlinks">
          <a href="#templates">Collection</a>
          <a href="#react-guide">How it works</a>
          <a href="#workflow">Workflow</a>
        </div>

        <div className="nav-actions">
          <span className="nav-status">
            <i aria-hidden="true" />{" "}
            {loading ? "Loading templates" : `${publishedCount} live templates`}
          </span>
          <a className="portal" href="/admin">
            Admin portal <span aria-hidden="true">↗</span>
          </a>
          <button
            className="nav-toggle"
            aria-label={navOpen ? "Close menu" : "Open menu"}
            aria-expanded={navOpen}
            onClick={() => setNavOpen((v) => !v)}
          >
            <span />
            <span />
          </button>
        </div>
      </nav>

      {navOpen && (
        <div className="mobile-menu">
          <a href="#templates" onClick={() => setNavOpen(false)}>
            Collection <span>{loading ? "…" : publishedCount}</span>
          </a>
          <a href="#react-guide" onClick={() => setNavOpen(false)}>
            How it works
          </a>
          <a href="#workflow" onClick={() => setNavOpen(false)}>
            Workflow
          </a>
          <a href="/admin" onClick={() => setNavOpen(false)}>
            Admin portal ↗
          </a>
        </div>
      )}

      <main>
        <section className="hero" id="top">
          <div className="hero-grid-bg" aria-hidden="true" />
          <div className="hero-copy">
            <p className="eyebrow hero-eyebrow">
              <span className="pulse-dot" aria-hidden="true" /> Curated digital
              experiences
            </p>
            <h1>
              Build a better
              <br />
              <i>first impression.</i>
            </h1>
            <p className="intro">
              A visual showcase and private workspace for collecting,
              reviewing, and publishing standout React and web templates.
            </p>
            <div className="actions">
              <a className="btn btn-primary" href="#templates">
                Browse templates <b aria-hidden="true">→</b>
              </a>
              <a className="btn btn-ghost" href="#react-guide">
                Add your template <span aria-hidden="true">↓</span>
              </a>
            </div>
            <dl className="hero-stats">
              <div>
                <dt>Live templates</dt>
                <dd>
                  {loading ? "—" : String(publishedCount).padStart(2, "0")}
                </dd>
              </div>
              <div>
                <dt>Categories</dt>
                <dd>
                  {loading ? "—" : String(categoryCount).padStart(2, "0")}
                </dd>
              </div>
              <div>
                <dt>Build targets</dt>
                <dd>03</dd>
              </div>
            </dl>
          </div>

          <div className="hero-visual" aria-hidden="true">
            <div className="hero-orb hero-orb-a" />
            <div className="hero-orb hero-orb-b" />
            <div className="hero-stack">
              {(heroItems.length
                ? heroItems
                : [
                    {
                      id: "a",
                      title: "Editorial",
                      category: "Agency",
                      accent: "linear-gradient(145deg,#3c554b,#9abca8)",
                      framework: "vite-react-static",
                      tags: [],
                    },
                    {
                      id: "b",
                      title: "Product",
                      category: "SaaS",
                      accent: "linear-gradient(145deg,#1e293b,#64748b)",
                      framework: "vite-react-static",
                      tags: [],
                    },
                    {
                      id: "c",
                      title: "Portfolio",
                      category: "Personal",
                      accent: "linear-gradient(145deg,#313d89,#b4b3ed)",
                      framework: "vite-react-static",
                      tags: [],
                    },
                  ]
              ).map((t, i) => (
                <div
                  className={`stack-card stack-card-${i}`}
                  key={t.id}
                  style={{ background: t.accent }}
                >
                  <div className="stack-chrome">
                    <i />
                    <i />
                    <i />
                    <span>{frameworkLabel(t.framework)}</span>
                  </div>
                  <div className="stack-body">
                    <small>{t.category}</small>
                    <strong>{t.title}</strong>
                    <em>Live preview</em>
                  </div>
                </div>
              ))}
            </div>
            <div className="hero-float">
              <span className="hero-float-dot" />
              <div>
                <b>Preview ready</b>
                <small>Responsive device modes</small>
              </div>
            </div>
          </div>
        </section>

        <div className="ticker" aria-hidden="true">
          <div className="ticker-track">
            {["Designed to ship", "Built with React & Vite", "Curated for impact", "Review in context", "Designed to ship", "Built with React & Vite", "Curated for impact", "Review in context"].map(
              (label, i) => (
                <span key={i}>
                  {label}
                  <i>✦</i>
                </span>
              ),
            )}
          </div>
        </div>

        <section className="collection" id="templates">
          <div className="sectionhead">
            <div>
              <p className="eyebrow">The collection</p>
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

          <div className="toolbar">
            <div className="searchbox">
              <span aria-hidden="true">⌕</span>
              <input
                ref={searchRef}
                aria-label="Search templates"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search templates, tags, frameworks…"
              />
              <kbd>/</kbd>
            </div>
            <div className="toolbar-right">
              <div className="segmented" aria-label="Filter by framework">
                {frameworks.map((f) => (
                  <button
                    key={f.id}
                    className={frameworkFilter === f.id ? "active" : ""}
                    aria-pressed={frameworkFilter === f.id}
                    onClick={() => setFrameworkFilter(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <label className="sort">
                <span>Sort</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  aria-label="Sort templates"
                >
                  <option value="newest">Newest</option>
                  <option value="az">A → Z</option>
                  <option value="category">Category</option>
                </select>
              </label>
            </div>
          </div>

          <div className="category-row">
            <div className="filter-group" aria-label="Filter by category">
              {categories.map((c) => (
                <button
                  key={c}
                  className={category === c ? "active" : ""}
                  aria-pressed={category === c}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="resultline">
              <span>
                {visible.length} {visible.length === 1 ? "template" : "templates"}
              </span>
              {hasFilters && (
                <button className="clear-filters" onClick={resetFilters}>
                  Clear filters ×
                </button>
              )}
            </div>
          </div>

          {loadError && (
            <div className="notice notice-with-action">
              <span>{loadError}</span>
              <button onClick={() => void loadTemplates()}>Retry</button>
            </div>
          )}

          {loading ? (
            <div className="grid" aria-label="Loading templates">
              {Array.from({ length: 6 }).map((_, i) => (
                <div className="card skeleton-card" key={i}>
                  <div className="skeleton-preview" />
                  <div className="skeleton-meta">
                    <span />
                    <span />
                  </div>
                </div>
              ))}
            </div>
          ) : visible.length ? (
            <div className="grid">
              {visible.map((t, i) => (
                <article
                  className="card"
                  key={t.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open live preview of ${t.title}`}
                  onClick={() => openPreview(t)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openPreview(t);
                    }
                  }}
                >
                  <div className="preview" style={{ background: t.accent }}>
                    <div className="preview-top">
                      <span className="previewMark">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="card-badge">
                        {t.framework.includes("react")
                          ? "⚛ React"
                          : frameworkLabel(t.framework)}
                      </span>
                    </div>
                    <div className="preview-chrome" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </div>
                    <div className="fakeUI">
                      <small>{t.category}</small>
                      <strong>{t.title}</strong>
                      <em>
                        {t.tags.slice(0, 2).join(" · ") || t.category}
                      </em>
                    </div>
                    <span className="preview-live">
                      <i /> Live
                    </span>
                    <div className="hover-overlay">
                      <span>Open live preview ↗</span>
                    </div>
                  </div>
                  <div className="cardmeta">
                    <div>
                      <p>
                        {t.category} · v{t.publishedVersion || t.version || 1}
                      </p>
                      <h3>{t.title}</h3>
                      <div className="card-tags">
                        {t.tags.slice(0, 3).map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>
                    </div>
                    <span className="preview-btn" aria-hidden="true">
                      ↗
                    </span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty">
              <span aria-hidden="true">⌕</span>
              <h3>No templates match that search.</h3>
              <p>Try a different keyword, category, or build target.</p>
              <button className="btn btn-primary" onClick={resetFilters}>
                Reset filters
              </button>
            </div>
          )}
        </section>

        <section className="react-guide-section" id="react-guide">
          <div className="guide-card">
            <div className="guide-head">
              <div>
                <p className="eyebrow">Developer guide</p>
                <h2>
                  Add & showcase <i>React templates.</i>
                </h2>
              </div>
              <p className="guide-desc">
                Frontend Studio lets you showcase any React project — Vite,
                Next.js, or Create React App — in three simple steps.
              </p>
            </div>

            <div className="guide-steps">
              <div className="guide-step">
                <span className="step-num">01</span>
                <h4>Build your project</h4>
                <p>In your React project folder, run your production build command:</p>
                <code>npm run build</code>
                <p className="subtext">
                  Vite creates a <code>dist/</code> folder. Next.js static export
                  creates an <code>out/</code> folder.
                </p>
              </div>

              <div className="guide-step">
                <span className="step-num">02</span>
                <h4>Package your files</h4>
                <p>Zip the build folder, or select the files inside it directly:</p>
                <code>index.html + assets/ + images/</code>
                <p className="subtext">
                  Uploads are extracted automatically and your bundled app is
                  located for you.
                </p>
              </div>

              <div className="guide-step">
                <span className="step-num">03</span>
                <h4>Register & publish</h4>
                <p>Head to the admin portal and follow the short flow:</p>
                <ol>
                  <li>
                    <b>New template</b> → choose Vite React
                  </li>
                  <li>
                    <b>Manage</b> → upload your .zip
                  </li>
                  <li>
                    <b>Build</b> → then <b>Publish</b>
                  </li>
                </ol>
                <a className="guide-link" href="/admin">
                  Open admin portal →
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="workflow" id="workflow">
          <div className="workflow-head">
            <div>
              <p className="eyebrow">A deliberate process</p>
              <h2>
                From source to <i>showcase.</i>
              </h2>
            </div>
            <p>
              Three quiet steps between a local build and a confident
              client-ready link.
            </p>
          </div>
          <div className="steps">
            <div>
              <b>01</b>
              <h3>Import safely</h3>
              <p>
                Upload built React packages or static assets into isolated
                template folders.
              </p>
              <span aria-hidden="true">↳</span>
            </div>
            <div>
              <b>02</b>
              <h3>Review & build</h3>
              <p>
                Validate the output bundles with a responsive multi-device
                previewer.
              </p>
              <span aria-hidden="true">↳</span>
            </div>
            <div>
              <b>03</b>
              <h3>Publish boldly</h3>
              <p>
                Make standout designs accessible to visitors and clients
                worldwide.
              </p>
              <span aria-hidden="true">↳</span>
            </div>
          </div>
        </section>

        <section id="admin" className="admin">
          <div>
            <p className="eyebrow">Admin workspace</p>
            <h2>
              Everything in its <i>place.</i>
            </h2>
            <p>
              Manage template metadata, upload React bundles, inspect build
              jobs, and publish updates from one focused dashboard.
            </p>
          </div>
          <div className="admincard">
            <span className="live">
              <i /> Local storage ready
            </span>
            <strong>
              {items.length || "—"}
              <small> published templates</small>
            </strong>
            <div className="admincard-meta">
              <span>Auto-preview</span>
              <span>Device testing</span>
              <span>Build logs</span>
            </div>
            <a href="/admin">Open dashboard →</a>
          </div>
        </section>
      </main>

      <footer>
        <a className="brand" href="#top">
          <span className="brand-mark">◒</span> frontend <b>studio</b>
        </a>
        <span>© 2026 — Crafted with care for modern React developers.</span>
        <a href="#top">Back to top ↑</a>
      </footer>

      {activePreview && (
        <div
          className={`live-modal-backdrop ${fullscreen ? "is-fullscreen" : ""}`}
          onClick={() => setActivePreview(null)}
          role="presentation"
        >
          <div
            className={`live-modal-window viewport-${viewport}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="preview-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="live-modal-header">
              <div className="live-modal-meta">
                <span className="live-modal-badge">
                  {activePreview.framework.includes("react")
                    ? "⚛ React"
                    : frameworkLabel(activePreview.framework)}
                </span>
                <div>
                  <strong id="preview-title">{activePreview.title}</strong>
                  <span className="live-modal-cat">
                    {activePreview.category} · v
                    {activePreview.publishedVersion ||
                      activePreview.version ||
                      1}
                  </span>
                </div>
              </div>

              <div className="viewport-toggles" aria-label="Preview size">
                {(
                  [
                    ["desktop", "💻", "Desktop"],
                    ["tablet", "▭", "Tablet"],
                    ["mobile", "▯", "Mobile"],
                  ] as const
                ).map(([id, icon, label]) => (
                  <button
                    key={id}
                    className={viewport === id ? "active" : ""}
                    onClick={() => setViewport(id)}
                    title={`${label} view`}
                    aria-pressed={viewport === id}
                  >
                    <span aria-hidden="true">{icon}</span> {label}
                  </button>
                ))}
              </div>

              <div className="live-modal-actions">
                <button
                  onClick={() => {
                    setIframeLoaded(false);
                    setIframeKey((k) => k + 1);
                  }}
                  title="Reload preview"
                  className="icon-btn"
                  aria-label="Reload preview"
                >
                  ↻
                </button>
                <button
                  onClick={() => setFullscreen((v) => !v)}
                  title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
                  className="icon-btn"
                  aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
                >
                  {fullscreen ? "⤡" : "⤢"}
                </button>
                <button
                  onClick={copyPreviewLink}
                  className="external-link-btn ghost"
                  title="Copy preview link"
                >
                  Copy link
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
                  aria-label="Close preview"
                  autoFocus
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="live-modal-toolbar">
              <span className="url-pill">
                {getPreviewUrl(activePreview).replace(/^https?:\/\//, "")}
              </span>
              <span className="toolbar-hint">Press Esc to close</span>
            </div>

            <div className="live-iframe-wrapper">
              {!iframeLoaded && (
                <div className="iframe-loader" role="status">
                  <span className="spinner" />
                  Loading preview…
                </div>
              )}
              <iframe
                key={iframeKey}
                src={getPreviewUrl(activePreview)}
                title={activePreview.title}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                className="live-iframe"
                onLoad={() => setIframeLoaded(true)}
              />
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast ${toast.kind}`} role="status">
          <span aria-hidden="true">{toast.kind === "success" ? "✓" : "!"}</span>
          {toast.text}
        </div>
      )}
    </div>
  );
}
