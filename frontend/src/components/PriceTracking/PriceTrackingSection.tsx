import {
  CloudOff,
  Link2Off,
  Loader2,
  RefreshCw,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react"
import { useState } from "react"

import type {
  PriceCheckFailureReason,
  PriceCheckResultPublic,
  PriceTrackingPublic,
  WishlistedItemPublic,
} from "@/client"
import { Hint } from "@/components/Common/Hint"
import { getApiErrorMessage, usePriceTracking } from "@/hooks/usePriceTracking"
import { cn } from "@/lib/utils"

import { formatCents, formatRelativeShort } from "./format"
import { PriceChangeChip } from "./PriceChangeChip"
import { PriceHistoryChart } from "./PriceHistoryChart"

interface PriceTrackingSectionProps {
  item: WishlistedItemPublic
  /** Open the item for editing, to fix a link that no longer works. */
  onFixLink?: () => void
  className?: string
}

const labelClass =
  "text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/70"

const textButtonClass =
  "text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/70 transition-colors hover:text-foreground disabled:opacity-50"

type StatusIcon = typeof Link2Off

/** One or two words for the state, and the sentence that explains it. */
const STATUS: Record<
  PriceCheckFailureReason,
  { label: string; hint: string; icon: StatusIcon; needsLink?: boolean }
> = {
  link_moved: {
    icon: Link2Off,
    label: "Link moved",
    hint: "This link now opens a different page, so the price on it isn't this item's. Update the link to keep tracking.",
    needsLink: true,
  },
  different_product: {
    icon: Link2Off,
    label: "Wrong page",
    hint: "The page at this link shows a different product now. Update the link to keep tracking.",
    needsLink: true,
  },
  blocked: {
    icon: ShieldAlert,
    label: "Blocked",
    hint: "The store is turning away automated checks. We'll keep trying.",
  },
  unreachable: {
    icon: CloudOff,
    label: "Unreachable",
    hint: "We couldn't load the page. The store may be down.",
  },
  no_price: {
    icon: TriangleAlert,
    label: "No price",
    hint: "The page loaded without a price on it - the item may be sold out.",
  },
  implausible: {
    icon: TriangleAlert,
    label: "Odd price",
    hint: "The price we read was too far from this item's to be believable, so we ignored it.",
  },
  no_link: {
    icon: Link2Off,
    label: "Needs a link",
    hint: "Add a product link and we'll check its price every day.",
  },
}

const HOW_IT_WORKS =
  "Checked once a day. You'll get a notification when the price moves."

/**
 * Drawer section for automatic price tracking on a wishlisted item.
 *
 * Tracking is automatic - any item with a product link is checked daily -
 * so the section shows state, not instructions: the graph, what it cost when
 * you added it, and a one- or two-word status when a check couldn't be
 * trusted. The explanations live behind hints.
 */
export function PriceTrackingSection({
  item,
  onFixLink,
  className,
}: PriceTrackingSectionProps) {
  const tracking = item.price_tracking
  const isTracking = Boolean(tracking?.enabled)
  const { history, enable, disable, restart, check } = usePriceTracking(
    item.id,
    { fetchHistory: isTracking },
  )

  // Inline feedback (errors and manual check results) - never a toast.
  // Tagged with the item id so a notice never leaks onto another item.
  const [noticeState, setNoticeState] = useState<{
    itemId: string
    tone: "info" | "success" | "error"
    text: string
  } | null>(null)
  const notice = noticeState?.itemId === item.id ? noticeState : null
  const setNotice = (
    next: { tone: "info" | "success" | "error"; text: string } | null,
  ) => setNoticeState(next ? { itemId: item.id, ...next } : null)

  const handleEnable = () => {
    setNotice({ tone: "info", text: "Checking…" })
    enable.mutate(undefined, {
      onSuccess: () => setNotice(null),
      onError: (error) =>
        setNotice({ tone: "error", text: getApiErrorMessage(error) }),
    })
  }

  const handleDisable = () => {
    disable.mutate(undefined, {
      onSuccess: () => setNotice(null),
      onError: (error) =>
        setNotice({ tone: "error", text: getApiErrorMessage(error) }),
    })
  }

  const handleRestart = () => {
    restart.mutate(undefined, {
      onSuccess: () => setNotice(null),
      onError: (error) =>
        setNotice({ tone: "error", text: getApiErrorMessage(error) }),
    })
  }

  const handleCheck = () => {
    setNotice({ tone: "info", text: "Checking…" })
    check.mutate(undefined, {
      onSuccess: (result: PriceCheckResultPublic) =>
        setNotice({
          tone: result.outcome === "failed" ? "error" : "success",
          text: result.message,
        }),
      onError: (error) =>
        setNotice({ tone: "error", text: getApiErrorMessage(error) }),
    })
  }

  const busy =
    enable.isPending ||
    disable.isPending ||
    check.isPending ||
    restart.isPending
  const status = failureStatus(item, tracking)
  // Only worth offering when there is a price to take back.
  const addedPrice = tracking?.original_price_cents
  const canRestart = addedPrice != null && addedPrice !== item.price_cents

  // --- Not tracking: no link, never checked, turned off, or paused --------
  if (!isTracking) {
    if (!item.product_url) {
      return (
        <Section className={className}>
          <SectionHeader />
          <Status status={STATUS.no_link} />
        </Section>
      )
    }

    const turnedOff = tracking?.disabled_by_user

    return (
      <Section className={className}>
        <SectionHeader detail={tracking?.paused ? "paused" : null} />
        {status && <Status status={status} onFixLink={onFixLink} />}
        <ActionRow>
          <ActionButton onClick={handleEnable} disabled={busy}>
            {enable.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="h-3 w-3" aria-hidden />
            )}
            {turnedOff ? "Turn on" : status ? "Retry" : "Check now"}
          </ActionButton>
          {canRestart && (
            <RestartButton
              addedPriceCents={addedPrice}
              onRestart={handleRestart}
              disabled={busy}
            />
          )}
        </ActionRow>
        {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
      </Section>
    )
  }

  // --- Tracking ----------------------------------------------------------
  return (
    <Section className={className}>
      <div className="flex items-center justify-between gap-3">
        <SectionHeader detail={lastCheckedText(tracking)} />
        <button
          type="button"
          onClick={handleDisable}
          disabled={busy}
          className={cn(textButtonClass, "shrink-0 whitespace-nowrap")}
        >
          Turn off
        </button>
      </div>

      {history.isPending ? (
        <div className="h-[150px] animate-pulse rounded-xl bg-muted/40" />
      ) : history.isError && !history.data ? (
        <Notice tone="error">
          Couldn't load the history.{" "}
          <button
            type="button"
            className="underline underline-offset-2"
            onClick={() => history.refetch()}
          >
            Retry
          </button>
        </Notice>
      ) : (
        <PriceHistoryChart
          points={history.data?.points ?? []}
          currentPriceCents={item.price_cents}
        />
      )}

      <PriceStats tracking={tracking} currentPriceCents={item.price_cents} />

      {status && !notice && <Status status={status} onFixLink={onFixLink} />}
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}

      <ActionRow>
        <ActionButton onClick={handleCheck} disabled={busy}>
          {check.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="h-3 w-3" aria-hidden />
          )}
          Check now
        </ActionButton>
        {canRestart && (
          <RestartButton
            addedPriceCents={addedPrice}
            onRestart={handleRestart}
            disabled={busy}
          />
        )}
      </ActionRow>
    </Section>
  )
}

