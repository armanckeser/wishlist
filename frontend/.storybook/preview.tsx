import type { Preview, ReactRenderer } from "@storybook/react-vite"
import { useEffect, useState } from "react"
import type { DecoratorFunction } from "storybook/internal/types"

import "@/index.css"

/**
 * Theme decorator: adds dark mode toggle and applies .dark class to Storybook root.
 * Uses Storybook toolbar for theme switching.
 */
const withTheme: DecoratorFunction<ReactRenderer> = (Story, context) => {
  const theme = context.globals.theme
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (theme === "dark") {
      root.classList.add("dark")
    } else {
      root.classList.remove("dark")
    }
  }, [theme])

  if (!mounted) return null

  return (
    <div className="min-h-full bg-background text-foreground">
      <Story />
    </div>
  )
}

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: { disable: true },
    layout: "padded",
    a11y: {
      test: "todo",
    },
  },
  globalTypes: {
    theme: {
      description: "Global theme for components",
      toolbar: {
        title: "Theme",
        icon: "circlehollow",
        items: [
          { value: "light", title: "Frost (Light)", icon: "sun" },
          { value: "dark", title: "Midnight (Dark)", icon: "moon" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: "light",
  },
  decorators: [withTheme],
}

export default preview
