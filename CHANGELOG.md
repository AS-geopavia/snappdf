# Changelog

All notable changes to SnapPDF are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.0.5] — 2026-05-18

### Added
- **Close confirmation during extraction** — attempting to close the app while an extraction is running now shows a native Windows dialog asking for confirmation. Choosing "Cancel" lets the extraction continue; choosing "Exit anyway" closes the window normally.

### Changed
- **Dependency updates** — all direct dependencies bumped to their latest stable releases:
  - `electron` 31.0.0 → **33.4.0**
  - `electron-builder` 24.13.3 → **26.8.1**
  - `electron-updater` 6.3.9 → **6.8.3**
  - `electron-log` 5.1.5 → **5.4.4**

---

## [1.0.4] — 2026-05-18

### Changed
- **Sidebar redesign** — switched from black (`zinc-950`) to a clean white sidebar with violet accents; active step is highlighted in violet instead of dark grey
- **Font sizes increased** — base font bumped from 13 px to 14 px; labels, buttons, log messages and topbar text are now larger and easier to read at a glance
- **Contrast improvements** — all text colors on light backgrounds darkened (labels `zinc-600 → zinc-800`, body text `zinc-700 → zinc-800`, log messages `*-600 → *-700`)
- **Scroll-free layout** — removed all internal scrollbars; the app now fits entirely in the window without any scrollable areas; window default height raised to 860 px
- **Config rows more compact** — settings panel padding reduced so all options are always visible without overflow

### Added
- **About modal** — new info button (ⓘ) in the sidebar footer opens a modal showing:
  - App name and live version number
  - Author and GitHub repository link
  - Full list of open-source components (Electron, PDF.js, UTIF.js, Tailwind CSS, electron-updater, electron-builder)
  - MIT licence badge
  - Closeable via button, backdrop click, or Esc

---

## [1.0.3] — 2026-05-17

### Changed
- **Full UI redesign** — replaced custom CSS with Tailwind CSS 3.4 + shadcn/ui aesthetic
  - Dark sidebar (`zinc-950`), white cards, violet accent colour
  - Segmented control for format selection (PNG / JPG / TIFF)
  - Toggle switches, compact config rows, progress bar
  - Status badge and update pill in topbar
- **Log panel** — monospace entries with coloured prefixes (`›` info, `✓` success, `!` warning, `✗` error)
- **Thumbnail strip** — checkered background, hover zoom, violet border on focus
- **Lightbox** — blurred backdrop, full-resolution preview up to 2400 px

### Fixed
- `dragover` CSS class name corrected (was `drag-over`)

---

## [1.0.2] — previous

### Added
- Live thumbnail strip with lightbox viewer (full-res, capped 2400 px)
- Page-range selector (single-document only; disabled when multiple files loaded)
- Cancel button during extraction

### Changed
- Thumbnails use a 96 px scaled version; lightbox uses the full-res data URL

---

## [1.0.1] — previous

### Added
- **electron-updater 6.3** — automatic updates via GitHub Releases (`AS-geopavia/snappdf`)
- In-app update pill with download progress and one-click install
- `build.bat` — one-command local build (CSS compile → electron-builder → NSIS installer)
- `release.bat` — bump version, build, tag, push and publish GitHub Release

### Changed
- Installer switched from Squirrel to **NSIS** (standard Windows installer with uninstaller)

---

## [1.0.0] — initial release

### Added
- Extract raster images from PDF files using **PDF.js v3**
- White-to-transparent background conversion (configurable tolerance threshold)
- Duplicate-image deduplication (perceptual hash)
- Minimum-size filter (width × height in px)
- Output formats: **PNG**, **JPG** (quality slider), **TIFF** (via UTIF.js)
- Drag-and-drop or file-picker for loading multiple PDFs
- Output folder picker with persistent config
- Real-time progress bar and log panel
- Open-output-folder button after extraction
