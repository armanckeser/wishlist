import { useEffect, useState } from "react"

interface KeyboardState {
  visible: boolean
  height: number
}

/**
 * Hook to detect mobile virtual keyboard visibility using the Visual Viewport API.
 *
 * Returns whether the keyboard is visible and its approximate height.
 * Uses a threshold of 100px to distinguish keyboard from browser chrome changes.
 */
export function useKeyboardVisible(): KeyboardState {
  const [keyboard, setKeyboard] = useState<KeyboardState>({
    visible: false,
    height: 0,
  })

  useEffect(() => {
    const visualViewport = window.visualViewport
    if (!visualViewport) return

    const handleResize = () => {
      const windowHeight = window.innerHeight
      const viewportHeight = visualViewport.height
      const keyboardHeight = windowHeight - viewportHeight

      // 100px threshold accounts for browser chrome/toolbars
      setKeyboard({
        visible: keyboardHeight > 100,
        height: Math.max(0, keyboardHeight),
      })
    }

    visualViewport.addEventListener("resize", handleResize)
    visualViewport.addEventListener("scroll", handleResize)

    // Initial check
    handleResize()

    return () => {
      visualViewport.removeEventListener("resize", handleResize)
      visualViewport.removeEventListener("scroll", handleResize)
    }
  }, [])

  return keyboard
}
