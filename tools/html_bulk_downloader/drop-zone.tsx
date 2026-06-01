"use client";

import { useRef, useState, useCallback } from "react";
import { FolderOpen, Upload } from "lucide-react";

interface DropZoneProps {
  onFiles: (files: File[]) => void;
}

export function DropZone({ onFiles }: DropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((raw: FileList | null) => {
    if (!raw) return;
    const htmlFiles = Array.from(raw).filter((f) =>
      f.name.toLowerCase().endsWith(".html") || f.type === "text/html"
    );
    if (htmlFiles.length) onFiles(htmlFiles);
  }, [onFiles]);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };
  const onDragLeave = () => setDragging(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="bd-drop-outer">
      <div
        className={`bd-drop-zone${dragging ? " dragging" : ""}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        aria-label="Drop HTML files here or click to browse"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".html,text/html"
          multiple
          style={{ display: "none" }}
          onChange={(e) => handleFiles(e.target.files)}
        />

        <div className="bd-drop-icon">
          {dragging ? <Upload size={28} /> : <FolderOpen size={28} />}
        </div>
        <p className="bd-drop-title">
          {dragging ? "Release to add files" : "Drop HTML files here"}
        </p>
        <p className="bd-drop-sub">or click to browse — multiple files supported</p>
        <span className="bd-drop-badge">.html</span>
      </div>
    </div>
  );
}
