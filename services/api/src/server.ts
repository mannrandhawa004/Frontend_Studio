import cors from "cors";
import express from "express";
import multer from "multer";
import { cp, mkdir, readFile, writeFile, rm, readdir } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

type T = {
  id: string;
  slug: string;
  title: string;
  category: string;
  framework: "static-html" | "vite-react-static" | "next-static-export";
  tags: string[];
  description: string;
  status: "draft" | "published" | "building" | "failed";
  accent: string;
  updatedAt: string;
  version: number;
  publishedVersion?: number;
  sourceFiles?: string[];
  hasPreview?: boolean;
  previewUrl?: string | null;
  history: {
    version: number;
    title: string;
    description: string;
    updatedAt: string;
  }[];
};

type J = {
  id: string;
  templateId: string;
  templateTitle: string;
  status: "queued" | "running" | "success" | "failed";
  stage: string;
  createdAt: string;
  message: string;
};

// Always resolve to the monorepo root storage directory
function getStorageRoot(): string {
  if (process.env.STORAGE_DIR) {
    return path.resolve(process.env.STORAGE_DIR);
  }
  if (existsSync(path.resolve(process.cwd(), "apps", "web"))) {
    return path.resolve(process.cwd(), "storage");
  }
  const upTwo = path.resolve(process.cwd(), "..", "..");
  if (existsSync(path.resolve(upTwo, "apps", "web"))) {
    return path.resolve(upTwo, "storage");
  }
  return path.resolve(__dirname, "..", "..", "..", "storage");
}

const root = getStorageRoot();
const dataFile = path.join(root, "studio-data.json");

let templates: T[] = [];
let jobs: J[] = [];
const tokens = new Set<string>();

async function save() {
  await mkdir(root, { recursive: true });
  await writeFile(dataFile, JSON.stringify({ templates, jobs }, null, 2));
}

async function load() {
  await mkdir(root, { recursive: true });
  if (existsSync(dataFile)) {
    try {
      const d = JSON.parse(await readFile(dataFile, "utf8"));
      templates = d.templates || [];
      jobs = d.jobs || [];
    } catch {
      templates = [];
      jobs = [];
      await save();
    }
  } else {
    templates = [];
    jobs = [];
    await save();
  }
}

async function listFilesRecursively(dir: string, base = ""): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const relPath = base ? `${base}/${entry.name}` : entry.name;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursively(fullPath, relPath)));
    } else {
      files.push(relPath);
    }
  }
  return files;
}

const slug = (v: string) =>
  v
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);

const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow browser requests from localhost on any port (3000, 3001, etc.)
      if (!origin) return callback(null, true);
      if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.use(express.json({ limit: "50mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100_000_000, files: 200 },
});

function auth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  const t = req.header("authorization")?.replace("Bearer ", "");
  if (!t || !tokens.has(t)) {
    return res.status(401).json({ message: "Sign in required." });
  }
  next();
}

// Health check
app.get("/api/v1/health", (_q, r) =>
  r.json({
    status: "ok",
    service: "frontend-studio-api",
    storage: root,
  }),
);

// Helper to enrich templates with preview URLs
function enrichTemplate(t: T, req: express.Request): T {
  const v = t.publishedVersion || t.version || 1;
  const indexPath = path.join(root, "templates", t.id, "output", String(v), "index.html");
  const hasPreview = existsSync(indexPath);
  const host = req.get("host") || "localhost:4000";
  const protocol = req.protocol || "http";
  const baseUrl = `${protocol}://${host}`;
  return {
    ...t,
    hasPreview,
    previewUrl: hasPreview ? `${baseUrl}/previews/${t.id}/output/${v}/index.html` : null,
  };
}

// Public: Get published templates with live preview links
app.get("/api/v1/templates", (req, res) => {
  const published = templates
    .filter((t) => t.status === "published")
    .map((t) => enrichTemplate(t, req));
  res.json({ templates: published });
});