// -----------------------------------------------------------------------------
// Pieces
// -----------------------------------------------------------------------------

/** The status to show, if the last check couldn't be trusted. */
function failureStatus(
  item: WishlistedItemPublic,
  tracking: PriceTrackingPublic | null | undefined,
): (typeof STATUS)[PriceCheckFailureReason] | null {
  if (!item.product_url) return STATUS.no_link
  if (!tracking) return null
  const failing = (tracking.consecutive_failures ?? 0) > 0 || tracking.paused
  if (!failing || tracking.disabled_by_user) return null
  return STATUS[tracking.last_error_reason ?? "unreachable"]
}

function Section({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("space-y-3 border-t border-border/40 pt-4", className)}>
      {children}
    </div>
  )
}

function SectionHeader({ detail }: { detail?: string | null }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <p className={cn(labelClass, "min-w-0 truncate")}>
        Price tracking
        {detail && (
          <span className="text-muted-foreground/50"> · {detail}</span>
        )}
      </p>
      <Hint label="How price tracking works">{HOW_IT_WORKS}</Hint>
    </div>
  )
}

/** A word or two of state, with the explanation a tap away. */
function Status({
  status,
  onFixLink,
}: {
  status: (typeof STATUS)[PriceCheckFailureReason]
  onFixLink?: () => void
}) {
  return (
    <output className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="inline-flex items-center gap-1.5 text-xs text-price-rise">
        <status.icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {status.label}
      </span>
      <Hint label={`About "${status.label}"`}>{status.hint}</Hint>
      {status.needsLink && onFixLink && (
        <button type="button" onClick={onFixLink} className={textButtonClass}>
          Update link
        </button>
      )}
    </output>
  )
}

