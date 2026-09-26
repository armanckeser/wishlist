# PR Patterns

Consistent PR creation for parallel implementation tasks.

## Standard PR Structure

```markdown
## Summary
<1-3 bullet points describing WHAT changed and WHY>

## Changes
- `file1.ts`: Added X functionality
- `file2.tsx`: Updated Y component

## Test Plan
- [ ] Unit tests pass
- [ ] Lint passes
- [ ] [Specific manual test steps]

## Screenshots
<!-- For UI changes, include before/after or just after -->
![feature](screenshots/task-{id}-feature.png)

---
🤖 Generated with Claude Code
```

## Creating PRs via CLI

```bash
gh pr create \
  --title "feat: [description]" \
  --body "$(cat <<'EOF'
## Summary
- [What changed]

## Test Plan
- [ ] Tests pass
- [ ] Lint passes

🤖 Generated with Claude Code
EOF
)"
```

## PR Title Conventions

Follow conventional commits:

| Prefix | Use When |
|--------|----------|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `refactor:` | Code restructure, no behavior change |
| `style:` | Formatting, whitespace |
| `test:` | Adding/updating tests |
| `docs:` | Documentation only |
| `chore:` | Build, config, dependencies |

Examples:
- `feat: add user authentication`
- `fix: resolve race condition in data fetching`
- `refactor: extract validation logic to separate module`

## Linking to Backlog Tasks

Reference the backlog task ID in PR body:

```markdown
## Summary
Implements task-{id}: [task title]

[description]
```

## Screenshot Integration

For UI tasks, include screenshot in PR:

```bash
# Take screenshot first
npx tsx scripts/screenshot.ts http://localhost:5173 screenshots/task-{id}.png

# Reference in PR body
gh pr create --body "...
## Screenshots
![feature](screenshots/task-{id}.png)
..."
```

## Squash Merge Commits

When squash merging, the commit message should be clean:

```bash
gh pr merge {number} --squash --delete-branch

# Or manually:
git checkout main
git merge --squash feature/task-{id}
git commit -m "feat: [description] (#PR)"
```

## Multi-Task Release PR

For releasing multiple tasks at once (if not merging individually):

```markdown
## Summary
Release v1.X.0 with the following changes:

### Features
- **Task 1**: [description]
- **Task 2**: [description]

### Fixes
- **Task 3**: [description]

## Test Plan
- [ ] All task branches validated individually
- [ ] Integration test on combined changes
- [ ] Smoke test on staging

## Individual PRs
- #11 (task-1)
- #12 (task-2)
- #13 (task-3)
```

## PR Review Checklist (Self-Review)

Before creating PR, verify:

- [ ] Branch is up to date with main
- [ ] All tests pass
- [ ] Lint passes
- [ ] No console.logs or debug code
- [ ] No commented-out code
- [ ] Commit messages are clean
- [ ] PR title follows convention
- [ ] Screenshots included (if UI change)