// Public: Get single template details
app.get("/api/v1/templates/:id", (req, res) => {
  const t = templates.find((x) => x.id === req.params.id);
  if (!t) return res.status(404).json({ message: "Template not found." });
  res.json({ template: enrichTemplate(t, req) });
});

// Admin: Auth
app.post("/api/v1/admin/login", (q, r) => {
  const { username, password } = q.body || {};
  if (
    username !== "admin" ||
    password !== (process.env.STUDIO_ADMIN_PASSWORD || "studio")
  ) {
    return r.status(401).json({ message: "Invalid credentials." });
  }
  const t = randomUUID();
  tokens.add(t);
  r.json({ token: t, user: { name: "Studio Admin" } });
});

app.post("/api/v1/admin/logout", auth, (q, r) => {
  tokens.delete(q.header("authorization")!.replace("Bearer ", ""));
  r.status(204).end();
});

// Admin: Get all templates
app.get("/api/v1/admin/templates", auth, (req, res) => {
  const enriched = templates.map((t) => enrichTemplate(t, req));
  res.json({ templates: enriched });
});

// Admin: Get jobs
app.get("/api/v1/admin/jobs", auth, (_q, r) => r.json({ jobs }));

// Admin: Create template draft - Uses template name prefix for folder name
app.post("/api/v1/admin/templates", auth, async (q, r) => {
  const b = q.body || {};
  const title = String(b.title || "").trim();
  if (!title) return r.status(400).json({ message: "Title is required." });

  let s = slug(b.slug || title);
  if (!s) return r.status(400).json({ message: "A valid title is required." });
  if (templates.some((t) => t.slug === s)) {
    s += `-${Date.now().toString().slice(-4)}`;
  }

  // Use template name prefix for the ID and folder name (e.g. tpl_ai_agency_a1b2c3)
  const namePrefix = slug(title).replace(/-/g, "_").slice(0, 24) || "template";
  const templateId = `tpl_${namePrefix}_${randomUUID().slice(0, 6)}`;

  const t: T = {
    id: templateId,
    slug: s,
    title,
    category: String(b.category || "Uncategorized"),
    framework: [
      "static-html",
      "vite-react-static",
      "next-static-export",
    ].includes(b.framework)
      ? b.framework
      : "vite-react-static",
    tags: Array.isArray(b.tags) ? b.tags.slice(0, 8) : [],
    description: String(b.description || ""),
    status: "draft",
    accent: String(b.accent || "linear-gradient(145deg,#3c554b,#9abca8)"),
    updatedAt: new Date().toISOString(),
    version: 1,
    history: [],
  };

  templates.unshift(t);
  await save();
  r.status(201).json({ template: enrichTemplate(t, q) });
});

// Admin: Update metadata
app.patch("/api/v1/admin/templates/:id", auth, async (q, r) => {
  const t = templates.find((x) => x.id === q.params.id);
  if (!t) return r.status(404).json({ message: "Template not found." });

  t.history.push({
    version: t.version,
    title: t.title,
    description: t.description,
    updatedAt: t.updatedAt,
  });

  Object.assign(t, {
    title: q.body.title?.trim() || t.title,
    category: q.body.category || t.category,
    framework: q.body.framework || t.framework,
    tags: Array.isArray(q.body.tags) ? q.body.tags.slice(0, 8) : t.tags,
    description: q.body.description ?? t.description,
    accent: q.body.accent || t.accent,
    updatedAt: new Date().toISOString(),
    version: t.version + 1,
  });

  await save();
  r.json({ template: enrichTemplate(t, q) });
});

// Admin: Delete template - Completely removes template folder from storage/templates
app.delete("/api/v1/admin/templates/:id", auth, async (q, r) => {
  const n = templates.length;
  templates = templates.filter((x) => x.id !== q.params.id);
  if (n === templates.length) {
    return r.status(404).json({ message: "Template not found." });
  }

  // Delete storage folder for the template
  const folderPath = path.join(root, "templates", q.params.id);
  if (existsSync(folderPath)) {
    try {
      await rm(folderPath, { recursive: true, force: true });
    } catch (e) {
      console.error(`Failed to delete storage folder for template ${q.params.id}:`, e);
    }
  }

  await save();
  r.status(204).end();
});

