"use client";

import * as React from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// Kebab (meatballs) overflow menu for table/card row actions.

export interface RowAction {
  label: string;
  icon?: React.ReactNode;
  href?: string;
  onSelect?: () => void;
  destructive?: boolean;
  /** Insert a separator above this item. */
  separatorBefore?: boolean;
  disabled?: boolean;
}

export interface RowActionsProps {
  actions: RowAction[];
  /** Accessible label for the trigger. */
  label?: string;
  align?: "start" | "end" | "center";
  className?: string;
}

export function RowActions({
  actions,
  label = "Open menu",
  align = "end",
  className,
}: RowActionsProps) {
  if (actions.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("size-8 text-muted-foreground", className)}
          aria-label={label}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-40">
        {actions.map((action, i) => {
          const content = (
            <>
              {action.icon}
              {action.label}
            </>
          );
          const itemClass = cn(
            action.destructive &&
              "text-destructive focus:bg-destructive/10 focus:text-destructive"
          );
          return (
            <React.Fragment key={`${action.label}-${i}`}>
              {action.separatorBefore && <DropdownMenuSeparator />}
              {action.href ? (
                <DropdownMenuItem asChild className={itemClass} disabled={action.disabled}>
                  <Link href={action.href}>{content}</Link>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  className={itemClass}
                  disabled={action.disabled}
                  onSelect={(e) => {
                    e.preventDefault();
                    action.onSelect?.();
                  }}
                >
                  {content}
                </DropdownMenuItem>
              )}
            </React.Fragment>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
