"use client";

import Link from "next/link";
import {
  Code2, Braces, Regex, Palette, GitCompare, Binary,
  GitCommitHorizontal, Sparkles, Wand2, ArrowRight,
} from "lucide-react";
import { Tool } from "@/data/tools";
import { cn } from "@/lib/cn";

const ICON_MAP: Record<string, React.ElementType> = {
  Code2, Braces, Regex, Palette, GitCompare, Binary,
  GitCommitHorizontal, Sparkles, Wand2,
};

interface ToolCardProps {
  tool: Tool;
}

export function ToolCard({ tool }: ToolCardProps) {
  const Icon = ICON_MAP[tool.icon] ?? Code2;
  const isActive = tool.status === "active";
  const isAi = tool.status === "ai";
  const badge = isActive ? null : isAi ? "AI feature" : "Upcoming";

  const cardClass = cn(
    "tool-card",
    isActive && "active",
    !isActive && "locked",
    isAi && "ai"
  );

  const inner = (
    <>
      {badge && (
        <span className={cn("card-badge", isAi && "ai")}>
          {isAi && <Sparkles size={10} />}
          {badge}
        </span>
      )}
      <div className="card-icon">
        <Icon size={20} />
      </div>
      <div className="card-name">{tool.name}</div>
      <div className="card-blurb">{tool.blurb}</div>
      <div className="card-foot">
        <span className="card-tag">{tool.tag}</span>
        {isActive && (
          <span className="card-run">
            Run tool <ArrowRight size={13} />
          </span>
        )}
      </div>
    </>
  );

  if (isActive && tool.href) {
    return (
      <Link href={tool.href} className={cardClass}>
        {inner}
      </Link>
    );
  }

  return (
    <div className={cardClass} aria-disabled="true">
      {inner}
    </div>
  );
}