// Admin: Upload source files (supports multiple files and .zip archives)
app.post(
  "/api/v1/admin/templates/:id/source",
  auth,
  upload.array("source", 100),
  async (q, r) => {
    const t = templates.find((x) => x.id === q.params.id);
    if (!t) return r.status(404).json({ message: "Template not found." });

    const files = q.files as Express.Multer.File[];
    if (!files?.length) {
      return r
        .status(400)
        .json({ message: "Choose one or more source files or a .zip archive." });
    }

    const dest = path.join(root, "templates", t.id, "source");
    await mkdir(dest, { recursive: true });

    let extractedZip = false;

    for (const f of files) {
      const isZip =
        f.originalname.toLowerCase().endsWith(".zip") ||
        f.mimetype === "application/zip" ||
        f.mimetype === "application/x-zip-compressed" ||
        f.mimetype === "application/octet-stream";

      if (isZip) {
        const tempZip = path.join(dest, `_upload_${Date.now()}.zip`);
        await writeFile(tempZip, f.buffer);
        try {
          if (process.platform === "win32") {
            await execAsync(
              `powershell -NoProfile -Command "Expand-Archive -LiteralPath '${tempZip}' -DestinationPath '${dest}' -Force"`,
            );
          } else {
            await execAsync(`unzip -o "${tempZip}" -d "${dest}"`);
          }
          await rm(tempZip, { force: true });
          extractedZip = true;
        } catch (err) {
          console.error("Zip extraction failed, saving raw zip:", err);
          await writeFile(path.join(dest, f.originalname), f.buffer);
        }
      } else {
        await writeFile(path.join(dest, f.originalname), f.buffer);
      }
    }

    t.sourceFiles = await listFilesRecursively(dest);
    t.updatedAt = new Date().toISOString();
    await save();

    r.json({
      message: extractedZip
        ? `ZIP archive extracted successfully (${t.sourceFiles.length} files total).`
        : `Uploaded ${files.length} file(s) successfully.`,
      template: enrichTemplate(t, q),
    });
  },
);

// Admin: Trigger build
app.post("/api/v1/admin/templates/:id/build", auth, async (q, r) => {
  const t = templates.find((x) => x.id === q.params.id);
  if (!t) return r.status(404).json({ message: "Template not found." });

  t.status = "building";
  t.updatedAt = new Date().toISOString();

  const j: J = {
    id: `job_${randomUUID().slice(0, 8)}`,
    templateId: t.id,
    templateTitle: t.title,
    status: "queued",
    stage: "Starting build runner",
    createdAt: new Date().toISOString(),
    message: "Queued for build execution.",
  };
  jobs.unshift(j);
  await save();

  r.json({ job: j, template: enrichTemplate(t, q) });

  // Execute build
  setTimeout(async () => {
    j.status = "running";
    j.stage = "Inspecting source files";
    await save();

    setTimeout(async () => {
      try {
        const sourceDir = path.join(root, "templates", t.id, "source");
        const outDir = path.join(root, "templates", t.id, "output", String(t.version));

        // Locate index.html (in source root, or common build subfolders like dist, build, out)
        const candidates = [
          sourceDir,
          path.join(sourceDir, "dist"),
          path.join(sourceDir, "build"),
          path.join(sourceDir, "out"),
        ];

        let buildRoot: string | null = null;
        for (const candidate of candidates) {
          if (existsSync(path.join(candidate, "index.html"))) {
            buildRoot = candidate;
            break;
          }
        }

        // If not found in primary candidates, search 1 level of subdirectories
        if (!buildRoot && existsSync(sourceDir)) {
          const subdirs = await readdir(sourceDir, { withFileTypes: true });
          for (const s of subdirs) {
            if (s.isDirectory()) {
              const subCandidate = path.join(sourceDir, s.name);
              if (existsSync(path.join(subCandidate, "index.html"))) {
                buildRoot = subCandidate;
                break;
              }
            }
          }
        }

        if (!buildRoot) {
          throw new Error(
            "Could not find index.html. For React templates, upload your build output (dist/ folder or dist.zip) containing index.html.",
          );
        }

        j.stage = "Staging static bundle";
        await mkdir(outDir, { recursive: true });
        await cp(buildRoot, outDir, { recursive: true });

        // Clean up redundant source folder after successful build to keep storage lean
        try {
          await rm(sourceDir, { recursive: true, force: true });
        } catch {}

        j.status = "success";
        j.stage = "Complete";
        j.message = "Template preview is ready and verified.";
        t.status = t.publishedVersion ? "published" : "draft";
      } catch (e) {
        j.status = "failed";
        j.stage = "Failed";
        j.message = e instanceof Error ? e.message : "Build failed.";
        t.status = "failed";
      }
      t.updatedAt = new Date().toISOString();
      await save();
    }, 800);
  }, 400);
});

