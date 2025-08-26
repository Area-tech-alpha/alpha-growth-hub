"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type ThemeMode = "light" | "dark" | "system";

const Toaster = ({ ...props }: React.ComponentProps<typeof Sonner>) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ThemeMode}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--card)",
          "--normal-text": "var(--foreground)",
          "--normal-border": "var(--border)",
          "--success-bg": "var(--card)",
          "--success-text": "var(--foreground)",
          "--success-border": "var(--border)",
          "--warning-bg": "var(--card)",
          "--warning-text": "var(--foreground)",
          "--warning-border": "var(--border)",
          "--error-bg": "var(--card)",
          "--error-text": "var(--foreground)",
          "--error-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
