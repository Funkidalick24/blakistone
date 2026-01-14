<!-- .github/copilot-instructions.md -->
# Copilot / AI assistant instructions for Blackistone repo

Purpose: give AI coding agents the minimal, actionable context to be productive editing this Electron app.

- **Big picture**: This is an Electron (Electron Forge + Webpack) desktop app implementing a clinic management system. The repo uses a standard multi-process Electron structure:
  - `src/main.js` — Main process. Creates the BrowserWindow, registers `ipcMain.handle(...)` handlers, lazy-loads service modules, and enforces a Content Security Policy. IPC handlers call service modules that interact with `src/database.js`.
  - `src/preload.js` — Preload script that uses `contextBridge.exposeInMainWorld('electronAPI', {...})` to expose a small RPC surface to renderer code. Use only the exposed methods instead of direct `ipcRenderer` usage.
  - `src/renderer.js` + `src/index.html` + `src/index.css` — Renderer/UI code. The renderer calls methods on `window.electronAPI` (e.g., `login`, `getPatients`, `createInvoice`) and implements caching, lazy-loading and virtual scrolling patterns.
  - `src/*.js` services (e.g., `auth.js`, `patientService.js`, `appointmentService.js`, `accountingService.js`) — Business logic used by the main process. They are lazy-required in `main.js` via `initializeDatabase()`.
  - `src/database.js` — SQLite initialization and migrations. Database file: `clinic.db` under `process.resourcesPath` or project parent; schema updates are applied at startup.

- **Security & IPC patterns to preserve**:
  - `preload.js` exposes a curated `window.electronAPI` surface. Do not add arbitrary objects to `window` or reintroduce `nodeIntegration` in the renderer.
  - `main.js` uses `ipcMain.handle(channel, handler)` with a `validateSender(event)` function that ensures requests come from the main window. Add new channels following that pattern.
  - BrowserWindow is created with `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, and `webSecurity: true`. Keep those settings unless you understand the security implications.
  - Content Security Policy is set in `main.js` via `session.defaultSession.webRequest.onHeadersReceived(...)`. Update CSP only with careful reasoning and tests.

- **Common IPC channels (examples)** — use these exact names when calling from renderer:
  - Auth: `auth:login`, `auth:createUser`, `auth:getUsers`, `auth:updateUser`, `auth:deleteUser`
  - Patients: `patients:getAll`, `patients:getById`, `patients:create`, `patients:update`, `patients:delete`, `patients:getStats`
  - Appointments: `appointments:getAll`, `appointments:create`, `appointments:update`, `appointments:delete`, `appointments:getStats`, `appointments:getAvailableDoctors`
  - Accounting: `accounting:createInvoice`, `accounting:getInvoices`, `accounting:updateInvoicePayment`, `accounting:createExpense`, `accounting:getExpenses`, `accounting:getFinancialStats`, `accounting:generateInvoicePDF`

- **Developer workflows / commands** (from `package.json`):
  - Run app (development): `npm run start` (runs `electron-forge start`). Use `NODE_ENV=development` if you need dev-only behavior (DevTools opens when `process.env.NODE_ENV === 'development'`).
  - Package: `npm run package`
  - Make distributables: `npm run make`
  - Publish: `npm run publish`
  - Lint placeholder: `npm run lint` (currently a no-op in `package.json`).

- **Where to change UI vs backend**:
  - UI/UX: `src/index.html`, `src/index.css`, `src/renderer.js`, `src/chart.js`.
  - IPC surface & trusted validation: `src/preload.js` (public API) and `src/main.js` (handlers + `validateSender`).
  - Business logic & DB interactions: service files like `src/patientService.js`, `src/appointmentService.js`, `src/accountingService.js` and `src/database.js`.

- **Database notes**:
  - `src/database.js` uses `sqlite3` and creates `clinic.db` in `process.resourcesPath` (fallbacks to `__dirname/..`). Schema creation and migration code runs at startup — prefer to evolve schema in `database.js` and add forward-compatible ALTER TABLE statements (existing pattern).
  - Default admin user seeded with username `admin` and password `admin123` (bcrypt-hashed) if no admin exists. Be cautious when testing with production DBs.

- **Project-specific conventions & patterns** (use these when contributing):
  - Lazy service loading: `main.js` lazily `require()`s service modules inside `initializeDatabase()` and guards via `dbInitialized` — follow this pattern for service modules that should only run in main process after app start.
  - Expose minimal IPC APIs: Add a single `ipcMain.handle` and matching `preload.js` wrapper for each new capability.
  - Renderer caching: renderer-level caching uses `dataCache` with expiry and `getCachedData` / `setCachedData` helpers in `renderer.js`. Reuse that caching pattern for heavy, repeatable data fetches.
  - Performance features: virtual scrolling, lazy images, and performance observers are used in `renderer.js`. Keep similar optimizations for large lists.

- **Where to update when adding features**:
  1. Add service logic in `src/<feature>Service.js` (DB access, validations).
  2. Add DB schema changes to `src/database.js` (CREATE TABLE or ALTER TABLE statements).
  3. Add `ipcMain.handle('feature:action', ...)` in `src/main.js` and call `initializeDatabase()` inside handlers.
  4. Expose the new call in `src/preload.js` as `electronAPI.<featureAction> = (...) => ipcRenderer.invoke('feature:action', ...)`.
  5. Use `window.electronAPI.<featureAction>` from `src/renderer.js` or other renderer code.

- **Testing & debugging tips**:
  - Devtools: Start with `npm run start`; set `NODE_ENV=development` to auto-open DevTools per `main.js` condition.
  - Logging: `main.js` and `renderer.js` contain `console.log` statements used for debugging window state and IPC flow. Use these when investigating issues.
  - Database troubleshooting: The DB file `clinic.db` can be inspected with any SQLite tool; migrations are idempotent in `database.js` but ALTER statements may log duplicate column errors (code already filters these out).

If anything here is unclear or you'd like more examples (e.g., a new IPC handler + preload + renderer snippet), tell me which area to expand and I'll iterate.
