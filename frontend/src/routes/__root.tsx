import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { createRootRoute, HeadContent, Outlet } from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"
import ErrorComponent from "@/components/Common/ErrorComponent"
import NotFound from "@/components/Common/NotFound"

// The devtools buttons sit in the bottom corners, over the add-item button. Leave them out when a test
// drives the browser (Playwright sets navigator.webdriver); both render nothing in production builds.
const showDevtools = typeof navigator === "undefined" || !navigator.webdriver

export const Route = createRootRoute({
  component: () => (
    <>
      <HeadContent />
      <Outlet />
      {showDevtools && (
        <>
          <TanStackRouterDevtools position="bottom-right" />
          <ReactQueryDevtools initialIsOpen={false} />
        </>
      )}
    </>
  ),
  notFoundComponent: () => <NotFound />,
  errorComponent: () => <ErrorComponent />,
})
