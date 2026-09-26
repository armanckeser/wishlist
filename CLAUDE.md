# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Wishlist** - A mobile-first wishlist and budget management app. The core idea: visualize a continuously growing budget (based on monthly allocation), add products via URL, and "buy" items which deducts from the budget. Includes behavioral incentives to encourage delayed gratification.

Built with FastAPI backend and React frontend. Uses Docker Compose for local development. Self-hosted via Tailscale.

## Domain Concepts

### Budget System
- Budget increases in real-time based on a configurable monthly rate (e.g., $600/month → calculated per-second rate)
- Budget is **stored in DB** (not just calculated) because:
  - Rate can change arbitrarily
  - Purchases deduct from budget
  - Freeze penalties stop accumulation
- When user buys an item wishlisted **less than 1 week ago**, budget freezes (counter stops) for 1 week
- When user buys an item wishlisted **1+ month ago**, no penalty (encouraged behavior)

### Wishlist Items
- Added via URL → auto-populate product name, image, price, website
- URL parsing uses `extruct` library (extracts OpenGraph, JSON-LD, microdata)
- Target sites: fashion/beauty/jewelry (Mejuri, Ferko's, Net-a-Porter, Reformation, Sephora, Blue Mercury)
- Manual entry fallback for sites that don't parse well
- Items can be ranked and grouped
- Automatic price tracking (`features/price_tracking/`): tracking is opt-out, not opt-in -
  any wishlisted item with a product link is checked daily by the scheduler worker, no
  button required; a successful check is what proves a page is readable and turns tracking
  on for it. Each reading is a `PricePoint`, the item's price follows the store, and
  drops/rises send notifications. The graph starts at the price the item was added at,
  not at the first check (`get_price_history` prepends that point).
- A price is only written to an item when the page it came from is still that
  product (`price_tracking/verification.py`): links rot into category listings,
  homepages and replacement products while still answering 200, and extraction
  will happily read the first price it finds there. A fetch reports the URL it
  landed on (`ProductMetadata.final_url`), and a reading is rejected when the
  link moved somewhere else or the page's title no longer matches the item, the
  last verified page title (`price_verified_title`) or the URL slug. Rejections
  are failures with a `PriceCheckFailureReason`, stored on the item as
  `price_check_reason` - the UI turns it into a one- or two-word status
  ("Link moved") plus an Update link affordance, never a wrong price.
- Recovery is automatic where it can be. Every reading carries `verified`;
  rows written before identity checking existed are false, and the first
  verified reading drops them and rebuilds the summary, so a graph is never
  a mix of prices we can vouch for and prices we can't. The summary columns
  (`lowest_price_cents`, `previous_price_cents`, `price_changed_at`) are
  *derived* from the series by `summarize_history`, never accumulated - a
  running minimum can never recover from one bad reading. Changing an item's
  link keeps `original_price_cents`: what it was added at belongs to the
  item, not to whichever link was on it. The one manual escape hatch is
  `restart_tracking` ("Start over"), which forgets every reading and takes
  the price back to the added one; turning tracking off is a preference and
  changes no data.
- Other guardrails: implausible prices are rejected, and after 3 consecutive failures
  tracking pauses and the owner is notified to retry (same UI path whether the page was
  never readable or stopped being readable). Owners can still turn tracking off per item
  (`price_tracking_disabled_by_user`), which the scheduler respects. The scheduler
  batches same-day checks by store domain so requests to one site stay serialized
  (avoiding scrape-burst patterns) while different stores run concurrently. Settings:
  `PRICE_TRACKING_ENABLED`, `SCHEDULER_PRICE_CHECK_MINUTES`, `PRICE_CHECK_BATCH_SIZE`.

### URL Parsing Anti-Bot Strategy
Sites use various anti-bot protections. Our fallback chain:
1. **httpx** (standard) → Works for most sites (Mejuri, The Row)
2. **curl_cffi** (TLS spoofing) → Bypasses Akamai fingerprinting (Sephora, Net-a-Porter)
3. **FlareSolverr** (real browser) → Solves JavaScript challenges (some Net-a-Porter URLs)

Add sites to `SITES_REQUIRING_IMPERSONATION` in `url_parser/service.py` when curl_cffi is needed.

### Purchase Flow
- Mark item as "bought" → moves to bought list, price deducted from budget
- Check wishlist age → apply freeze penalty if < 1 week old

## Collaboration Guidelines

**This is an iterative, agile project. Key principles:**
- ASK before assuming - clarify requirements before implementing
- No big upfront design - build incrementally, validate assumptions
- Pivot-ready architecture - keep things simple and changeable
- Shape Up methodology - bets with appetite, not estimates

**When uncertain:**
1. Ask the user a clarifying question
2. Propose options with trade-offs
3. Build the simplest thing that could work
4. Get feedback before expanding

## Essential Commands

### Development
```bash
# Start the full stack with Docker (recommended)
docker compose watch

# Start only backend (native)
cd backend && fastapi dev app/main.py

# Start only frontend (native)
cd frontend && npm run dev
```

### Backend (from backend/)
```bash
uv sync                                    # Install dependencies
uv run pytest                              # Run tests
uv run pytest tests/path/test_file.py -k test_name  # Run single test
uv run ruff check --fix .                  # Lint
uv run ruff format .                       # Format
uv run ty check                            # Type check
```

### Frontend (from frontend/)
```bash
npm install                                # Install dependencies
npm run dev                                # Dev server
npm run build                              # Build
npm run lint                               # Lint (Biome)
npx playwright test                        # E2E tests
npm run generate-client                    # Regenerate API client from OpenAPI
```

### Database Migrations
```bash
# Generate new migration (after changing models)
uv run alembic revision --autogenerate -m "Description"

# Apply all pending migrations
uv run alembic upgrade head

# Check current migration version
docker compose exec backend alembic current

# View migration history
docker compose exec backend alembic history
```

**Important**: After adding/changing SQLModel models, always generate and apply migrations before testing frontend.

### Pre-commit
```bash
uv run pre-commit install                  # Setup hooks
uv run pre-commit run --all-files          # Run manually
```

### Regenerate Frontend API Client
```bash
./scripts/generate-client.sh               # From project root with backend running
```

## Architecture

### Backend (backend/)
- **FastAPI** application with SQLModel ORM and PostgreSQL
- **Feature-based structure** - each domain has its own folder with models, service, router
- `app/main.py` - Application entrypoint
- `app/features/` - Feature modules:
  - `budget/` - Budget models, service, router
  - `users/` - User models, service, router
  - `wishlist_item/` - WishlistItem models, service, router
  - `auth/` - Authentication service, router
- `app/shared/` - Shared models (Message, Token, etc.)
- `app/api/deps.py` - Dependency injection (auth, DB sessions)
- `app/core/` - Config, security, database setup
- `app/alembic/` - Database migrations

### Frontend (frontend/)
- **React 19** + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **TanStack Router** for file-based routing (routes/ directory)
- **TanStack Query** for server state
- `src/client/` - Auto-generated OpenAPI client (do not edit manually)
- `src/components/ui/` - shadcn/ui components (do not edit manually)
- `src/components/` - App components (Admin, Items, UserSettings, Sidebar, Common)
- `src/routes/` - Page routes (TanStack Router file-based routing)
- `src/hooks/` - Custom React hooks

### Key Patterns
- Models follow Base → Create/Update → DB Table → Public response pattern
- Frontend client auto-generated from backend OpenAPI schema
- JWT authentication with access tokens
- Docker Compose orchestrates all services

## Development URLs
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs (Swagger): http://localhost:8000/docs
- Adminer (DB): http://localhost:8080
- Mailcatcher: http://localhost:1080

## Code Style

### Backend
- Python 3.10+, strict mypy, ruff for linting/formatting
- SQLModel for both ORM and Pydantic validation

### Frontend
- TypeScript with Biome for linting/formatting
- Double quotes, semicolons as needed, 2-space indent
- Components in PascalCase, hooks prefixed with `use`

<!-- BACKLOG.MD MCP GUIDELINES START -->

<CRITICAL_INSTRUCTION>

## BACKLOG WORKFLOW INSTRUCTIONS

This project uses Backlog.md MCP for all task and project management activities.

**CRITICAL GUIDANCE**

- If your client supports MCP resources, read `backlog://workflow/overview` to understand when and how to use Backlog for this project.
- If your client only supports tools or the above request fails, call `backlog.get_workflow_overview()` tool to load the tool-oriented overview (it lists the matching guide tools).

- **First time working here?** Read the overview resource IMMEDIATELY to learn the workflow
- **Already familiar?** You should have the overview cached ("## Backlog.md Overview (MCP)")
- **When to read it**: BEFORE creating tasks, or when you're unsure whether to track work

These guides cover:
- Decision framework for when to create tasks
- Search-first workflow to avoid duplicates
- Links to detailed guides for task creation, execution, and completion
- MCP tools reference

You MUST read the overview resource to understand the complete workflow. The information is NOT summarized here.

</CRITICAL_INSTRUCTION>

<!-- BACKLOG.MD MCP GUIDELINES END -->
