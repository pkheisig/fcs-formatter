import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));

const version = packageJson.version;
const exeSource = join(
  repoRoot,
  "src-tauri",
  "target",
  "x86_64-pc-windows-msvc",
  "release",
  "fcs-manager.exe"
);

if (!existsSync(exeSource)) {
  console.error("Windows executable not found.");
  console.error("Build it first with `npm run build:windows:local` or `npm run build:windows:ci`.");
  process.exit(1);
}

const outputRoot = join(repoRoot, "dist-portable");
const bundleName = `FCS Manager_${version}_x64-portable`;
const bundleDir = join(outputRoot, bundleName);
const zipPath = join(outputRoot, `${bundleName}.zip`);

rmSync(bundleDir, { recursive: true, force: true });
rmSync(zipPath, { force: true });
mkdirSync(bundleDir, { recursive: true });

cpSync(exeSource, join(bundleDir, "FCS Manager.exe"));

writeFileSync(
  join(bundleDir, "README.txt"),
  [
    "FCS Manager Portable",
    "",
    "How to run:",
    "1. Extract this zip to a normal folder.",
    "2. Double-click \"FCS Manager.exe\".",
    "",
    "Notes:",
    "- This is a portable build. It does not install anything into Program Files.",
    "- On many Windows 10/11 PCs it should run as-is because WebView2 is already present.",
    "- On some PCs, Windows SmartScreen may still warn because the app is unsigned.",
    "- If Windows blocks the app, click \"More info\" and then \"Run anyway\".",
    "",
  ].join("\n"),
  "utf8"
);

if (process.platform === "win32") {
  execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      `Compress-Archive -Path '${bundleDir}\\*' -DestinationPath '${zipPath}' -Force`,
    ],
    { stdio: "inherit" }
  );
} else {
  execFileSync("zip", ["-r", zipPath, bundleName], {
    cwd: outputRoot,
    stdio: "inherit",
  });
}

console.log(`Portable bundle created: ${zipPath}`);
