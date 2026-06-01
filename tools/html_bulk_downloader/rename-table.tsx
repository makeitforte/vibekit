"use client";

import { useState } from "react";
import { X, ArrowRight, PlusCircle, Maximize2 } from "lucide-react";
import { HtmlPreview } from "./html-preview";
import { PreviewModal } from "./preview-modal";
import { FileEntry } from "./convert";

interface RenameTableProps {
  entries: FileEntry[];
  onRename: (id: string, newName: string) => void;
  onRemove: (id: string) => void;
  onAddMore: () => void;
  onConvert: () => void;
  onClear: () => void;
}

export function RenameTable({
  entries, onRename, onRemove, onAddMore, onConvert, onClear,
}: RenameTableProps) {
  const [previewEntry, setPreviewEntry] = useState<FileEntry | null>(null);

  return (
    <>
      <div className="bd-review">
        {/* Header row */}
        <div className="bd-review-header">
          <span className="bd-review-count">
            {entries.length} file{entries.length !== 1 ? "s" : ""} selected
          </span>
          <div className="bd-review-actions">
            <button className="btn btn-ghost" onClick={onAddMore} type="button">
              <PlusCircle size={14} /> Add more
            </button>
            <button className="btn btn-ghost" onClick={onClear} type="button">
              Clear all
            </button>
          </div>
        </div>

        {/* Column labels */}
        <div className="bd-table-labels">
          <span style={{ width: 96 }}>Preview</span>
          <span className="bd-col-before">Before</span>
          <span className="bd-col-arrow" />
          <span className="bd-col-after">After (PDF name)</span>
          <span style={{ width: 28 }} />
        </div>

        {/* File rows */}
        <div className="bd-table-rows">
          {entries.map((entry) => (
            <div key={entry.id} className="bd-table-row">
              {/* Thumbnail — click to open full preview */}
              <div className="bd-thumb-wrap">
                <HtmlPreview objectUrl={entry.objectUrl} />
                <button
                  className="bd-thumb-expand"
                  onClick={() => setPreviewEntry(entry)}
                  type="button"
                  title="Full preview"
                >
                  <Maximize2 size={11} />
                </button>
              </div>

              {/* Before */}
              <div className="bd-col-before">
                <span className="bd-filename-before">{entry.file.name}</span>
                <span className="bd-filesize">
                  {(entry.file.size / 1024).toFixed(1)} KB
                </span>
              </div>

              {/* Arrow */}
              <div className="bd-col-arrow">
                <ArrowRight size={14} className="text-[var(--fg-4)]" />
              </div>

              {/* After — editable */}
              <div className="bd-col-after">
                <div className="bd-rename-field">
                  <input
                    type="text"
                    value={entry.outputName}
                    onChange={(e) =>
                      onRename(entry.id, e.target.value.replace(/[^a-zA-Z0-9-_ ]/g, ""))
                    }
                    placeholder="output name"
                    spellCheck={false}
                  />
                  <span className="bd-rename-ext">.pdf</span>
                </div>
              </div>

              {/* Remove */}
              <button
                className="bd-remove-btn"
                onClick={() => onRemove(entry.id)}
                type="button"
                title="Remove"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>

        {/* Convert CTA */}
        <div className="bd-review-footer">
          <button className="btn btn-primary" onClick={onConvert} type="button">
            Convert &amp; Download ZIP →
          </button>
          <span className="bd-footer-hint">
            All {entries.length} files will be converted to PDF and zipped
          </span>
        </div>
      </div>

      {/* Full preview modal */}
      {previewEntry && (
        <PreviewModal
          objectUrl={previewEntry.objectUrl}
          filename={previewEntry.file.name}
          onClose={() => setPreviewEntry(null)}
        />
      )}
    </>
  );
}
