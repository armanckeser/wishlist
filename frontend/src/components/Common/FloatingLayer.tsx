import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

interface FloatingLayerProps {
  children: React.ReactNode
}

/**
 * Bottom-right floating action layer (the add-item FAB, the selection FAB).
 *
 * Portals to <body> deliberately. The app shell keeps a single scrolling
 * element ([data-app-scroll]); WebKit is unreliable about painting
 * position:fixed children *inside* a scrolling container during momentum
 * scroll — they flicker and lag a frame behind. Rendering outside that
 * container sidesteps it entirely, and the shell never scrolls, so the
 * layer stays put.
 *
 * Insets use max(..., env(...)) so the buttons clear the iPhone home
 * indicator without floating too far up on devices that have no inset.
 *
 * z-40 keeps the layer above page content but *below* the z-50 modal
 * layer — portalling put it late in the DOM, so at an equal z-index it
 * would paint on top of an open drawer and its overlay.
 */
export function FloatingLayer({ children }: FloatingLayerProps) {
  // Portals need a DOM target, which only exists after mount.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  return createPortal(
    <div className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-[max(1.5rem,env(safe-area-inset-right))] z-40 flex flex-col items-end gap-2">
      {children}
    </div>,
    document.body,
  )
}
