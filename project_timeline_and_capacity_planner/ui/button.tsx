"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost";
  size?: "sm" | "md";
  children: ReactNode;
}

export function Button({ variant = "ghost", size = "md", className, children, ...rest }: Props) {
  return (
    <button
      type="button"
      className={cn(
        "btn",
        variant === "primary" ? "btn-primary" : "btn-ghost",
        size === "sm" && "btn-sm",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
