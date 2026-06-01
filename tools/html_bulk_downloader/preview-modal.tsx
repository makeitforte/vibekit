"use client";

import { useEffect } from "react";
import { X, ExternalLink } from "lucide-react";

interface PreviewModalProps {
  objectUrl: string;
  filename: string;
  onClose: () => void;
}

export function PreviewModal({ objectUrl, filename, onClose }: PreviewModalProps) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="pm-scrim" onClick={onClose}>
      <div className="pm-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="pm-header">
          <span className="pm-filename">{filename}</span>
          <div className="pm-header-actions">
            <a
              href={objectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="icon-btn"
              title="Open in new tab"
            >
              <ExternalLink size={15} />
            </a>
            <button className="icon-btn" onClick={onClose} type="button" title="Close (Esc)">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Full iframe */}
        <div className="pm-body">
          <iframe
            src={objectUrl}
            className="pm-iframe"
            sandbox="allow-same-origin allow-scripts"
            title={`Preview: ${filename}`}
          />
        </div>
      </div>
    </div>
  );
}
