#!/usr/bin/env bash

set -e
set -x

# Run prestart tasks (DB wait, migrations, initial data)
bash scripts/prestart.sh

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
exec fastapi run --workers 2 app/main.py
