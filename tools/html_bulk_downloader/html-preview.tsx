"use client";

// Renders a scaled-down iframe thumbnail of an HTML file blob URL.
// The iframe is 800px wide, scaled to fit a 96px-wide thumbnail container.
const IFRAME_W = 800;
const THUMB_W = 96;
const THUMB_H = 68;
const SCALE = THUMB_W / IFRAME_W;

interface HtmlPreviewProps {
  objectUrl: string;
}

export function HtmlPreview({ objectUrl }: HtmlPreviewProps) {
  return (
    <div className="bd-preview-wrap" style={{ width: THUMB_W, height: THUMB_H }}>
      <iframe
        src={objectUrl}
        className="bd-preview-iframe"
        style={{
          width: IFRAME_W,
          height: THUMB_H / SCALE,
          transform: `scale(${SCALE})`,
          transformOrigin: "top left",
        }}
        sandbox="allow-same-origin allow-scripts"
        loading="lazy"
        title="HTML preview"
        aria-hidden="true"
      />
    </div>
  );
}
