import type { ReactNode } from "react";

/* ============================================================
   STAGGERED ENTRANCE
   Wraps list rows so they drop in one pixel-step at a time,
   like rows of an arcade high-score table.

   Use `as="tr"` inside tables — a wrapping <div> between
   <tbody> and <tr> would break the table layout.
   ============================================================ */

export default function StaggerIn({
  index = 0,
  className = "",
  as = "div",
  children,
}: {
  index?: number;
  className?: string;
  as?: "div" | "tr";
  children: ReactNode;
}) {
  const Tag = as;

  return (
    <Tag
      className={`animate-step-in ${className}`}
      style={{ animationDelay: `${Math.min(index, 12) * 45}ms` }}
    >
      {children}
    </Tag>
  );
}