import * as React from "react";
import { cn } from "@/lib/utils";

// Single source of truth for page padding and max-width. Every dashboard page
// wraps its content in this so horizontal/vertical padding stays consistent.

export interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Constrain content width (default) or let it span the full area. */
  width?: "default" | "wide" | "full";
}

const WIDTHS: Record<NonNullable<PageContainerProps["width"]>, string> = {
  default: "max-w-[1400px]",
  wide: "max-w-[1600px]",
  full: "max-w-none",
};

export function PageContainer({
  width = "default",
  className,
  children,
  ...props
}: PageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 py-6 md:px-8 md:py-8 space-y-6",
        WIDTHS[width],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
