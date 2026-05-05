

A local-first writing app for long-form fiction, built with React + TipTap + Tauri.

It is designed for drafting scenes quickly while keeping structure, metadata, references, and exports in one place.

## Features

- **Binder + parts + scenes**: organize manuscript into parts, add/reorder scenes with drag-and-drop.
- **Rich text editor**: TipTap-based drafting with smart typography and paste normalization.
- **Subchapter titles**: optional subtitle line under each scene title.
- **Page view mode**: switch between continuous flow and page-like sheets; insert explicit page breaks.
- **Corkboard view**: synopsis cards for scenes.
- **Inspector metadata**: synopsis, scene notes, word target, progress bar, rough page estimate.
- **Snapshots**: capture/restore scene checkpoints.
- **Characters tab**: maintain character entries.
- **References tab**: upload/paste reference material and pin one beside the editor while drafting.
- **Trash workflow**: move scenes to trash, restore or permanently delete.
- **Compile/export**: Markdown, DOCX, and Print/PDF output.
- **Name generator**: expanded multi-origin pools (`english`, `nordic`, `celtic`, `fantasy`, `french`, `slavic`, `spanish`).
- **Themes**: `library`, `midnight`.

## Quick Start (Web)

```bash
npm install
npm run dev
```

Open the URL printed by Vite (typically `http://localhost:5173`).

## Desktop App (Tauri, macOS)

### Dev mode

```bash
npm run tauri:dev
```

- Uses a stable dev origin by default (`127.0.0.1:5173`) so browser storage is consistent.
- If 5173 is busy, run with another port explicitly:

```bash
VITE_DEV_PORT=5174 npm run tauri:dev
```

### Build release app bundle

```bash
npm run tauri:build
```

Output app bundle:

`src-tauri/target/release/bundle/macos/scrivener-clone.app`

## Persistence & Backups

- Autosaves to `localStorage` (debounced, plus flush on close/background).
- Optional Tauri disk project: link a folder and state is also written to `project.json`.
- Startup merge logic prefers the newer save (`savedAt`) between local and disk.
- Manual JSON export/import is available from the backup/disk menu.

## Project Structure

- `App.jsx` - main UI/state container.
- `components/TipTapEditor.jsx` - editor wrapper and page mode behavior.
- `components/ReferencesPanel.jsx` - reference library UI.
- `lib/compile.js` - Markdown/DOCX/print compile.
- `lib/nameGeneratorData.js` - expanded name pools.
- `lib/tauriDisk.js` - Tauri project folder read/write.
- `scripts/tauri-dev.mjs` - Tauri dev launcher.
- `src-tauri/` - desktop shell config and Rust entrypoint.

## Scripts

- `npm run dev` - Vite web dev server.
- `npm run build` - production web build.
- `npm run preview` - preview built web output.
- `npm run tauri:dev` - desktop dev mode.
- `npm run tauri:build` - desktop release build.

## Notes

- This project is local-first and intended for personal drafting workflows.
- Storage origin changes with port (`localhost:5173` vs `localhost:5174`), so keep your dev port consistent if you rely on browser-only saves.
- Build output is large because the editor stack is bundled into the main chunk; that can be optimized later with code-splitting.
