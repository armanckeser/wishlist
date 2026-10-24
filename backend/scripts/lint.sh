#!/usr/bin/env bash

set -e
set -x

ty check app
ruff check app
ruff format app --check
