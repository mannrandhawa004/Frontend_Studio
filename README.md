# Tessera

A modern template showcase and management studio designed to curate, preview, and publish standout React and web templates.

---

## 🚀 Quick Start

### 1. Install & Run
```powershell
npm install
npm run dev
```

- **Public Showcase Gallery**: [http://localhost:3000](http://localhost:3000)
- **Admin Workspace**: [http://localhost:3000/admin](http://localhost:3000/admin)
- **Backend API**: [http://localhost:4000/api/v1/health](http://localhost:4000/api/v1/health)

### 2. Admin Credentials
- **Username**: `admin`
- **Password**: `studio` (configurable via `STUDIO_ADMIN_PASSWORD` in environment)

---

## ⚛️ How to Showcase Your React Templates

Tessera natively supports showcasing any React project (Vite, Next.js, or Create React App):

### Step 1: Build Your React Project
In your React template repository or folder, run your production build:
```bash
npm run build
```
- For **Vite**: this creates a `dist/` directory containing `index.html` and bundled assets.
- For **Next.js**: configure `output: 'export'` in `next.config.js` and run `next build`, producing an `out/` directory.
- For **Create React App**: this creates a `build/` directory.

### Step 2: Package the Build
Zip your build output folder into a `.zip` archive (e.g. `dist.zip`), or prepare to select the files inside it. Ensure that `index.html` is at the root of the archive or inside a `dist/` subfolder.

### Step 3: Register in Admin Studio
1. Open the [Admin Portal](http://localhost:3000/admin) and log in.
2. Click **+ New template**.
3. Choose framework: **⚛ Vite React (dist folder or dist.zip)**.
4. Enter the Title, Category, Accent color, and Tags.
5. Click **Create draft**.

### Step 4: Upload, Build & Publish
1. On your template row, click **Manage**.
2. Upload your `.zip` archive or select your build files.
3. Click **Build now** — Frontend Studio automatically unpacks and stages the bundle into the output directory.
4. Click **Publish live** — your React template is instantly live in the gallery with interactive multi-device preview!

---

## 🔍 Key Questions Answered

### Why did it show "Sign in required" when clicking on a template view?
1. **The Root Cause**: In the initial prototype, the arrow button (`↗`) on public template cards was mistakenly bound to `queueBuild(t.id)` which called `POST /api/v1/admin/templates/:id/build`.
2. Because build operations are restricted to admins, the backend returned a `401 Unauthorized` (`"Sign in required."`).
3. **The Fix**: The card buttons and clicks are now wired directly to a rich **Interactive Live Preview Modal**. Visitors can instantly preview any template on Desktop, Tablet, and Mobile devices or open it full-screen in a new tab without any login required!

### How are React templates built and served?
React source code (`.jsx`/`.tsx`) must be bundled to JavaScript before browsers can render it. Tessera allows you to upload your production build (`dist.zip` or files) directly. The platform automatically stages and serves the static assets with live previews at `/previews/:templateId/output/:version/index.html`.
