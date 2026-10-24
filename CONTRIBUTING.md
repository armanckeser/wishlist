# Contributing to Wishlist

The backend is FastAPI with SQLModel and the frontend is React with TanStack Router. The
project started from the FastAPI full-stack template, so [development.md](development.md)
and [deployment.md](deployment.md) cover the stack, the `.env` file, and deployment in
detail.

## Development

### Prerequisites

- Docker and Docker Compose
- Node.js 20+
- Python 3.12+ with [uv](https://github.com/astral-sh/uv)

### Quick Start

```bash
# Start the full stack
docker compose watch
```

This starts:
- Frontend at [localhost:5173](http://localhost:5173)
- Backend API at [localhost:8000](http://localhost:8000)
- PostgreSQL database
- Mailcatcher for email testing

### Manual Setup

```bash
# Backend
cd backend
uv sync
uv run alembic upgrade head
uv run fastapi dev app/main.py

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

### Commands

```bash
# Backend
uv run pytest                    # Run tests
uv run ruff check --fix .        # Lint
uv run ty check                  # Type check

# Frontend
npm run build                    # Build for production
npm run lint                     # Lint with Biome
npm run generate-client          # Regenerate API client

# Database
uv run alembic revision --autogenerate -m "description"
uv run alembic upgrade head
```

### Self-Hosting

```bash
docker compose -f docker-compose.selfhost.yml up -d
```

This starts the production stack with the frontend on [localhost:8080](http://localhost:8080). It reads the same `.env` file. [deployment.md](deployment.md) covers a full server deployment.

---

## Architecture

```
wishlist/
├── backend/                 # FastAPI + SQLModel
│   ├── app/
│   │   ├── features/        # Domain modules (budget, wishlist, users)
│   │   ├── core/            # Config, security, database
│   │   └── alembic/         # Database migrations
│   └── tests/
├── frontend/                # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/      # UI components
│   │   ├── routes/          # TanStack Router pages
│   │   ├── client/          # Auto-generated API client
│   │   └── hooks/           # Custom React hooks
│   └── public/
└── docker-compose.yml
```

**Backend:** FastAPI with SQLModel ORM. Feature-based structure where each domain (budget, wishlist items, users) has its own models, service, and router.

**Frontend:** React 19 with TanStack Router and Query. UI built with Tailwind CSS and shadcn/ui. Mobile-first, installable as a PWA.

**URL Parsing:** Extracts product metadata from any shopping site using OpenGraph, JSON-LD, and microdata. Includes anti-bot bypass for sites with aggressive protection.

---

## Tech Stack

| Layer      | Technology                                       |
|------------|--------------------------------------------------|
| Frontend   | React, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| Routing    | TanStack Router (file-based)                     |
| State      | TanStack Query                                   |
| Backend    | FastAPI, SQLModel, Pydantic                      |
| Database   | PostgreSQL                                       |
| Auth       | JWT tokens                                       |
| Deployment | Docker Compose, Tailscale                        |
