import { Link } from "@tanstack/react-router"
import { useLayoutEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"

interface LogoProps {
  variant?: "full" | "icon" | "responsive"
  className?: string
  asLink?: boolean
}

/**
 * SVG wordmark with auto-sized viewBox based on actual text dimensions.
 * Uses h-6 by default, override with className for different sizes.
 */
function WishlistWordmark({ className }: { className?: string }) {
  const textRef = useRef<SVGTextElement>(null)
  const [viewBox, setViewBox] = useState("0 0 100 20")

  useLayoutEffect(() => {
    if (textRef.current) {
      const bbox = textRef.current.getBBox()
      // Add small padding to prevent clipping
      const padding = 1
      setViewBox(
        `${bbox.x - padding} ${bbox.y - padding} ${bbox.width + padding * 2} ${bbox.height + padding * 2}`,
      )
    }
  }, [])

  return (
    <svg
      viewBox={viewBox}
      fill="currentColor"
      // Default h-6 can be overridden via className
      className={cn("h-8 w-auto", className)}
      role="img"
      aria-labelledby="wishlist-logo-title"
    >
      <title id="wishlist-logo-title">Wishlist</title>
      <text
        ref={textRef}
        x="0"
        y="16"
        fontFamily="Cormorant Garamond, Georgia, serif"
        fontSize="18"
        fontWeight="300"
        letterSpacing="0.04em"
      >
        Wishlist
      </text>
    </svg>
  )
}

/**
 * SVG icon with auto-sized viewBox based on actual text dimensions.
 * Uses size-5 by default, override with className for different sizes.
 */
function WishlistIcon({ className }: { className?: string }) {
  const textRef = useRef<SVGTextElement>(null)
  const [viewBox, setViewBox] = useState("0 0 24 24")

  useLayoutEffect(() => {
    if (textRef.current) {
      const bbox = textRef.current.getBBox()
      const padding = 1
      setViewBox(
        `${bbox.x - padding} ${bbox.y - padding} ${bbox.width + padding * 2} ${bbox.height + padding * 2}`,
      )
    }
  }, [])

  return (
    <svg
      viewBox={viewBox}
      fill="currentColor"
      // Default size-5 can be overridden via className
      className={cn("size-5", className)}
      role="img"
      aria-labelledby="wishlist-icon-title"
    >
      <title id="wishlist-icon-title">Wishlist</title>
      <text
        ref={textRef}
        x="2"
        y="19"
        fontFamily="Cormorant Garamond, Georgia, serif"
        fontSize="22"
        fontWeight="300"
      >
        W
      </text>
    </svg>
  )
}

export function Logo({
  variant = "full",
  className,
  asLink = true,
}: LogoProps) {
  const content =
    variant === "responsive" ? (
      <>
        <WishlistWordmark
          className={cn("group-data-[collapsible=icon]:hidden", className)}
        />
        <WishlistIcon
          className={cn(
            "hidden group-data-[collapsible=icon]:block",
            className,
          )}
        />
      </>
    ) : variant === "full" ? (
      <WishlistWordmark className={className} />
    ) : (
      <WishlistIcon className={className} />
    )

  if (!asLink) {
    return content
  }

  return (
    <Link to="/" search={{ default: "wishlist" }}>
      {content}
    </Link>
  )
}
