"use client";

import { useRef, useState, useCallback } from "react";
import { cn } from "@/lib/cn";

interface ResizableSplitProps {
  left: React.ReactNode;
  right: React.ReactNode;
  minPercent?: number;
  maxPercent?: number;
  className?: string;
}

export function ResizableSplit({
  left,
  right,
  minPercent = 20,
  maxPercent = 80,
  className,
}: ResizableSplitProps) {
  const [leftFr, setLeftFr] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMouseMove = (ev: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const pct = (x / rect.width) * 100;
      setLeftFr(Math.min(maxPercent, Math.max(minPercent, pct)));
    };

    const onMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [minPercent, maxPercent]);

  return (
    <div
      ref={containerRef}
      className={cn("resizable-split", className)}
      style={{ gridTemplateColumns: `${leftFr}fr 18px ${100 - leftFr}fr` }}
    >
      {/* Left pane */}
      <div className="resizable-pane">{left}</div>

      {/* Grip handle */}
      <div
        className="resizable-grip"
        onMouseDown={handleMouseDown}
        title="Drag to resize"
        role="separator"
        aria-orientation="vertical"
      >
        <span />
        <span />
      </div>

      {/* Right pane */}
      <div className="resizable-pane">{right}</div>
    </div>
  );
}
