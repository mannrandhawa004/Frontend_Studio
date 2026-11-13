import {
  useEffect,
  useRef,
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
// import { Logomark } from "./icons";

/**
 * A real CSS-3D "keyboard key" button.
 *
 * Geometry mirrors the original LaunchNow footer key (a 303 × 87 × 45 px smoked-glass block
 * sitting on a tilted floor plane), rendered natively at 1.5× so the label stays razor sharp.
 * Every face is an actual plane in 3D space; motion is driven by small spring simulations:
 *   • idle   – floats & sways gently
 *   • hover  – lifts off the floor, shadow spreads, rim light + glass sheen
 *   • press  – the key physically compresses (45px → 18px tall) like a keyboard switch
 *   • move   – the whole key tilts toward the cursor
 */

type Props = {
  label?: string;
  href?: string;
  onActivate?: () => void;
};

type Spring = { x: number; v: number; t: number; k: number; c: number };

const spring = (x: number, k: number, c: number): Spring => ({ x, v: 0, t: x, k, c });
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// key thickness (px)
const REST_H = 45;
const PRESS_H = 18;
// distance the key floats above its floor (px)
const REST_LIFT = 19.5;
const HOVER_LIFT = 34;
const PRESS_LIFT = 16.5;

const FLOOR_TRANSFORM =
  "translate(-50%, -50%) perspective(5000px) rotateX(var(--tx)) rotateY(var(--ty)) translateZ(53px) rotate(calc(41deg + var(--sway))) rotateX(37deg) rotateY(-31deg)";

// Projected silhouette of the key inside the 560 × 407 stage (pre-computed from the 3D matrices,
// padded so hover-lift never makes the pointer fall off the edge → no flicker).
const HIT_AREA = "polygon(163px 54px, 454px 165px, 457px 224px, 405px 285px, 112px 172px, 108px 114px)";

const INITIAL_VARS = {
  "--h": `${REST_H}px`,
  "--hh": `${REST_H / 2}px`,
  "--hs": "1",
  "--lift": `${REST_LIFT}px`,
  "--tx": "0deg",
  "--ty": "0deg",
  "--sway": "0deg",
  "--glow": "0",
  "--lx": "35.5%",
  "--ly": "66.1%",
  "--sh-x": "42px",
  "--sh-y": "63px",
  "--sh-s": "1",
  "--sh-o": "1",
} as CSSProperties;

const plane = (style: CSSProperties): CSSProperties => ({
  position: "absolute",
  transformStyle: "preserve-3d",
  ...style,
});

export default function Key3D({ label = "Pick Your Template", href = "#templates", onActivate }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const flags = useRef({ hover: false, down: false, visible: true, reduced: false });
  const springs = useRef({
    h: spring(REST_H, 760, 30),
    lift: spring(REST_LIFT, 230, 15),
    tx: spring(0, 70, 13),
    ty: spring(0, 70, 13),
    glow: spring(0, 170, 21),
  });

  const sync = () => {
    const f = flags.current;
    const s = springs.current;
    s.h.t = f.down ? PRESS_H : REST_H;
    s.lift.t = f.down ? PRESS_LIFT : f.hover ? HOVER_LIFT : REST_LIFT;
    s.glow.t = f.hover || f.down ? 1 : 0;
    const el = stageRef.current;
    if (el) {
      el.dataset.hover = String(f.hover);
      el.dataset.down = String(f.down);
    }
  };

  /* ---------------- animation loop ---------------- */
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    flags.current.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const list = Object.values(springs.current);
    const start = performance.now();
    let last = start;
    let raf = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!flags.current.visible) return;

      // semi-implicit Euler, sub-stepped for stiff springs
      const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
      const h = dt / steps;
      for (let i = 0; i < steps; i++) {
        for (const sp of list) {
          const a = -sp.k * (sp.x - sp.t) - sp.c * sp.v;
          sp.v += a * h;
          sp.x += sp.v * h;
        }
      }

      const s = springs.current;
      const t = (now - start) / 1000;
      const glow = clamp(s.glow.x, 0, 1.15);
      const idle = flags.current.reduced ? 0 : 1 - clamp(glow, 0, 1);
      const bob = Math.sin(t * 1.6) * 4.5 * idle;
      const sway = Math.sin(t * 0.8 + 1.2) * 1.25 * idle;
      const lift = s.lift.x + bob;
      const height = Math.max(8, s.h.x);
      const e = (lift - REST_LIFT) / (HOVER_LIFT - REST_LIFT); // 0 = resting, 1 = hovering

      const r2 = (v: number) => v.toFixed(2);
      const r3 = (v: number) => v.toFixed(3);
      el.style.setProperty("--h", `${r2(height)}px`);
      el.style.setProperty("--hh", `${r2(height / 2)}px`);
      el.style.setProperty("--hs", r3(height / REST_H));
      el.style.setProperty("--lift", `${r2(lift)}px`);
      el.style.setProperty("--tx", `${r2(s.tx.x)}deg`);
      el.style.setProperty("--ty", `${r2(s.ty.x)}deg`);
      el.style.setProperty("--sway", `${r3(sway)}deg`);
      el.style.setProperty("--glow", r3(glow));
      // glass reflection follows the tilt → light appears fixed in the room
      el.style.setProperty("--lx", `${r2(35.5 + s.ty.x * 2.4)}%`);
      el.style.setProperty("--ly", `${r2(66.1 - s.tx.x * 2.6)}%`);
      el.style.setProperty("--sh-x", `${r2(42 + 22 * e)}px`);
      el.style.setProperty("--sh-y", `${r2(63 + 32 * e)}px`);
      el.style.setProperty("--sh-s", r3(1 + 0.13 * e));
      el.style.setProperty("--sh-o", r3(clamp(1 - 0.3 * e, 0.45, 1.12)));
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* ---------------- cursor-follow tilt ---------------- */
  useEffect(() => {
    const s = springs.current;
    const onMove = (ev: PointerEvent) => {
      const el = stageRef.current;
      if (!el || !flags.current.visible || flags.current.reduced || ev.pointerType === "touch") return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width * 0.5;
      const cy = r.top + r.height * 0.43;
      const nx = clamp((ev.clientX - cx) / 560, -1, 1);
      const ny = clamp((ev.clientY - cy) / 380, -1, 1);
      s.ty.t = nx * 11;
      s.tx.t = -ny * 9;
    };
    const reset = () => {
      s.tx.t = 0;
      s.ty.t = 0;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", reset);
    window.addEventListener("blur", reset);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("mouseleave", reset);
      window.removeEventListener("blur", reset);
    };
  }, []);

  /* ---------------- pause when off-screen ---------------- */
  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => {
      flags.current.visible = entry.isIntersecting;
    }, { rootMargin: "160px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /* ---------------- interaction ---------------- */
  const activate = () => {
    springs.current.lift.v += 240; // springy "pop" on release
    window.setTimeout(() => {
      if (onActivate) onActivate();
      else document.querySelector(href)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 280);
  };

  const press = (down: boolean) => {
    flags.current.down = down;
    sync();
  };

  const onPointerEnter = () => {
    flags.current.hover = true;
    sync();
  };
  const onPointerLeave = () => {
    flags.current.hover = false;
    flags.current.down = false;
    sync();
  };
  const onPointerDown = (e: ReactPointerEvent<HTMLAnchorElement>) => {
    if (e.button !== 0) return;
    press(true);
  };
  const onPointerUp = () => press(false);
  const onClick = (e: ReactMouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    activate();
  };
  const onKeyDown = (e: ReactKeyboardEvent<HTMLAnchorElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!flags.current.down) press(true);
    }
  };
  const onKeyUp = (e: ReactKeyboardEvent<HTMLAnchorElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      press(false);
      activate();
    }
  };
  const onFocus = (e: ReactFocusEvent<HTMLAnchorElement>) => {
    const el = stageRef.current;
    if (el) el.dataset.focus = String(e.currentTarget.matches(":focus-visible"));
  };
  const onBlur = () => {
    const el = stageRef.current;
    if (el) el.dataset.focus = "false";
    press(false);
  };

  return (
    <div
      ref={stageRef}
      className="key3d relative h-[407px] w-[560px] select-none"
      data-hover="false"
      data-down="false"
      data-focus="false"
      style={INITIAL_VARS}
    >
      {/* Floor plane (tilted) */}
      <div
        style={plane({
          left: "51%",
          top: "53%",
          width: 475.5,
          height: 265.5,
          transform: FLOOR_TRANSFORM,
        })}
      >
        <div style={plane({ inset: 0, transform: "translateZ(30px)" })}>
          {/* Contact shadow on the floor */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: 84,
              top: 94.5,
              width: 327,
              height: 109.5,
              background: "rgba(0, 0, 0, 0.5)",
              filter: "blur(31px)",
              opacity: "var(--sh-o)",
              transform: "translateZ(12px) translate(var(--sh-x), var(--sh-y)) scale(var(--sh-s))",
            }}
          />

          {/* The key itself */}
          <div
            aria-hidden
            style={plane({ left: 49.5, top: 45, width: 366, height: 183, transform: "translateZ(var(--lift))" })}
          >
            {/* bottom */}
            <div
              style={plane({
                left: 46.5,
                top: 61.5,
                width: 303,
                height: 85.5,
                transform: "rotateY(180deg)",
                background:
                  "radial-gradient(46% 316.4% at 56.3% 23.8%, rgba(59, 59, 59, 0.59) 0%, rgba(0, 0, 0, 0.59) 100%)",
              })}
            />
            {/* back */}
            <div
              style={plane({
                left: 46.5,
                top: 39,
                width: 303,
                height: 45,
                transform: "translateZ(var(--hh)) rotateX(90deg) scaleY(var(--hs))",
                backgroundColor: "rgba(255, 255, 255, 0.25)",
                border: "1px solid rgba(173, 173, 173, 0.05)",
              })}
            />
            {/* left end */}
            <div
              style={plane({
                left: 24,
                top: 61.5,
                width: 45,
                height: 85.5,
                transform: "translateZ(var(--hh)) rotateY(-90deg) scaleX(var(--hs))",
                background:
                  "radial-gradient(150% 100% at -43.4% 4.1%, rgba(20, 20, 20, 0.34) 0%, rgba(84, 84, 84, 0.2) 100%)",
              })}
            />
            {/* right end */}
            <div
              style={plane({
                left: 327,
                top: 60,
                width: 45,
                height: 87,
                transform: "translateZ(var(--hh)) rotateY(-90deg) scaleX(var(--hs))",
                background:
                  "radial-gradient(150% 75% at 106.5% 70.7%, rgba(48, 48, 48, 0.57) 0%, rgb(41, 41, 41) 100%)",
                backdropFilter: "blur(2px)",
                WebkitBackdropFilter: "blur(2px)",
              })}
            />
            {/* front */}
            <div
              style={plane({
                left: 46.5,
                top: 124.5,
                width: 303,
                height: 45,
                transform: "translateZ(var(--hh)) rotateX(-90deg) scaleY(var(--hs))",
                background:
                  "radial-gradient(116.5% 442.4% at 8.7% 67.5%, rgba(23, 22, 22, 0.63) 0%, rgba(26, 22, 22, 0.85) 32.3%, rgba(18, 18, 18, 0.7) 100%)",
                backdropFilter: "blur(5px)",
                WebkitBackdropFilter: "blur(5px)",
                boxShadow: "inset -0.9px 0 0 0 rgba(166, 166, 166, 0.11)",
              })}
            />
            {/* top face */}
            <div
              style={plane({
                left: 46.5,
                top: 60,
                width: 303,
                height: 87,
                transform: "translateZ(var(--h))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                background:
                  "radial-gradient(100% 184.4% at var(--lx) var(--ly), rgba(51, 51, 51, 0.62) 0%, rgba(18, 18, 18, 0.87) 100%)",
                backdropFilter: "blur(4px)",
                WebkitBackdropFilter: "blur(4px)",
                boxShadow: "inset 0.6px -0.9px 0 0 rgba(189, 189, 189, 0.14), inset -0.9px 0 0 0 rgb(54, 54, 54)",
              })}
            >
              <span
                className="key-sheen pointer-events-none absolute -inset-y-6 left-0 w-[34%]"
                style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.14), transparent)" }}
              />
              <span
                className="key-rim pointer-events-none absolute inset-0"
                style={{
                  opacity: "var(--glow)",
                  boxShadow: "inset 0 0 0 1.5px rgba(255, 128, 80, 0.5), inset 0 0 30px rgba(255, 69, 0, 0.3)",
                }}
              />
              <span className="key-label relative flex items-center gap-3">
                {/* <Logomark size={27} color="#ff4500" /> */}
                <span className="whitespace-nowrap text-[24px] font-semibold leading-[1.5] tracking-[-0.02em] text-white">
                  {label}
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Accessible, flicker-free hit area matching the key's on-screen silhouette */}
      <a
        href={href}
        aria-label={label}
        className="pointer-events-auto absolute inset-0 z-10 cursor-pointer outline-none [-webkit-tap-highlight-color:transparent]"
        style={{ clipPath: HIT_AREA }}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerLeave}
        onClick={onClick}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onFocus={onFocus}
        onBlur={onBlur}
        draggable={false}
      >
        <span className="sr-only">{label}</span>
      </a>
    </div>
  );
}
