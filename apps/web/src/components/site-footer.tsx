"use client";
import { useState, type FormEvent } from "react";
import Key3D from "./key-3d";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

type Status = "idle" | "loading" | "done" | "error";

export default function SiteFooter() {
  const year = new Date().getFullYear();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function subscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "loading") return;

    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
      setStatus("error");
      setMessage("Please enter a valid email address.");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const r = await fetch(`${API}/newsletter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatus("error");
        setMessage(d.message || "Something went wrong. Please try again.");
        return;
      }
      setStatus("done");
      setMessage(d.message || "You're on the list — check your inbox.");
    } catch {
      setStatus("error");
      setMessage("Could not reach the server. Try again in a moment.");
    }
  }

  return (
    <footer className="site-footer">
      <div className="sf-inner">
        <div className="sf-top">
          <div className="sf-news">
            <a className="sf-brand" href="#top">
              <span className="sf-brand-mark" aria-hidden="true">
                ◒
              </span>
              <span>tessera</span>
            </a>

            <p className="sf-pitch">
              Join the list for <b>20% off</b> your first purchase — plus first
              looks at every new template we publish.
            </p>

            <form className="sf-form" onSubmit={subscribe} noValidate>
              <label className="sf-visually-hidden" htmlFor="sf-email">
                Email address
              </label>
              <input
                id="sf-email"
                className="sf-input"
                type="email"
                name="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (status === "error" || status === "done") {
                    setStatus("idle");
                    setMessage("");
                  }
                }}
                placeholder="Email address"
                autoComplete="email"
                aria-invalid={status === "error"}
                disabled={status === "loading"}
              />
              <button
                className={`sf-submit ${status === "done" ? "is-done" : ""}`}
                type="submit"
                disabled={status === "loading"}
              >
                {status === "loading" ? (
                  <>
                    <span className="sf-spinner" aria-hidden="true" />
                    Joining…
                  </>
                ) : status === "done" ? (
                  <>
                    <span aria-hidden="true">✓</span> You&apos;re in
                  </>
                ) : (
                  <>
                    Subscribe <span aria-hidden="true">→</span>
                  </>
                )}
              </button>
              <p
                className={`sf-msg ${status === "error" ? "is-error" : ""} ${
                  status === "done" ? "is-done" : ""
                }`}
                role="status"
                aria-live="polite"
              >
                {message}
              </p>
            </form>

            <p className="sf-fine">No spam. Unsubscribe anytime.</p>
          </div>

          <nav className="sf-links" aria-label="Footer">
            <div className="sf-col">
              <p className="sf-col-title">Explore</p>
              <a href="#templates">Collection</a>
              <a href="#why">Why tessera</a>
              <a href="#faq">FAQ</a>
            </div>
            <div className="sf-col">
              <p className="sf-col-title">Say hello</p>
              <a href="mailto:hello@tessera.studio">hello@tessera.studio</a>
              <a href="#top">Back to top ↑</a>
            </div>
          </nav>
        </div>

        <div className="sf-cta">
          <p className="sf-eyebrow">Ready when you are</p>
          <h2>
            Make a better
            <br />
            <i>first impression.</i>
          </h2>
          <div className="sf-key-wrap">
            <Key3D />
          </div>
        </div>

        <div className="sf-bottom">
          <span>© {year} Tessera. Curated templates for the modern web.</span>
          <span>Built with React &amp; Next.js</span>
        </div>
      </div>

      <div className="sf-wordmark" aria-hidden="true">
        <svg viewBox="0 0 1071.89 190" role="presentation" focusable="false">
          <text
            x="0"
            y="150"
            fill="currentColor"
            fontSize="197.28"
            fontWeight={700}
            letterSpacing="-7.89"
            textLength="1071.89"
            lengthAdjust="spacingAndGlyphs"
            style={{ fontFamily: "DM Sans, sans-serif" }}
          >
            tessera
          </text>
        </svg>
      </div>
    </footer>
  );
}
