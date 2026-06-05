"use client";

import * as React from "react";
import Link from "next/link";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// A compact, tooltip-labelled icon button that replaces text links/buttons
// ("View all", "Record prices", etc.). Renders as a Next.js Link when `href`
// is provided, otherwise a plain button.

export interface IconButtonProps extends Omit<ButtonProps, "children"> {
  /** Accessible label, also shown in the tooltip. */
  label: string;
  /** Icon element (lucide icon). */
  icon: React.ReactNode;
  /** Render as a link to this href. */
  href?: string;
  tooltipSide?: "top" | "right" | "bottom" | "left";
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      label,
      icon,
      href,
      tooltipSide = "top",
      variant = "ghost",
      size = "icon",
      className,
      ...props
    },
    ref
  ) => {
    const trigger = href ? (
      <Button
        asChild
        variant={variant}
        size={size}
        className={cn(className)}
        aria-label={label}
        {...props}
      >
        <Link href={href}>{icon}</Link>
      </Button>
    ) : (
      <Button
        ref={ref}
        variant={variant}
        size={size}
        className={cn(className)}
        aria-label={label}
        {...props}
      >
        {icon}
      </Button>
    );

    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>{trigger}</TooltipTrigger>
          <TooltipContent side={tooltipSide}>{label}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
);
IconButton.displayName = "IconButton";