/**
 * Takes an item back to the price it was added at and forgets the readings.
 *
 * Deliberately not part of "Turn off": that is a preference and changes no
 * data, while this throws readings away, so it asks first.
 */
function RestartButton({
  addedPriceCents,
  onRestart,
  disabled,
}: {
  addedPriceCents: number
  onRestart: () => void
  disabled?: boolean
}) {
  const [armed, setArmed] = useState(false)

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (armed) {
            setArmed(false)
            onRestart()
          } else {
            setArmed(true)
          }
        }}
        onBlur={() => setArmed(false)}
        className={cn(textButtonClass, armed && "text-foreground")}
      >
        {armed ? "Sure?" : "Start over"}
      </button>
      <Hint label="What starting over does">
        Forgets every reading and puts the price back to the{" "}
        {formatCents(addedPriceCents)} it was added at. The next check starts a
        clean record.
      </Hint>
    </span>
  )
}

function ActionRow({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-3">{children}</div>
}

function ActionButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5",
        "text-[10px] font-medium uppercase tracking-[0.15em] text-foreground",
        "transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50",
      )}
    >
      {children}
    </button>
  )
}

function Notice({
  tone,
  children,
}: {
  tone: "info" | "success" | "error"
  children: React.ReactNode
}) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "text-xs leading-relaxed",
        tone === "error" && "text-price-rise",
        tone === "info" && "text-muted-foreground/70",
        tone === "success" && "text-foreground",
      )}
    >
      {children}
    </p>
  )
}

function PriceStats({
  tracking,
  currentPriceCents,
}: {
  tracking: PriceTrackingPublic | null | undefined
  currentPriceCents: number
}) {
  if (!tracking) return null
  const original = tracking.original_price_cents
  const lowest = tracking.lowest_price_cents

  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {original != null && original !== currentPriceCents && (
        <span className="inline-flex items-baseline gap-1.5">
          Added{" "}
          <span className="tabular-nums text-foreground">
            {formatCents(original)}
          </span>
          <PriceChangeChip
            tracking={tracking}
            currentPriceCents={currentPriceCents}
          />
        </span>
      )}
      {lowest != null && lowest < currentPriceCents && (
        <span>
          Lowest{" "}
          <span className="tabular-nums text-foreground">
            {formatCents(lowest)}
          </span>
        </span>
      )}
    </div>
  )
}

function lastCheckedText(
  tracking: PriceTrackingPublic | null | undefined,
): string | null {
  if (!tracking?.last_checked_at) return null
  const date = new Date(tracking.last_checked_at)
  if (Number.isNaN(date.getTime())) return null
  return formatRelativeShort(date)
}
