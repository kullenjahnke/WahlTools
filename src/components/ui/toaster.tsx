"use client"

import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { X } from "lucide-react"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props} className="w-96">
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose className="absolute right-2 top-2 rounded-md p-1 
              text-foreground/50 opacity-0 transition-opacity 
              hover:text-foreground focus:opacity-100 
              focus:outline-none focus:ring-2 group-hover:opacity-100
              group-[.destructive]:text-red-300 
              group-[.destructive]:hover:text-red-50
              group-[.destructive]:focus:ring-red-400 
              group-[.destructive]:focus:ring-offset-red-600">
              <X className="h-4 w-4" />
            </ToastClose>
          </Toast>
        )
      })}
      <ToastViewport className="fixed top-0 z-[100] flex max-h-screen w-full 
        flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto 
        sm:flex-col md:max-w-[420px]" />
    </ToastProvider>
  )
}
