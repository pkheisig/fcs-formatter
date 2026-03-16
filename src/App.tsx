import { useEffect, useState, useRef, useCallback } from "react";
import { Settings, FilePlus, FolderPlus, Trash2, Download, RefreshCw, Wand2, Save, FileUp, PlusCircle, FileSpreadsheet, Code } from "lucide-react";
import {
  createExportZip,
  downloadBlob,
  getCytometerConfigs,
  parseFcsInputFiles,
  type ChannelEdit,
  type ConfigBootstrap,
  type CytometerConfig,
  type FcsFileRecord,
} from "./fcs-web";

type WorkspaceTab = "filenames" | "primary" | "secondary" | "parameters";

type ChannelMapping = {
  id: string;
  detector: string;
  primaryName: string;
  secondaryName: string;
};

const tabs: { id: WorkspaceTab; label: string; description: string }[] = [
  { id: "primary", label: "Primary Names", description: "Use fluorophore names in $PnN." },
  { id: "secondary", label: "Secondary Names", description: "Use marker names in $PnS." },
  { id: "filenames", label: "Filenames", description: "Autofill prefixes, suffixes, and numbered outputs." },
  { id: "parameters", label: "All Parameters", description: "Inspect all TEXT-segment metadata on the selected file." }
];

const NAMING_GUIDANCE =
  "Tip: set Primary Names to fluorophores and Secondary Names to marker names.";

function normalizeToken(value: string) {
  return value.toLowerCase().replace("fluor", "").replace(/[^a-z0-9]/g, "");
}

function normalizeDetector(value: string) {
  return value.toUpperCase().replace(/[–—]/g, "-").replace(/\s+/g, "");
}