// Admin: Publish template
app.post("/api/v1/admin/templates/:id/publish", auth, async (q, r) => {
  const t = templates.find((x) => x.id === q.params.id);
  if (!t) return r.status(404).json({ message: "Template not found." });

  const outIndex = path.join(
    root,
    "templates",
    t.id,
    "output",
    String(t.version),
    "index.html",
  );
  if (!existsSync(outIndex)) {
    return r.status(400).json({
      message: "Cannot publish: Build output (index.html) does not exist yet. Run build first.",
    });
  }

  t.status = "published";
  t.publishedVersion = t.version;
  t.updatedAt = new Date().toISOString();
  await save();
  r.json({ template: enrichTemplate(t, q) });
});

// Serve static previews
const previewsRoot = path.join(root, "templates");

// The preview is embedded in an iframe from a different origin (the web app
// on :3000 in dev, or another host in production). X-Frame-Options: SAMEORIGIN
// made the modal render an empty iframe while "Open in tab" still worked.
app.use(
  "/previews",
  (_req, res, next) => {
    res.setHeader("Content-Security-Policy", "frame-ancestors *");
    res.setHeader("Access-Control-Allow-Origin", "*");
    next();
  },
  express.static(previewsRoot),
);

// Built templates commonly reference assets with root-relative paths such as
// "/images/hero.jpg" or "/assets/app.js". Those requests hit the server root
// instead of the template's output folder, so the images 404 inside the
// preview. Use the referer to find the preview that requested the asset and
// serve the file from that template's output directory. This keeps the
// original absolute paths working, both in the modal and in a new tab.
const previewRefererPattern = /\/previews\/([^/]+)\/output\/([^/]+)\//;

app.use((req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  if (req.path === "/api" || req.path.startsWith("/api/")) return next();
  if (req.path === "/previews" || req.path.startsWith("/previews/")) {
    return next();
  }

  const referer = req.get("referer");
  if (!referer) return next();

  let refererPath = "";
  try {
    refererPath = new URL(referer).pathname;
  } catch {
    return next();
  }

  const match = refererPath.match(previewRefererPattern);
  if (!match) return next();

  const [, templateId, version] = match;
  if (
    !/^[A-Za-z0-9._-]+$/.test(templateId) ||
    !/^[A-Za-z0-9._-]+$/.test(version)
  ) {
    return next();
  }

  let assetPath = req.path;
  try {
    assetPath = decodeURIComponent(assetPath);
  } catch {
    return next();
  }

  // Resolve against the template output folder and block path traversal.
  const baseDir = path.join(previewsRoot, templateId, "output", version);
  const baseResolved = path.resolve(baseDir) + path.sep;
  const filePath = path.resolve(baseDir, `.${assetPath}`);
  if (!filePath.startsWith(baseResolved)) return next();

  try {
    if (!statSync(filePath).isFile()) return next();
  } catch {
    return next();
  }

  res.sendFile(filePath);
});

const port = Number(process.env.PORT || 4000);
load().then(() => {
  app.listen(port, () => {
    console.log(`Frontend Studio API listening on http://localhost:${port}`);
  });
});
