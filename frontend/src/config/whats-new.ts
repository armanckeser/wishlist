/**
 * What's New configuration.
 *
 * Update WHATS_NEW_VERSION and whatsNewContent when releasing new features.
 * NOT when there is a minor version bump for bug fixes or small changes.
 * The drawer will automatically show when the version changes.
 *
 * ## Writing Guidelines
 *
 * Focus on BENEFITS, not features. Answer "what can I do now?" not "what did we build?"
 *
 * Good: "Share your wishlist with friends and family so they know exactly what to get you"
 * Bad:  "We added a sharing feature with email invites and visibility controls"
 *
 * Good: "Never lose track of updates - see what's new each time we improve the app"
 * Bad:  "Added a What's New modal that shows on version change"
 *
 * Keep descriptions concise (1-2 sentences). Use images/GIFs to show, not tell.
 */

export const WHATS_NEW_VERSION = "0.31.0" // Update on major feature releases

export interface WhatsNewSection {
  heading: string
  description: string
  /** Optional image or GIF path (relative to public/) */
  image?: string
  /** Optional link for a call-to-action */
  link?: {
    label: string
    href: string
  }
}

export interface WhatsNewContent {
  title: string
  sections: WhatsNewSection[]
}

export const whatsNewContent: WhatsNewContent = {
  title: "What's New",
  sections: [
    {
      heading: "Watch Prices Drop",
      description:
        "We check prices on your wishlisted items every day and chart how they move. See a markdown the moment it happens, so you know exactly when to buy.",
      image: "/whats-new/price-tracking.png",
    },
  ],
}