function formatBytes(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function incrementString(str: string, index: number) {
  if (!str) return str;
  return str.replace(/(\d+)(?!.*\d)/, (match) => {
    const num = parseInt(match, 10) + index;
    return String(num).padStart(match.length, '0');
  });
}

export default function App() {
  const [configs, setConfigs] = useState<CytometerConfig[]>([]);
  const [files, setFiles] = useState<FcsFileRecord[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("primary");
  const [configName, setConfigName] = useState("");

  const [showSettings, setShowSettings] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("light");
  const [defaultSecondaryMapping, setDefaultSecondaryMapping] = useState(true);

  const [channelMappings, setChannelMappings] = useState<ChannelMapping[]>(() => {
    const saved = localStorage.getItem("channelMappings");
    try {
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((entry) => ({
        id: entry.id ?? crypto.randomUUID(),
        detector: entry.detector ?? "",
        primaryName: entry.primaryName ?? entry.label ?? "",
        secondaryName: entry.secondaryName ?? "",
      }));
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("channelMappings", JSON.stringify(channelMappings));
  }, [channelMappings]);

  const [prefix, setPrefix] = useState("");
  const [incrementPrefix, setIncrementPrefix] = useState(false);
  const [suffix, setSuffix] = useState("");
  const [incrementSuffix, setIncrementSuffix] = useState(false);
  const [useNumbering, setUseNumbering] = useState(false);
  const [numberStart, setNumberStart] = useState("1");
  const [numberDigits, setNumberDigits] = useState("3");
  const [isBusy, setIsBusy] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState("Load `.fcs` files to begin.");
  const [lastExport, setLastExport] = useState<string[]>([]);
  const filesPickerRef = useRef<HTMLInputElement>(null);
  const folderPickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    const folderInput = folderPickerRef.current;
    if (folderInput) {
      folderInput.setAttribute("webkitdirectory", "");
      folderInput.setAttribute("directory", "");
    }
  }, []);

  const filesRef = useRef<FcsFileRecord[]>([]);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    void loadConfigs();
  }, []);

  const selectedFile = files.find((file) => file.path === selectedPath) ?? files[0] ?? null;
  const activeConfig = configs.find((config) => config.name === configName) ?? configs[0] ?? null;

  useEffect(() => {
    if (!selectedFile && files.length > 0) {
      setSelectedPath(files[0].path);
    }
  }, [files, selectedFile]);

  const settingsRef = useRef({ defaultSecondaryMapping, configs, configName, channelMappings });
  useEffect(() => {
    settingsRef.current = { defaultSecondaryMapping, configs, configName, channelMappings };
  }, [defaultSecondaryMapping, configs, configName, channelMappings]);

  const applyInitialSecondaryMapping = useCallback((loaded: FcsFileRecord[]) => {
    const { defaultSecondaryMapping, configs, configName, channelMappings } = settingsRef.current;
    const activeCfg = configs.find((config) => config.name === configName) ?? configs[0] ?? null;

    return loaded.map((file) => ({
      ...file,
      channels: file.channels.map((channel) => {
        const normalizedDetector = normalizeDetector(channel.detector);
        let newPrimaryName = channel.primaryName;
        let newSecondaryName = channel.secondaryName;

        const customMapping = channelMappings.find(
          (mapping) =>
            normalizeDetector(mapping.detector) === normalizedDetector ||
            mapping.detector.trim().toLowerCase() === channel.detector.trim().toLowerCase(),
        );
        if (
          customMapping?.primaryName &&
          (newPrimaryName.trim().length === 0 || newPrimaryName === channel.originalPrimaryName)
        ) {
          newPrimaryName = customMapping.primaryName;
        }
        if (customMapping?.secondaryName && newSecondaryName.trim().length === 0) {
          newSecondaryName = customMapping.secondaryName;
        }

        if (
          defaultSecondaryMapping &&
          (newPrimaryName.trim().length === 0 || newPrimaryName === channel.originalPrimaryName) &&
          activeCfg &&
          channel.fluorescence
        ) {
          const detectorConfig = activeCfg.detectors.find((item) =>
            normalizedDetector.includes(normalizeDetector(item.filter)),
          );
          if (detectorConfig?.commonFluorophore) {
            newPrimaryName = detectorConfig.commonFluorophore;
          }
        }

        return { ...channel, primaryName: newPrimaryName, secondaryName: newSecondaryName };
      }),
    }));
  }, []);

  const loadInputs = useCallback(async (inputFiles: File[]) => {
    setIsBusy(true);
    try {
      const { records, failed } = await parseFcsInputFiles(inputFiles);
      const existing = filesRef.current;
      const existingKeys = new Set(existing.map((file) => file.path));
      const fresh = records.filter((file) => !existingKeys.has(file.path));
      const processed = applyInitialSecondaryMapping(fresh);
      const merged = [...existing, ...processed];

      setFiles(merged);
      if (merged.length > 0) {
        setSelectedPath((current) => current ?? merged[0].path);
      }

      const duplicates = records.length - fresh.length;
      if (fresh.length === 0 && failed.length === 0 && duplicates > 0) {
        setStatus("Those files are already loaded.");
      } else {
        const parts = [`Loaded ${fresh.length} file${fresh.length === 1 ? "" : "s"}.`];
        if (duplicates > 0) {
          parts.push(`Skipped ${duplicates} duplicate${duplicates === 1 ? "" : "s"}.`);
        }
        if (failed.length > 0) {
          parts.push(`Failed ${failed.length}: ${failed[0]}`);
        }
        setStatus(`${parts.join(" ")} ${NAMING_GUIDANCE}`);
      }
    } catch (e) {
      setStatus(`Failed to load files: ${e}`);
    } finally {
      setIsBusy(false);
    }
  }, [applyInitialSecondaryMapping]);

  async function loadConfigs() {
    const bootstrap: ConfigBootstrap = getCytometerConfigs();
    setConfigs(bootstrap.configs);
    setConfigName(bootstrap.defaultConfig);
  }

  function handleFileSelection(fileList: FileList | null) {
    if (!fileList) return;
    void loadInputs(Array.from(fileList));
  }

  function addFiles() {
    filesPickerRef.current?.click();
  }

  function addFolder() {
    folderPickerRef.current?.click();
  }

  function onDropFiles(event: React.DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (event.dataTransfer.files.length > 0) {
      void loadInputs(Array.from(event.dataTransfer.files));
    }
  }

  function updateFile(path: string, updater: (file: FcsFileRecord) => FcsFileRecord) {
    setFiles((current) =>
      current.map((file) => (file.path === path ? updater(file) : file))
    );
  }

  function updateChannel(
    filePath: string,
    channelIndex: number,
    field: "primaryName" | "secondaryName",
    value: string
  ) {
    updateFile(filePath, (file) => ({
      ...file,
      channels: file.channels.map((channel) =>
        channel.index === channelIndex ? { ...channel, [field]: value } : channel
      )
    }));
  }

  function applySecondaryNameToAll(detector: string, value: string) {
    const normalizedDetector = normalizeDetector(detector);
    setFiles((current) =>
      current.map((file) => ({
        ...file,
        channels: file.channels.map((channel) =>
          normalizeDetector(channel.detector) === normalizedDetector
            ? { ...channel, secondaryName: value }
            : channel
        ),
      }))
    );
  }

  function saveAssignmentsToConfig() {
    if (!selectedFile) return;

    const assignments = selectedFile.channels
      .filter((channel) => channel.primaryName.trim() || channel.secondaryName.trim())
      .map((channel) => ({
        detector: channel.detector,
        primaryName: channel.primaryName,
        secondaryName: channel.secondaryName,
      }));

    if (assignments.length === 0) {
      setStatus("No primary/secondary names to save for this file.");
      return;
    }

    setChannelMappings((current) => {
      const next = [...current];
      for (const assignment of assignments) {
        const normalizedDetector = normalizeDetector(assignment.detector);
        const existingIdx = next.findIndex(
          (mapping) => normalizeDetector(mapping.detector) === normalizedDetector,
        );
        if (existingIdx >= 0) {
          next[existingIdx].primaryName = assignment.primaryName;
          next[existingIdx].secondaryName = assignment.secondaryName;
        } else {
          next.push({
            id: crypto.randomUUID(),
            detector: assignment.detector,
            primaryName: assignment.primaryName,
            secondaryName: assignment.secondaryName,
          });
        }
      }
      return next;
    });

    setStatus("Saved assignments to config for the active detector mappings.");
  }

  function findDetectorConfig(detector: string) {
    if (!activeConfig) return null;
    const normalizedDetector = normalizeDetector(detector);
    return (
      activeConfig.detectors.find((item) =>
        normalizedDetector.includes(normalizeDetector(item.filter))
      ) ?? null
    );
  }

  function applyMatchingFluorophoreList(rawValue: string) {
    if (!selectedFile) return;

    const tokens = rawValue
      .split(/[\n,|;\t]+/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (tokens.length === 0) return;

    updateFile(selectedFile.path, (file) => ({
      ...file,
      channels: file.channels.map((channel) => {
        const detectorConfig = findDetectorConfig(channel.detector);
        if (!detectorConfig) return channel;

        const match = tokens.find((token) =>
          detectorConfig.fluorophores.some(
            (candidate) => normalizeToken(candidate) === normalizeToken(token)
          )
        );

        return match ? { ...channel, primaryName: match } : channel;
      })
    }));
    setStatus(`Matched pasted fluorophores for ${activeConfig?.name ?? "the active cytometer"} detectors. ${NAMING_GUIDANCE}`);
  }

  function autofillFileNames() {
    const start = Number.parseInt(numberStart, 10);
    const digits = Number.parseInt(numberDigits, 10);

    if (useNumbering && (!Number.isFinite(start) || !Number.isFinite(digits) || digits < 1)) {
      setStatus("Numbering needs valid integer start and digit values.");
      return;
    }

    setFiles((current) =>
      current.map((file, index) => {
        const currentPrefix = incrementPrefix ? incrementString(prefix, index) : prefix;
        const currentSuffix = incrementSuffix ? incrementString(suffix, index) : suffix;

        const numbered = useNumbering
          ? `${currentPrefix}${String(start + index).padStart(digits, "0")}${currentSuffix}`
          : `${currentPrefix}${file.originalBaseName}${currentSuffix}`;

        return {
          ...file,
          outputBaseName: numbered
        };
      })
    );

    setStatus("Updated filename previews.");
  }

  function resetFileNames() {
    setFiles((current) =>
      current.map((file) => ({
        ...file,
        outputBaseName: file.originalBaseName
      }))
    );
    setStatus("Reset filename previews to the original base names.");
  }

  async function exportFiles() {
    if (files.length === 0) return;

    const templateFile = selectedFile ?? files[0];
    const invalidName = files.find((file) => file.outputBaseName.trim().length === 0);
    if (invalidName) {
      setStatus(`Output name cannot be empty for ${invalidName.fileName}.`);
      return;
    }

    setIsBusy(true);
    try {
      const channelTemplate: ChannelEdit[] = templateFile.channels.map((channel) => ({
        originalPrimaryName: channel.originalPrimaryName,
        primaryName: channel.primaryName.trim(),
        secondaryName: channel.secondaryName,
      }));
      const result = await createExportZip(files, channelTemplate);
      downloadBlob(result.zipBlob, result.zipName);
      setLastExport(result.createdFiles);
      const warningText = result.warnings.length > 0 ? ` ${result.warnings[0]}` : "";
      setStatus(`Prepared ${result.createdFiles.length} files. Downloaded ${result.zipName}.${warningText}`);
    } catch (error) {
      setStatus(`Export failed: ${error}`);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <input
        ref={filesPickerRef}
        type="file"
        accept=".fcs"
        multiple
        style={{ display: "none" }}
        onChange={(event) => {
          handleFileSelection(event.target.files);
          event.target.value = "";
        }}
      />
      <input
        ref={folderPickerRef}
        type="file"
        accept=".fcs"
        multiple
        style={{ display: "none" }}
        onChange={(event) => {
          handleFileSelection(event.target.files);
          event.target.value = "";
        }}
      />

      <header className="hero">
        <div className="hero-copy" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button className="btn ghost-button" onClick={() => setShowSettings(true)} title="Settings" style={{ padding: '6px' }}>
            <Settings size={18} />
          </button>
          <h1>FCS Manager</h1>
        </div>

        <div className="hero-actions">
          <button className="btn secondary-button" onClick={addFiles} disabled={isBusy}>
            <FilePlus size={14} /> Add files
          </button>
          <button className="btn secondary-button" onClick={addFolder} disabled={isBusy}>
            <FolderPlus size={14} /> Add folder
          </button>
          <button className="btn danger-button" onClick={() => setFiles([])} disabled={isBusy || files.length === 0}>
            <Trash2 size={14} /> Clear all files
          </button>
          <button className="btn primary-button" onClick={exportFiles} disabled={isBusy || files.length === 0}>
            <Download size={14} /> {isBusy ? "Working..." : "Download zip"}
          </button>
        </div>
      </header>

      <section className="status-bar">
        <span className="status-text">{status}</span>
      </section>

      <main className="workspace">
        <aside
          className={`file-rail panel ${isDragging ? "is-dragging" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            const related = event.relatedTarget as Node | null;
            if (!related || !event.currentTarget.contains(related)) {
              setIsDragging(false);
            }
          }}
          onDrop={onDropFiles}
        >
          <div className="panel-header">
            <div>
              <h2>Files</h2>
            </div>
          </div>

          <div className="rail-list">
            {files.length === 0 ? (
              <div className="empty-state">
                <FileUp size={48} className="empty-state-icon" />
                <h3>Welcome to FCS Manager</h3>
                <p>Drag and drop your <code>.fcs</code> files here, or use the add buttons above to get started.</p>
              </div>
            ) : (
              files.map((file) => (
                <button
                  key={file.path}
                  className={`file-card ${selectedFile?.path === file.path ? "is-active" : ""}`}
                  onClick={() => setSelectedPath(file.path)}
                >
                  <span className="file-title">{file.fileName}</span>
                  <span className="file-meta">
                    {file.parameterCount} params • {file.eventCount} events • {formatBytes(file.sizeBytes)}
                  </span>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="editor panel">
          <div className="panel-header editor-header">
            <div>
              <h2>{selectedFile ? selectedFile.fileName : "No file selected"}</h2>
            </div>

            <div className="header-controls" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label className="field-block compact" style={{ marginBottom: 0, flexDirection: 'row', alignItems: 'center' }}>
                <span style={{ marginRight: '8px' }}>Cytometer config</span>
                <select
                  value={configName}
                  onChange={(event) => setConfigName(event.target.value)}
                  disabled={configs.length === 0}
                  style={{ padding: '4px 8px' }}
                >
                  {configs.map((config) => (
                    <option key={config.name} value={config.name}>
                      {config.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="tab-row">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`tab-button ${activeTab === tab.id ? "is-active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span>{tab.label}</span>
              </button>
            ))}
            <button
              className="btn secondary-button tab-save-action"
              onClick={saveAssignmentsToConfig}
              disabled={!selectedFile}
            >
              <Save size={14} /> Save assignments to config
            </button>
          </div>

          <div className="panel-body">
            {!selectedFile ? (
              <div className="empty-canvas">
                <p>Select a file to begin.</p>
              </div>
            ) : null}

            {selectedFile && activeTab === "filenames" ? (
              <div className="filename-layout">
                <div className="filename-tools">
                  <div className="field-block">
                    <div className="field-header">
                      <span>Prefix</span>
                      <label className="toggle">
                        <input type="checkbox" checked={incrementPrefix} onChange={e => setIncrementPrefix(e.target.checked)} />
                        <span>Auto-inc</span>
                      </label>
                    </div>
                    <input value={prefix} onChange={(event) => setPrefix(event.target.value)} />
                  </div>
                  <div className="field-block">
                    <div className="field-header">
                      <span>Suffix</span>
                      <label className="toggle">
                        <input type="checkbox" checked={incrementSuffix} onChange={e => setIncrementSuffix(e.target.checked)} />
                        <span>Auto-inc</span>
                      </label>
                    </div>
                    <input value={suffix} onChange={(event) => setSuffix(event.target.value)} />
                  </div>
                  <label className="toggle" style={{ marginBottom: '12px' }}>
                    <input
                      type="checkbox"
                      checked={useNumbering}
                      onChange={(event) => setUseNumbering(event.target.checked)}
                    />
                    <span>Autocomplete numbering</span>
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <label className="field-block compact" style={{ flex: 1 }}>
                      <span>Start</span>
                      <input value={numberStart} onChange={(event) => setNumberStart(event.target.value)} />
                    </label>
                    <label className="field-block compact" style={{ flex: 1 }}>
                      <span>Digits</span>
                      <input value={numberDigits} onChange={(event) => setNumberDigits(event.target.value)} />
                    </label>
                  </div>
                  <div className="button-row" style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <button className="btn primary-button" onClick={autofillFileNames}>
                      <Wand2 size={14} /> Preview Output Filenames
                    </button>
                    <button className="btn secondary-button" onClick={resetFileNames}>
                      <RefreshCw size={14} /> Reset
                    </button>
                  </div>
                </div>

                <div className="filename-table" style={{ marginTop: '24px' }}>
                  <div className="channel-table-header">
                    <span>Current</span>
                    <span>Planned output</span>
                    <span>Destination</span>
                  </div>
                  <div className="channel-table">
                    {files.map((file) => (
                      <div className="channel-row" key={`${file.path}-filename`}>
                        <div className="detector-cell">
                          <strong>{file.originalBaseName}.fcs</strong>
                        </div>
                        <input
                          value={file.outputBaseName}
                          onChange={(event) =>
                            updateFile(file.path, (current) => ({
                              ...current,
                              outputBaseName: event.target.value
                            }))
                          }
                          placeholder="Output base name"
                        />
                        <div className="detector-cell">
                          <strong>Download ZIP</strong>
                          <small>Original files on disk are unchanged</small>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {selectedFile && activeTab === "primary" ? (
              <div className="editor-surface">
                <div className="surface-tools" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                  <div className="field-block wide" style={{ marginBottom: 0 }}>
                    <textarea
                      placeholder="Paste fluorophores (e.g., BV421, FITC, APC) to auto-fill Primary Names by detector match..."
                      onBlur={(event) => applyMatchingFluorophoreList(event.target.value)}
                    />
                  </div>
                  <small style={{ color: 'var(--muted)' }}>{NAMING_GUIDANCE}</small>
                </div>

                <div className="channel-table">
                  <div className="channel-table-header" style={{ gridTemplateColumns: '80px 1.3fr 1fr 1fr' }}>
                    <span>Index</span>
                    <span>Detector</span>
                    <span>Suggested fluorophore</span>
                    <span>Primary name ($PnN)</span>
                  </div>
                  {selectedFile.channels.map((channel) => {
                    const detectorConfig = findDetectorConfig(channel.detector);
                    return (
                      <div className="channel-row" key={`${selectedFile.path}-primary-${channel.index}`} style={{ gridTemplateColumns: '80px 1.3fr 1fr 1fr' }}>
                        <div className="index-pill" style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>{channel.index}</div>
                        <div className="detector-cell">
                          <strong>{channel.originalPrimaryName}</strong>
                          <small>{channel.detector}</small>
                        </div>
                        <div>
                          {detectorConfig?.commonFluorophore ? (
                            <span className="tag suggestion-text">{detectorConfig.commonFluorophore}</span>
                          ) : (
                            <span className="tag">No match</span>
                          )}
                        </div>
                        <input
                          value={channel.primaryName}
                          onChange={(event) =>
                            updateChannel(selectedFile.path, channel.index, "primaryName", event.target.value)
                          }
                          placeholder="Primary fluorophore"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {selectedFile && activeTab === "secondary" ? (
              <div className="editor-surface">
                <div className="channel-table">
                  <div className="channel-table-header" style={{ gridTemplateColumns: '1fr 1.4fr' }}>
                    <span>Detector</span>
                    <span>Secondary name ($PnS marker)</span>
                  </div>
                  {selectedFile.channels.map((channel) => (
                      <div className="channel-row" key={`${selectedFile.path}-secondary-${channel.index}`} style={{ gridTemplateColumns: '1fr 1.4fr' }}>
                        <div className="detector-cell">
                          <strong>{channel.primaryName || channel.originalPrimaryName}</strong>
                          <small>{channel.detector}</small>
                        </div>
                        <input
                          value={channel.secondaryName}
                          onChange={(event) => applySecondaryNameToAll(channel.detector, event.target.value)}
                        />
                      </div>
                  ))}
                </div>
              </div>
            ) : null}

            {selectedFile && activeTab === "parameters" ? (
              <div className="metadata-table">
                <div className="channel-table-header" style={{ gridTemplateColumns: '200px 1fr', padding: '10px 12px' }}>
                  <span>Keyword</span>
                  <span>Value</span>
                </div>
                {selectedFile.parameters.map((entry) => (
                  <div className="metadata-row" key={`${selectedFile.path}-${entry.key}`}>
                    <code>{entry.key}</code>
                    <span style={{ wordBreak: 'break-all' }}>{entry.value}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>

      </main>

      {showSettings && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="panel-header">
              <h2><Settings size={18} /> Settings</h2>
              <button className="btn secondary-button" onClick={() => setShowSettings(false)}>Close</button>
            </div>
            <div className="panel-body settings-body">
              <label className="field-block">
                <span>Theme</span>
                <select value={theme} onChange={(e) => setTheme(e.target.value as "dark" | "light")}>
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
              </label>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={defaultSecondaryMapping}
                  onChange={(e) => setDefaultSecondaryMapping(e.target.checked)}
                />
                <span>Auto-assign primary fluorophore names by default</span>
              </label>

              <hr style={{ margin: '8px 0', border: 'none', borderTop: '1px solid var(--panel-line)' }} />
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '14px', color: 'var(--text)' }}>Default Name Mapping</h3>
                  <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0 }}>
                    Map detector names to both default Primary Names (fluorophores) and Secondary Names (markers).
                  </p>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {channelMappings.map((mapping, idx) => (
                    <div key={mapping.id} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input 
                        style={{ flex: 1.2, margin: 0 }}
                        placeholder="Detector (e.g. FL1-H)" 
                        value={mapping.detector} 
                        onChange={e => {
                          const newMappings = [...channelMappings];
                          newMappings[idx].detector = e.target.value;
                          setChannelMappings(newMappings);
                        }} 
                      />
                      <input 
                        style={{ flex: 1, margin: 0 }}
                        placeholder="Primary (e.g. FITC)" 
                        value={mapping.primaryName} 
                        onChange={e => {
                          const newMappings = [...channelMappings];
                          newMappings[idx].primaryName = e.target.value;
                          setChannelMappings(newMappings);
                        }} 
                      />
                      <input 
                        style={{ flex: 1, margin: 0 }}
                        placeholder="Secondary (e.g. CD3)" 
                        value={mapping.secondaryName} 
                        onChange={e => {
                          const newMappings = [...channelMappings];
                          newMappings[idx].secondaryName = e.target.value;
                          setChannelMappings(newMappings);
                        }} 
                      />
                      <button 
                        className="btn danger-button" 
                        onClick={() => setChannelMappings(channelMappings.filter(m => m.id !== mapping.id))}
                        style={{ padding: '6px 10px', height: '100%', margin: 0 }}
                      >
                        <Trash2 size={14} /> Remove
                      </button>
                    </div>
                  ))}
                </div>
                
                <div className="button-group">
                  <button 
                    className="btn secondary-button" 
                    onClick={() => setChannelMappings([...channelMappings, { id: crypto.randomUUID(), detector: '', primaryName: '', secondaryName: '' }])}
                  >
                    <PlusCircle size={14} /> Add Mapping
                  </button>
                  <button
                    className="btn secondary-button"
                    onClick={() => {
                      const data = prompt("Paste TSV or CSV data (Column A = Detector, B = Primary, C = Secondary)");
                      if (data) {
                        const rows = data.split('\n').map(row => row.trim()).filter(Boolean);
                        const newMappings: ChannelMapping[] = [];
                        for (const row of rows) {
                          const cols = row.split(/[\t,]/).map(c => c.trim());
                          if (cols.length >= 2) {
                            newMappings.push({
                              id: crypto.randomUUID(),
                              detector: cols[0],
                              primaryName: cols[1] ?? "",
                              secondaryName: cols[2] ?? "",
                            });
                          }
                        }
                        if (newMappings.length > 0) {
                          setChannelMappings([...channelMappings, ...newMappings]);
                        }
                      }
                    }}
                  >
                    <FileSpreadsheet size={14} /> Paste TSV/CSV
                  </button>
                  <button
                    className="btn secondary-button"
                    onClick={() => {
                      const json = JSON.stringify(channelMappings, null, 2);
                      const blob = new Blob([json], { type: "application/json" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "channel_mappings.json";
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    <Code size={14} /> Export JSON
                  </button>
                  <label className="btn secondary-button" style={{ cursor: 'pointer', margin: 0 }}>
                    <Code size={14} /> Import JSON
                    <input 
                      type="file" 
                      accept=".json" 
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            try {
                              const json = JSON.parse(event.target?.result as string);
                              if (Array.isArray(json)) {
                                const validMappings = json
                                  .filter((entry) => entry && entry.detector !== undefined)
                                  .map((entry) => ({
                                    id: entry.id ?? crypto.randomUUID(),
                                    detector: entry.detector ?? "",
                                    primaryName: entry.primaryName ?? entry.label ?? "",
                                    secondaryName: entry.secondaryName ?? "",
                                  }));
                                setChannelMappings(validMappings);
                              }
                            } catch (err) {
                              alert("Failed to parse JSON file.");
                            }
                          };
                          reader.readAsText(file);
                        }
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
