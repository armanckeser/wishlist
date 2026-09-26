import { Link as RouterLink, useRouterState } from "@tanstack/react-router"
import {
  Archive,
  Heart,
  LogOut,
  Menu,
  Package,
  Settings,
  Share2,
  ShoppingBag,
  Sparkles,
  Users,
} from "lucide-react"
import { useState } from "react"

import { Logo } from "@/components/Common/Logo"
import { useTheme } from "@/components/theme-provider"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { PageDefault } from "@/components/Wishlist/filtering/registry"
import useAuth from "@/hooks/useAuth"
import { getInitials } from "@/utils"

interface NavItem {
  icon: React.ComponentType<{ className?: string }>
  title: string
  path: string
  search?: { default: PageDefault }
}

const navItems: NavItem[] = [
  {
    icon: Heart,
    title: "Wishlist",
    path: "/",
    search: { default: "wishlist" },
  },
  {
    icon: ShoppingBag,
    title: "Purchases",
    path: "/",
    search: { default: "purchased" },
  },
  { icon: Package, title: "Tracking", path: "/tracking" },
  {
    icon: Archive,
    title: "Archive",
    path: "/",
    search: { default: "archived" },
  },
  { icon: Share2, title: "Sharing", path: "/sharing" },
]

const adminItem: NavItem = { icon: Users, title: "Admin", path: "/admin" }

interface MobileNavProps {
  onWhatsNewClick?: () => void
}

function isNavItemActive(
  item: NavItem,
  currentPath: string,
  currentSearch: { default?: PageDefault },
): boolean {
  // For items with search params, match both path pattern and default param
  if (item.search?.default) {
    // Path is "/" which redirects to "/$userId", so check if we're on a user wishlist page
    const isWishlistPage = currentPath === "/" || /^\/[^/]+$/.test(currentPath)
    return isWishlistPage && currentSearch.default === item.search.default
  }
  // For items without search params, exact path match
  return currentPath === item.path
}

export function MobileNav({ onWhatsNewClick }: MobileNavProps) {
  const [open, setOpen] = useState(false)
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const router = useRouterState()
  const currentPath = router.location.pathname
  const currentSearch = router.location.search as { default?: PageDefault }

  const items = user?.is_superuser ? [...navItems, adminItem] : navItems

  const handleNavClick = () => {
    setOpen(false)
  }

  const handleLogout = () => {
    setOpen(false)
    logout()
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="-ml-2"
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </Button>
      </DrawerTrigger>
      <DrawerContent
        className="max-h-[85dvh] pb-8"
        aria-describedby={undefined}
      >
        <DrawerHeader className="pb-2">
          <DrawerTitle className="flex items-center justify-center">
            <Logo variant="full" asLink={false} />
          </DrawerTitle>
        </DrawerHeader>

        {/* Navigation Links */}
        <nav className="flex flex-col gap-1 px-2">
          {items.map((item) => {
            const isActive = isNavItemActive(item, currentPath, currentSearch)
            return (
              <RouterLink
                key={item.title}
                to={item.path}
                search={item.search}
                onClick={handleNavClick}
                className={`flex items-center gap-3 rounded-lg px-4 py-3 text-base transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                }`}
              >
                <item.icon className="size-5" />
                <span>{item.title}</span>
              </RouterLink>
            )
          })}
        </nav>

        {/* Divider */}
        <div className="my-4 border-t" />

        {/* Appearance & What's New */}
        <div className="flex gap-2 px-6">
          <Select value={theme} onValueChange={setTheme}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Appearance" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
          {onWhatsNewClick && (
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setOpen(false)
                onWhatsNewClick()
              }}
            >
              <Sparkles className="mr-2 size-4" />
              What's New
            </Button>
          )}
        </div>

        {/* Divider */}
        <div className="my-4 border-t" />

        {/* User Section */}
        {user && (
          <div className="px-2">
            <div className="flex items-center gap-3 px-4 pb-4">
              <Avatar className="size-10">
                <AvatarFallback className="bg-zinc-600 text-white">
                  {getInitials(user.full_name || "User")}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0">
                <p className="font-medium truncate">{user.full_name}</p>
                <p className="text-sm text-muted-foreground truncate">
                  {user.email}
                </p>
              </div>
            </div>
            <div className="flex gap-2 px-4">
              <RouterLink
                to="/settings"
                onClick={handleNavClick}
                className="flex-1"
              >
                <Button variant="outline" className="w-full">
                  <Settings className="mr-2 size-4" />
                  Settings
                </Button>
              </RouterLink>
              <Button
                variant="outline"
                onClick={handleLogout}
                className="flex-1"
              >
                <LogOut className="mr-2 size-4" />
                Log Out
              </Button>
            </div>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  )
}
