# FCS Manager

FCS Manager is a browser-based tool for cleaning up FCS metadata without modifying source files.  
Load one file or a full folder, set channel names, preview output filenames, and save updated `.fcs` copies directly into a folder (no ZIP).

## Current Naming Model

- `Primary Names` = fluorophores (`$PnN`)
- `Secondary Names` = markers (`$PnS`)
- `All Parameters` = read-only full TEXT metadata view

The UI now explicitly guides this workflow: set fluorophores in Primary and marker names in Secondary.

## What Changed

- Removed per-row `Apply` / `Apply All` actions from channel naming.
- Suggested fluorophores are shown in `Primary Names` as a reference only.
- Editing a value in `Secondary Names` now applies that detector's marker name across all loaded files by default.
- The save action is now `Save assignments to config` (right-aligned in the tab bar), and saves both primary and secondary assignments.
- Saved assignments persist in local app storage and are reused on next loads.

## Cytometer Defaults

Built-in configs:

- `BD Fortessa 3L` (default)
- `BD Fortessa 4L`

Fortessa 3L detector-to-default fluorophore mapping is tuned, including:

- `450/50-V-A -> BV421`
- `610/20-V-A -> BV605`
- `710/50-V-A -> BV711`
- `780/60-V-A -> BV786`
- `525/50-B-A -> FITC`
- `610/20-B-A -> PE-CF594`
- `695/40-B-A -> PerCP-Cy5.5`
- `780/60-B-A -> PE-Cy7`
- `730/45-R-A -> Alexa Fluor 700`
- `670/30-R-A -> APC`

## Typical Workflow

1. Load `.fcs` files (drag/drop, file picker, or folder picker).
2. Pick cytometer config.
3. Fill `Primary Names` (optional: paste fluorophore list to auto-match).
4. Fill `Secondary Names` (auto-propagates by detector across loaded files).
5. Click `Save assignments to config` if you want to persist these mappings.
6. Preview filenames in `Filenames`.
7. Click `Save`, choose a target folder, and write plain `.fcs` files.

`Keep original files` is enabled by default. With it on, existing files in the target folder are not overwritten (a suffixed name is used instead).

## Settings: Mapping Library

In Settings, `Default Name Mapping` supports:

- manual row edits
- TSV/CSV paste import (`Detector`, `Primary`, `Secondary`)
- JSON export/import
- toggling auto-assign of default primary fluorophores

## Distribution For Non-Technical Colleagues (Recommended)

Use GitHub Pages via `.github/workflows/web-pages.yml`:

1. Push to `master` (or run the workflow manually).
2. Open Actions -> `Deploy Web App`.
3. Share the GitHub Pages URL.

URL format:

```text
https://<your-github-username>.github.io/fcs-manager/
```

Cost and privacy notes:

- GitHub hosts the app's static files (HTML/CSS/JS build output in `dist/`).
- User-selected FCS files are processed in-browser and are not uploaded by default.

## Local Development

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

## Optional Windows Installer (Tauri)

Local debug desktop build:

```bash
npm run tauri -- build --debug
```

Cross-compile Windows installer from macOS:

```bash
brew install llvm nsis
rustup target add x86_64-pc-windows-msvc
cargo install cargo-xwin
npm run build:windows:local
```

CI release installer workflow:

- `.github/workflows/windows-installer.yml`
- manual run: `Build Windows Installer`
- tag push (`v*`): attaches installer to GitHub Release

Output path:

```text
src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/
```
