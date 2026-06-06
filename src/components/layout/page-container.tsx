import * as React from "react";
import { cn } from "@/lib/utils";

// Single source of truth for page padding. Every dashboard page wraps its
// content in this so horizontal/vertical padding stays consistent. Content
// spans the full width of the main area, matching the Dashboard page.

export type PageContainerProps = React.HTMLAttributes<HTMLDivElement>;

export function PageContainer({ className, children, ...props }: PageContainerProps) {
  return (
    <div className={cn("w-full space-y-6 p-4 md:p-6", className)} {...props}>
      {children}
    </div>
  );
}
