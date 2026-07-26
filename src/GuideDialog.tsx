import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { BookOpen, ChevronRight, X } from "lucide-react";
import { createPortal } from "react-dom";

const guideSections = [
  {
    id: "workflow",
    label: "Workflow overview",
    title: "From source files to clean copies",
    content: (
      <>
        <p>
          FCS Manager creates copies with updated channel metadata while leaving
          the event measurements unchanged.
        </p>
        <ol className="guide-steps">
          <li>
            <span>1</span>
            <div><strong>Load</strong><p>Add individual FCS files or a complete folder.</p></div>
          </li>
          <li>
            <span>2</span>
            <div><strong>Name</strong><p>Review fluorophores, markers, and output filenames.</p></div>
          </li>
          <li>
            <span>3</span>
            <div><strong>Check</strong><p>Inspect the original metadata and selected cytometer configuration.</p></div>
          </li>
          <li>
            <span>4</span>
            <div><strong>Save</strong><p>Write new FCS copies to a destination folder.</p></div>
          </li>
        </ol>
        <p className="guide-callout">
          <strong>Keep original files is enabled by default.</strong> It prevents
          overwriting by giving an existing output a numbered alternative name.
        </p>
      </>
    ),
  },
  {
    id: "files",
    label: "Files",
    title: "Load and organize FCS files",
    content: (
      <>
        <p>
          Use <strong>Add files</strong>, <strong>Add folder</strong>, or drag and
          drop files into the Files panel. Folder imports include FCS files from
          nested folders.
        </p>
        <ul>
          <li>Select a file in the left rail to review and edit its channels.</li>
          <li>Duplicate imports are skipped automatically.</li>
          <li><strong>Clear all files</strong> removes files from the current session only.</li>
        </ul>
      </>
    ),
  },
  {
    id: "primary",
    label: "Primary names",
    title: "Assign fluorophores to $PnN",
    content: (
      <>
        <p>
          Primary names are the fluorophore names written to <code>$PnN</code>.
          The selected cytometer configuration suggests a fluorophore for each
          detector.
        </p>
        <ul>
          <li>Edit a row directly when the suggested fluorophore is not correct.</li>
          <li>Paste a comma-, tab-, semicolon-, pipe-, or line-separated fluorophore list to match several channels at once.</li>
          <li>Spacing, case, and dash variants are normalized to the configured canonical dye name.</li>
        </ul>
      </>
    ),
  },
  {
    id: "secondary",
    label: "Secondary names",
    title: "Assign markers to $PnS",
    content: (
      <>
        <p>
          Secondary names are marker or target labels written to <code>$PnS</code>,
          such as <strong>CD3</strong>, <strong>CD8</strong>, or <strong>Viability</strong>.
        </p>
        <p>
          Editing a marker applies it to the same detector across all loaded files,
          which keeps a batch consistently labeled.
        </p>
      </>
    ),
  },
  {
    id: "filenames",
    label: "Filenames",
    title: "Build output filenames",
    content: (
      <>
        <p>
          Add a prefix, suffix, or sequence number without renaming the source
          files. Numeric prefixes and suffixes can be incremented automatically.
        </p>
        <ul>
          <li>The preview shows the exact output name for every loaded file.</li>
          <li>The <code>.fcs</code> extension is added when needed.</li>
          <li>The saved file&apos;s <code>$FIL</code> value is updated to match its output filename.</li>
        </ul>
      </>
    ),
  },
  {
    id: "parameters",
    label: "All parameters",
    title: "Inspect the original metadata",
    content: (
      <>
        <p>
          All Parameters is a read-only view of the selected file&apos;s FCS TEXT
          segment. Use it to confirm detector names, channel labels, acquisition
          details, and compensation metadata before saving.
        </p>
        <p className="guide-callout">
          Compensation feature names are kept aligned with renamed fluorescence
          channels when an updated copy is written.
        </p>
      </>
    ),
  },
  {
    id: "mappings",
    label: "Configs & mappings",
    title: "Reuse detector assignments",
    content: (
      <>
        <p>
          Choose the matching cytometer configuration above the editor. Its detector
          definitions drive fluorophore suggestions and paste matching.
        </p>
        <ul>
          <li><strong>Save assignments to config</strong> stores the selected file&apos;s primary and secondary names in this browser.</li>
          <li>Settings lets you add mappings manually or paste TSV/CSV rows.</li>
          <li>Export mappings as JSON to back them up or import them into another browser.</li>
        </ul>
      </>
    ),
  },
  {
    id: "save",
    label: "Save",
    title: "Write updated FCS copies",
    content: (
      <>
        <p>
          Click <strong>Save</strong>, choose a destination folder, and FCS Manager
          writes one updated copy for each loaded file.
        </p>
        <ul>
          <li>Event data is copied unchanged.</li>
          <li>Primary names, secondary names, compensation labels, and <code>$FIL</code> are updated where required.</li>
          <li>Keep original files creates a numbered alternative when an output filename already exists.</li>
        </ul>
        <p className="guide-callout">
          Processing happens locally in the app. Selected FCS data is not uploaded
          by the normal workflow.
        </p>
      </>
    ),
  },
] as const;

