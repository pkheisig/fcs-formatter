# FCS Manager

FCS Manager is now a Tauri desktop application with a Rust backend and a React frontend for non-destructive FCS relabeling and filename planning.

## What It Covers

- See all FCS TEXT-segment parameters for the selected file
- Edit primary names (`$PnN`) and secondary names (`$PnS`) in separate tabs
- Switch between embedded cytometer configs such as `BD Fortessa 3L` and `BD Fortessa 4L`
- Auto-fill the most common fluorophore for each detector
- Paste fluorophore lists and map them against the active detector config
- Plan output filenames with prefix, suffix, and numbered autocomplete
- Keep original files untouched and export new `.fcs` copies into `_formatted` folders or a custom output directory

## Stack

- Frontend: React + TypeScript + Vite
- Desktop shell: Tauri 2
- Backend: Rust
- FCS parsing/writing: `flow-fcs`

## Development

Install dependencies:

```bash
npm install
```

Run the desktop app in development:

```bash
npm run tauri -- dev
```

Build the frontend only:

```bash
npm run build
```

Create a desktop bundle:

```bash
npm run tauri -- build --debug
```

## Tests

Backend tests use the sample files under [`fcs`](./fcs):

```bash
cd src-tauri
cargo test
```

## Project Notes

- The app writes modified files as new copies rather than editing the originals in place.
