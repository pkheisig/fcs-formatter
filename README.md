# FCS Manager

FCS Manager is a browser-based app for cleaning up FCS files without touching the originals. Load one file or a whole folder, review channel names and metadata, plan output filenames, then download fresh `.fcs` copies with the labels you want.

## Why People Use It

- 🧪 Rename messy channel metadata before analysis
- 🏷️ Standardize fluorophore labels across a batch
- 📁 Prepare clean output filenames without manual renaming
- 🛟 Keep the source files untouched

## What You Can Do

### 📥 Load files fast

- Drag and drop `.fcs` files directly into the app
- Add individual files or scan an entire folder
- See each file's parameter count, event count, and file size in the file rail

### 🧬 Edit channel names

FCS Manager splits channel editing into the parts people actually care about:

- `Primary Names`: set fluorophore names (`$PnN`)
- `Secondary Names`: set marker names (`$PnS`)
- `All Parameters`: inspect the full TEXT-segment metadata for the selected file

### 🔬 Use cytometer-aware suggestions

- Switch between built-in cytometer configs like `BD Fortessa 3L` and `BD Fortessa 4L`
- Get detector-specific fluorophore suggestions based on the active config
- Auto-assign primary fluorophore names by default if detector matches are found

### ✍️ Paste fluorophore lists and auto-match them

- Paste a list of fluorophores such as `BV421`, `FITC`, or `APC`
- FCS Manager matches pasted values against the active detector config
- Matching fluorophores are applied to the primary name field automatically

### 🔁 Reuse mappings across files

- Apply a secondary marker name to the same detector across every loaded file
- Save current detector mappings for both primary (fluorophore) and secondary (marker) names
- Keep a personal mapping library in app storage for future sessions

### ⚙️ Manage default mappings

Inside Settings you can build and maintain a reusable detector mapping table:

- Add mappings manually
- Paste detector/primary/secondary values from TSV or CSV
- Export mappings as JSON
- Import mappings from JSON
- Turn default primary fluorophore auto-mapping on or off

### 📝 Plan output filenames before export

- Add a prefix
- Add a suffix
- Auto-increment numbers inside the prefix or suffix
- Generate numbered outputs with custom start values and digit width
- Review every planned filename before writing anything

### 📦 Export safely

- Export new `.fcs` copies instead of overwriting the originals
- Download the processed files as a ZIP
- Original source files on the user machine stay untouched

## Typical Workflow

1. 📂 Load files or a full folder.
2. 🧬 Pick a cytometer config.
3. ✨ Auto-fill primary fluorophore names (paste list optional).
4. 🏷️ Fill in secondary marker names.
5. 📝 Preview output filenames.
6. 📤 Export clean copies.

## Small Quality-of-Life Features

- 🌗 Light and dark theme toggle
- 📌 Status bar feedback for loading, mapping, and export actions

## Technical Stuff

The web app is built with:

- React + TypeScript for the UI
- Vite for frontend development/builds
- In-browser FCS parsing/editing and ZIP download

## Development

Install dependencies:

```bash
npm install
```

Run the web app locally:

```bash
npm run dev
```

Build production assets:

```bash
npm run build
```

## Deploy For Colleagues (No Install)

This repo includes `.github/workflows/web-pages.yml` to publish `dist/` to GitHub Pages.

- Push to `master` (or run workflow manually)
- Open the Actions workflow `Deploy Web App`
- Share the GitHub Pages URL with colleagues
- File processing stays in the browser (files are not uploaded by default)

URL format:

```text
https://<your-github-username>.github.io/fcs-manager/
```

## Optional Desktop Builds

```bash
npm run tauri -- build --debug
```

Create a self-contained Windows installer (`.exe`) on macOS:

```bash
brew install llvm nsis
rustup target add x86_64-pc-windows-msvc
cargo install cargo-xwin
npm run build:windows:local
```

The generated installer is written to:

```text
src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/
```

This installer uses Tauri's `offlineInstaller` WebView2 mode, so the `.exe` includes the browser runtime and does not require the end user to install any extra dependency manually.

## Windows Release Artifact

The repo includes a GitHub Actions workflow at `.github/workflows/windows-installer.yml`.

- Manual run: Actions -> `Build Windows Installer`
- Tagged release: push a tag like `v0.1.1`
- Artifact output: uploaded installer `.exe`
- Release output on tags: installer attached to the GitHub Release

Note that the self-contained installer is typically larger than 100 MB because it embeds the offline WebView2 runtime. That makes GitHub Releases the correct distribution path instead of committing the binary directly into git history.

## Tests

Backend tests use the sample files in [`fcs`](./fcs):

```bash
cd src-tauri
cargo test
```
