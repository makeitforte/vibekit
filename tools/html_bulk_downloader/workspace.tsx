"use client";

import { useCallback, useRef, useState } from "react";
import { CheckCircle2, XCircle, Loader2, Download, RotateCcw, FolderDown } from "lucide-react";
import { toast } from "sonner";
import { DropZone } from "./drop-zone";
import { RenameTable } from "./rename-table";
import {
  FileEntry,
  ConvertResult,
  ProgressInfo,
  processFilesBatch,
  buildZip,
} from "./convert";

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase =
  | { type: "idle" }
  | { type: "reviewing"; entries: FileEntry[] }
  | { type: "converting"; entries: FileEntry[]; progress: ProgressInfo; results: ConvertResult[] }
  | { type: "done"; results: ConvertResult[]; zipBlob: Blob };

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEntries(files: File[]): FileEntry[] {
  return files.map((file) => ({
    id: crypto.randomUUID(),
    file,
    objectUrl: URL.createObjectURL(file),
    outputName: file.name.replace(/\.html?$/i, ""),
  }));
}

function revokeEntries(entries: FileEntry[]) {
  entries.forEach((e) => URL.revokeObjectURL(e.objectUrl));
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BulkDownloaderWorkspace() {
  const [phase, setPhase] = useState<Phase>({ type: "idle" });
  const cancelRef = useRef(false);
  const addMoreInputRef = useRef<HTMLInputElement>(null);

  // ── File selection ──
  const handleFiles = useCallback((newFiles: File[]) => {
    setPhase((prev) => {
      if (prev.type === "reviewing") {
        // Merge with existing, deduplicate by name
        const existingNames = new Set(prev.entries.map((e) => e.file.name));
        const fresh = newFiles.filter((f) => !existingNames.has(f.name));
        return { type: "reviewing", entries: [...prev.entries, ...makeEntries(fresh)] };
      }
      return { type: "reviewing", entries: makeEntries(newFiles) };
    });
  }, []);

  // ── Reviewing actions ──
  const handleRename = useCallback((id: string, newName: string) => {
    setPhase((prev) =>
      prev.type === "reviewing"
        ? { ...prev, entries: prev.entries.map((e) => e.id === id ? { ...e, outputName: newName } : e) }
        : prev
    );
  }, []);

  const handleRemove = useCallback((id: string) => {
    setPhase((prev) => {
      if (prev.type !== "reviewing") return prev;
      const removed = prev.entries.find((e) => e.id === id);
      if (removed) URL.revokeObjectURL(removed.objectUrl);
      const entries = prev.entries.filter((e) => e.id !== id);
      return entries.length === 0 ? { type: "idle" } : { ...prev, entries };
    });
  }, []);

  const handleClear = useCallback(() => {
    setPhase((prev) => {
      if (prev.type === "reviewing") revokeEntries(prev.entries);
      return { type: "idle" };
    });
  }, []);

  // ── Conversion ──
  const handleConvert = useCallback(async () => {
    if (phase.type !== "reviewing") return;
    const { entries } = phase;

    // Validate all output names filled
    const empty = entries.find((e) => !e.outputName.trim());
    if (empty) {
      toast.warning("Empty file name", { description: `Fill in a PDF name for "${empty.file.name}".` });
      return;
    }

    cancelRef.current = false;

    const initialProgress: ProgressInfo = {
      current: 0, total: entries.length, currentName: "", results: [],
    };
    setPhase({ type: "converting", entries, progress: initialProgress, results: [] });

    const results = await processFilesBatch(
      entries,
      (info) => setPhase((prev) =>
        prev.type === "converting" ? { ...prev, progress: info, results: info.results } : prev
      ),
      cancelRef
    );

    revokeEntries(entries);

    const successCount = results.filter((r) => r.blob !== null).length;
    if (successCount === 0) {
      toast.error("All files failed", { description: "No PDFs were generated." });
      setPhase({ type: "idle" });
      return;
    }

    // Build ZIP
    toast.info("Building ZIP…", { description: `Packaging ${successCount} PDF${successCount > 1 ? "s" : ""}…` });
    try {
      const zipBlob = await buildZip(results);
      downloadBlob(zipBlob, "vibekit-bulk-export.zip");
      toast.success("Download started", { description: "vibekit-bulk-export.zip" });
      setPhase({ type: "done", results, zipBlob });
    } catch {
      toast.error("ZIP creation failed");
      setPhase({ type: "idle" });
    }
  }, [phase]);

  const handleRedownload = useCallback(() => {
    if (phase.type !== "done") return;
    downloadBlob(phase.zipBlob, "vibekit-bulk-export.zip");
  }, [phase]);

  const handleReset = useCallback(() => {
    cancelRef.current = true;
    setPhase({ type: "idle" });
  }, []);

  // ── Render ──
  return (
    <div className="bd-workspace">
      {/* Tool header */}
      <div className="bf-header">
        <div className="bf-icon">
          <FolderDown size={20} />
        </div>
        <div>
          <h1 className="bf-title">HTML bulk downloader</h1>
          <p className="bf-subtitle">Convert multiple HTML files to PDF and download as a ZIP.</p>
        </div>
      </div>

      <div className="bd-content">
        {/* ── IDLE ── */}
        {phase.type === "idle" && (
          <DropZone onFiles={handleFiles} />
        )}

        {/* ── REVIEWING ── */}
        {phase.type === "reviewing" && (
          <RenameTable
            entries={phase.entries}
            onRename={handleRename}
            onRemove={handleRemove}
            onAddMore={() => {
              // Programmatically open file picker via a hidden input
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".html,text/html";
              input.multiple = true;
              input.onchange = () => handleFiles(Array.from(input.files ?? []));
              input.click();
            }}
            onConvert={handleConvert}
            onClear={handleClear}
          />
        )}

        {/* ── CONVERTING ── */}
        {phase.type === "converting" && (
          <div className="bd-progress-view">
            <div className="bd-progress-header">
              <Loader2 size={20} className="animate-spin text-[var(--accent)]" />
              <span>
                Converting {phase.progress.current} of {phase.progress.total}…
              </span>
            </div>

            {/* Progress bar */}
            <div className="bd-progress-bar-wrap">
              <div
                className="bd-progress-bar"
                style={{
                  width: phase.progress.total > 0
                    ? `${(phase.progress.current / phase.progress.total) * 100}%`
                    : "0%",
                }}
              />
            </div>

            {/* Per-file status list */}
            <div className="bd-status-list">
              {phase.entries.map((entry, i) => {
                const done = phase.results.find((r) => r.outputName === entry.outputName);
                const isCurrent = i + 1 === phase.progress.current && !done;
                return (
                  <div key={entry.id} className="bd-status-row">
                    {done ? (
                      done.blob
                        ? <CheckCircle2 size={15} className="bd-status-ok" />
                        : <XCircle size={15} className="bd-status-fail" />
                    ) : isCurrent ? (
                      <Loader2 size={15} className="animate-spin bd-status-spin" />
                    ) : (
                      <span className="bd-status-dot" />
                    )}
                    <span className={done && !done.blob ? "bd-status-name-fail" : "bd-status-name"}>
                      {entry.outputName}.pdf
                    </span>
                    {done?.error && (
                      <span className="bd-status-error">{done.error}</span>
                    )}
                  </div>
                );
              })}
            </div>

            <button className="btn btn-ghost" onClick={handleReset} type="button" style={{ marginTop: 16 }}>
              Cancel
            </button>
          </div>
        )}

        {/* ── DONE ── */}
        {phase.type === "done" && (() => {
          const ok = phase.results.filter((r) => r.blob !== null);
          const failed = phase.results.filter((r) => r.blob === null);
          return (
            <div className="bd-done-view">
              <div className="bd-done-header">
                <CheckCircle2 size={22} className="text-[var(--accent)]" />
                <span>
                  {ok.length} PDF{ok.length !== 1 ? "s" : ""} ready
                  {failed.length > 0 && ` · ${failed.length} skipped`}
                </span>
              </div>

              <div className="bd-status-list">
                {phase.results.map((r) => (
                  <div key={r.outputName} className="bd-status-row">
                    {r.blob
                      ? <CheckCircle2 size={15} className="bd-status-ok" />
                      : <XCircle size={15} className="bd-status-fail" />}
                    <span className={!r.blob ? "bd-status-name-fail" : "bd-status-name"}>
                      {r.outputName}.pdf
                    </span>
                    {r.error && <span className="bd-status-error">{r.error}</span>}
                  </div>
                ))}
              </div>

              <div className="bd-done-actions">
                <button className="btn btn-primary" onClick={handleRedownload} type="button">
                  <Download size={15} /> Re-download ZIP
                </button>
                <button className="btn btn-ghost" onClick={handleReset} type="button">
                  <RotateCcw size={14} /> Start over
                </button>
              </div>
            </div>
          );
        })()}
      </div>

      <input ref={addMoreInputRef} type="file" accept=".html,text/html" multiple style={{ display: "none" }} />
    </div>
  );
}
