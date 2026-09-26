import { getCategoryColor } from "@/components/Categories/CategoryBadge"

import { useWishlistItem } from "../../context"
import { MostDesiredBadge } from "../../primitives/MostDesiredBadge"
import { Price } from "../../primitives/Price"

/**
 * Item details section: brand, title, price, categories, description.
 * Brand text is clickable and opens product URL if available.
 */
export function Details() {
  const { item, brand } = useWishlistItem()

  const handleBrandClick = () => {
    if (item.product_url) {
      window.open(item.product_url, "_blank", "noopener,noreferrer")
    }
  }

  return (
    <div className="mt-6 space-y-4">
      {/* Brand and Most Desired badge */}
      <div className="flex items-center justify-between">
        {brand ? (
          <button
            type="button"
            onClick={handleBrandClick}
            disabled={!item.product_url}
            className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground disabled:cursor-default disabled:hover:text-muted-foreground"
          >
            {brand}
          </button>
        ) : (
          <span />
        )}
        <MostDesiredBadge />
      </div>

      {/* Title */}
      <h2 className="font-display text-2xl font-light leading-tight text-foreground">
        {item.title}
      </h2>

      {/* Price - uses Price primitive which handles actual_price_paid_cents */}
      <Price size="xl" />

      {/* Categories */}
      {item.categories && item.categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {item.categories.map((category) => (
            <span
              key={category.id}
              className="inline-flex items-center gap-1.5 font-display text-sm font-light text-muted-foreground"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: getCategoryColor(category.name) }}
              />
              {category.name}
            </span>
          ))}
        </div>
      )}

      {/* Description */}
      {item.description && (
        <p className="text-sm leading-relaxed text-muted-foreground">
          {item.description}
        </p>
      )}
    </div>
  )
}
