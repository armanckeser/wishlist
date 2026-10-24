#!/usr/bin/env bash

set -e
set -x

# Run prestart tasks (DB wait, migrations, initial data)
bash scripts/prestart.sh

# The keys a self-hosted install generates for itself (app/boot.py), shared by every process below.
set +x
eval "$(python -m app.boot)"
set -x

# Start the scheduler worker in background
python -m app.scheduler_worker &
SCHEDULER_PID=$!
echo "Started scheduler worker (PID: $SCHEDULER_PID)"

# Trap to ensure scheduler is stopped when script exits
cleanup() {
    echo "Stopping scheduler worker..."
    kill $SCHEDULER_PID 2>/dev/null || true
    wait $SCHEDULER_PID 2>/dev/null || true
}
trap cleanup EXIT

# Start the FastAPI server (foreground)
exec fastapi run --workers 2 --port "${PORT:-8000}" app/main.py
