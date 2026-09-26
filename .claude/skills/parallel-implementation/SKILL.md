---
name: parallel-implementation
description: |
  Orchestrate parallel implementation of multiple features/tasks using subagents. Use when:
  (1) User describes multiple features or a complex feature that decomposes into independent tasks
  (2) User provides a list of things to implement
  (3) Tasks can be worked on in parallel or as a dependency stack
  (4) You need to coordinate multiple agents working on different parts of the codebase

  Workflow: decompose → create backlog tasks → spawn subagents → validate → merge → release.
  Each subagent works on a feature branch and must validate their work (tests, screenshots for UI).
---

# Parallel Implementation

Orchestrate multiple subagents to implement features in parallel, with validation and clean merges.

## Workflow Overview

```
User describes features
        ↓
┌─────────────────────────────────┐
│ 1. DECOMPOSE                    │
│    Break into independent tasks │
│    Create backlog tasks         │
└─────────────────────────────────┘
        ↓
┌─────────────────────────────────┐
│ 2. ANALYZE DEPENDENCIES         │
│    Identify task relationships  │
│    Plan execution order         │
└─────────────────────────────────┘
        ↓
┌─────────────────────────────────┐
│ 3. IMPLEMENT (parallel)         │
│    Create feature branches      │
│    Spawn subagents per task     │
│    Each validates own work      │
└─────────────────────────────────┘
        ↓
┌─────────────────────────────────┐
│ 4. MERGE & RELEASE              │
│    Squash merge in order        │
│    Create GitHub release        │
└─────────────────────────────────┘
```

## Phase 1: Decompose

Break user requirements into atomic, independently-implementable tasks.

**Good task characteristics:**
- Single responsibility (one feature, one fix, one refactor)
- Clear acceptance criteria
- Testable/verifiable outcome
- Minimal overlap with other tasks

**Create backlog tasks** using `mcp__backlog__task_create` with:
- Clear title (imperative: "Add X", "Fix Y", "Update Z")
- Description with context and approach
- Acceptance criteria (checkable items)
- Labels for categorization

```
Example decomposition:
"Add user authentication with social login"
  → task-1: Add JWT authentication middleware
  → task-2: Add Google OAuth integration
  → task-3: Add GitHub OAuth integration
  → task-4: Add login/logout UI components
```

## Phase 2: Analyze Dependencies

Determine if tasks are:

**Independent** - Can run fully in parallel
```
task-1: Update header styling
task-2: Fix footer links
task-3: Add contact form
→ All independent, spawn all agents simultaneously
```

**Stacked** - Each depends on previous
```
task-1: Add base authentication →
task-2: Add OAuth providers (needs task-1) →
task-3: Add protected routes (needs task-2)
→ Implement sequentially OR use stacked branches
```

**Mixed** - Some parallel, some dependent
```
task-1: Add auth base ─────────┬─→ task-3: Add protected routes
task-2: Add user settings ─────┘
→ task-1 and task-2 parallel, task-3 waits for both
```

## Phase 3: Implement

### Branch Strategy

Create feature branches for each task:
```bash
git checkout -b feature/task-{id}-{short-name}
```

For stacked dependencies, branch from previous task's branch (not main).

### Spawning Subagents

Use Task tool with clear prompts:

```
Task: Implement [task title]

Context:
- Working directory: [path]
- Branch: feature/task-{id}-{name}
- Base: [main or previous task branch]

Requirements:
[paste acceptance criteria from backlog task]

Validation required:
- [ ] All existing tests pass
- [ ] New tests added for new functionality
- [ ] [For UI] Screenshot captured showing the change
- [ ] Lint passes

When complete:
- Commit with message: "feat: [description]"
- Push branch
- Report: files changed, tests added, validation results
```

### Validation Requirements

**All tasks must validate before completion.** See [references/validation.md](references/validation.md) for patterns.

Minimum validation:
1. Run existing test suite - must pass
2. Run linter - must pass
3. For new functionality - add tests

For UI changes:
4. Capture screenshot with Playwright (see validation.md)

### Parallel Execution

For independent tasks, spawn multiple agents in a single message:
```
[Task tool call for task-1]
[Task tool call for task-2]
[Task tool call for task-3]
```

Monitor progress via task output files. Handle failures individually.

## Phase 4: Merge & Release

### Merge Order

1. **Independent tasks**: Merge in any order
2. **Stacked tasks**: Merge base → dependent (rebase if needed)

### Merge Process

For each completed task:
```bash
git checkout main
git pull
git merge --squash feature/task-{id}-{name}
git commit -m "feat: [description] (#PR)"
git push
```

Or use `gh pr merge --squash --delete-branch`.

If conflicts arise from stacked branches:
```bash
# Rebase dependent branch onto updated main
git checkout feature/task-{id}-dependent
git rebase main
git push --force-with-lease
```

### Create Release

After all tasks merged:
```bash
gh release create v{version} --title "v{version} - {summary}" --notes "
## What's New

### Features
- [list features from merged tasks]

### Fixes
- [list fixes]
"
```

## Quick Reference

| Phase | Key Actions |
|-------|-------------|
| Decompose | Break into tasks, create backlog items |
| Analyze | Map dependencies, plan order |
| Implement | Branch, spawn agents, validate |
| Merge | Squash merge, handle conflicts, release |

## When NOT to Use

- Single simple task (just implement directly)
- Tightly coupled changes that can't be separated
- Exploratory work where scope is unclear

## Resources

### Scripts

- **[scripts/screenshot.ts](scripts/screenshot.ts)** - Playwright helper for UI screenshots
  ```bash
  npx tsx scripts/screenshot.ts http://localhost:5173/debug screenshots/feature.png
  npx tsx scripts/screenshot.ts http://localhost:5173 card.png "[data-testid='card']"
  ```

### References

| File | Use When |
|------|----------|
| [validation.md](references/validation.md) | Setting up test/lint/screenshot validation |
| [worktrees.md](references/worktrees.md) | Tasks need parallel filesystem access (dev servers, etc.) |
| [pr-patterns.md](references/pr-patterns.md) | Creating consistent PRs |
| [failure-handling.md](references/failure-handling.md) | Task fails, conflicts arise, need rollback |

### Project Pattern: Debug Page

This project has a `/debug` route (`frontend/src/routes/debug.tsx`) that serves as a visual sandbox for testing components. Use this pattern for:
- Quick visual validation without full app navigation
- Screenshot targets for specific components
- Testing component states in isolation
