import { Link } from "@tanstack/react-router"
import { ArrowRight, Play, Sparkles } from "lucide-react"
import { useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import type { WhatsNewContent } from "@/config/whats-new"
import { usePushNotifications } from "@/hooks/usePushNotifications"

interface WhatsNewDrawerProps {
  open: boolean
  content: WhatsNewContent
  version: string
  onDismiss: () => void
}

/**
 * Bottom sheet drawer showing what's new in the latest version.
 * Appears automatically when the app version changes.
 */
export function WhatsNewDrawer({
  open,
  content,
  version,
  onDismiss,
}: WhatsNewDrawerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const { isSupported, isEnabled, permission, isSubscribed, subscribe } =
    usePushNotifications()

  // TODO: Remove in next version (0.27.0) - one-time push notification prompt for 0.26.0
  const hasPromptedRef = useRef(false)
  useEffect(() => {
    if (!open || hasPromptedRef.current) return
    if (!isSupported || !isEnabled || isSubscribed) return
    if (permission === "denied") return

    hasPromptedRef.current = true
    subscribe()
  }, [open, isSupported, isEnabled, isSubscribed, permission, subscribe])

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      onDismiss()
    }
  }

  const handleWatchClick = () => {
    const video = videoRef.current
    if (!video) return

    video.currentTime = 0
    video.play()

    if (video.requestFullscreen) {
      video.requestFullscreen()
    } else if (
      (video as HTMLVideoElement & { webkitEnterFullscreen?: () => void })
        .webkitEnterFullscreen
    ) {
      // iOS Safari
      ;(
        video as HTMLVideoElement & { webkitEnterFullscreen: () => void }
      ).webkitEnterFullscreen()
    }
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="max-h-[85dvh]">
        <DrawerHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <DrawerTitle className="text-xl">{content.title}</DrawerTitle>
          <p className="text-xs text-muted-foreground">Version {version}</p>
        </DrawerHeader>

        <div className="overflow-y-auto px-6 pb-4">
          <div className="space-y-6">
            {content.sections.map((section, index) => (
              <div key={index} className="space-y-2">
                {section.image && (
                  <div className="overflow-hidden rounded-lg bg-muted/50">
                    {section.image.endsWith(".mp4") ||
                    section.image.endsWith(".webm") ? (
                      <button
                        type="button"
                        onClick={handleWatchClick}
                        className="group relative w-full cursor-pointer"
                        aria-label="Watch in action"
                      >
                        {/* 21:9 aspect ratio container */}
                        <div className="relative aspect-[21/9] overflow-hidden">
                          <video
                            ref={videoRef}
                            src={section.image}
                            muted
                            playsInline
                            className="absolute inset-0 h-full w-full object-cover object-top"
                          />
                          {/* Gradient overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                        </div>
                        {/* CTA */}
                        <div className="absolute inset-x-0 bottom-0 flex items-center justify-center pb-3">
                          <span className="flex items-center gap-2 rounded-full bg-white/90 px-4 py-1.5 text-sm font-medium text-black shadow-lg transition-transform group-hover:scale-105">
                            <Play className="size-4 fill-current" />
                            Watch in action
                          </span>
                        </div>
                      </button>
                    ) : (
                      <img
                        src={section.image}
                        alt={section.heading}
                        className="h-auto w-full object-cover"
                      />
                    )}
                  </div>
                )}
                <h3 className="font-medium text-foreground">
                  {section.heading}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {section.description}
                </p>
                {section.link && (
                  <Link
                    to={section.link.href}
                    onClick={onDismiss}
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    {section.link.label}
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>

        <DrawerFooter className="pt-2">
          <DrawerClose asChild>
            <Button className="w-full" size="lg">
              Got it!
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
