# FCS Manager

FCS Manager is a desktop app for cleaning up FCS files without touching the originals. Load one file or a whole folder, review channel names and metadata, plan output filenames, then export fresh `.fcs` copies with the labels you want.

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

- `Primary Channels`: edit detector-facing primary names (`$PnN`)
- `Secondary Channels`: edit fluorophore or marker labels (`$PnS`)
- `All Parameters`: inspect the full TEXT-segment metadata for the selected file

### 🔬 Use cytometer-aware suggestions

- Switch between built-in cytometer configs like `BD Fortessa 3L` and `BD Fortessa 4L`
- Get detector-specific fluorophore suggestions based on the active config
- Apply the common fluorophore for every fluorescence channel in one click

### ✍️ Paste fluorophore lists and auto-match them

- Paste a list of fluorophores such as `BV421`, `FITC`, or `APC`
- FCS Manager matches pasted values against the active detector config
- Matching labels are dropped into the secondary channel field automatically

### 🔁 Reuse mappings across files

- Apply a secondary label to the same detector across every loaded file
- Save the current detector-to-label mapping as your default
- Keep a personal mapping library in app storage for future sessions

### ⚙️ Manage default mappings

Inside Settings you can build and maintain a reusable detector mapping table:

- Add mappings manually
- Paste detector/label pairs from TSV or CSV
- Export mappings as JSON
- Import mappings from JSON
- Turn default secondary mapping on or off

### 📝 Plan output filenames before export

- Add a prefix
- Add a suffix
- Auto-increment numbers inside the prefix or suffix
- Generate numbered outputs with custom start values and digit width
- Review every planned filename before writing anything

### 📦 Export safely

- Export new `.fcs` copies instead of overwriting the originals
- Keep originals and write new files into an `_formatted` folder
- Or export into a custom output directory
- If a target filename already exists, the app automatically finds a free filename

## Typical Workflow

1. 📂 Load files or a full folder.
2. 🧬 Pick a cytometer config.
3. 🏷️ Update primary and secondary channel labels.
4. ✨ Apply common fluorophores or paste a fluorophore list.
5. 📝 Preview output filenames.
6. 📤 Export clean copies.

## Small Quality-of-Life Features

- 🌗 Light and dark theme toggle
- ✅ "Keep originals" toggle in the workspace
- 📌 Status bar feedback for loading, mapping, and export actions

## Technical Stuff

The app is built as a desktop application with:

- React + TypeScript for the UI
- Vite for frontend development/builds
- Tauri 2 for the desktop shell
- Rust for file processing
- `flow-fcs` for FCS parsing and writing

## Development

Install dependencies:

```bash
npm install
```

Run the desktop app in development:

```bash
npm run tauri -- dev
```

Build the frontend:

```bash
npm run build
```

Create a desktop bundle:

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
- Tagged release: push a tag like `v0.1.0`
- Artifact output: uploaded `.exe`
- Release output on tags: attached to the GitHub Release

Note that the self-contained installer is typically larger than 100 MB because it embeds the offline WebView2 runtime. That makes GitHub Releases the correct distribution path instead of committing the binary directly into git history.

## Tests

Backend tests use the sample files in [`fcs`](./fcs):

```bash
cd src-tauri
cargo test
```