type GuideSectionId = (typeof guideSections)[number]["id"];
type GuideDialogProps = { onClose: () => void };

export function GuideDialog({ onClose }: GuideDialogProps) {
  const [activeId, setActiveId] = useState<GuideSectionId>("workflow");
  const dialogRef = useRef<HTMLElement>(null);
  const activeSection =
    guideSections.find((section) => section.id === activeId) ?? guideSections[0];

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLButtonElement>('[role="tab"]')?.focus();

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [onClose]);

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      nextIndex = (index + 1) % guideSections.length;
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      nextIndex = (index - 1 + guideSections.length) % guideSections.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = guideSections.length - 1;
    }

    if (nextIndex === null) return;
    event.preventDefault();
    const nextSection = guideSections[nextIndex];
    setActiveId(nextSection.id);
    dialogRef.current
      ?.querySelector<HTMLButtonElement>(`#guide-tab-${nextSection.id}`)
      ?.focus();
  }

  return createPortal(
    <div
      className="guide-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="guide-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-title"
      >
        <header className="guide-header">
          <div className="guide-heading">
            <span className="guide-heading-icon"><BookOpen size={19} /></span>
            <div>
              <span>FCS Manager</span>
              <h2 id="guide-title">Guide</h2>
            </div>
          </div>
          <button type="button" className="guide-close" onClick={onClose} aria-label="Close guide">
            <X size={18} />
          </button>
        </header>

        <div className="guide-layout">
          <nav className="guide-nav" role="tablist" aria-label="Guide sections" aria-orientation="vertical">
            {guideSections.map((section, index) => (
              <button
                id={`guide-tab-${section.id}`}
                key={section.id}
                type="button"
                role="tab"
                aria-selected={section.id === activeId}
                aria-controls={`guide-panel-${section.id}`}
                tabIndex={section.id === activeId ? 0 : -1}
                className={section.id === activeId ? "is-active" : ""}
                onClick={() => setActiveId(section.id)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
              >
                <span>{section.label}</span>
                <ChevronRight size={14} />
              </button>
            ))}
          </nav>

          <article
            id={`guide-panel-${activeSection.id}`}
            className="guide-content"
            role="tabpanel"
            aria-labelledby={`guide-tab-${activeSection.id}`}
            tabIndex={0}
          >
            <span className="guide-section-number">
              {String(guideSections.findIndex((section) => section.id === activeSection.id) + 1).padStart(2, "0")}
              {" / "}
              {String(guideSections.length).padStart(2, "0")}
            </span>
            <h3>{activeSection.title}</h3>
            {activeSection.content}
          </article>
        </div>
      </section>
    </div>,
    document.body,
  );
}
