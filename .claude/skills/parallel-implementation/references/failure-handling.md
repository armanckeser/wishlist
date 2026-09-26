# Failure Handling & Rollback

Strategies for handling failures during parallel implementation.

## Types of Failures

### 1. Validation Failure (Single Task)

Task completes but validation fails (tests, lint, types).

**Response:**
- Do NOT merge the failing task
- Either fix in the same branch or abandon
- Other tasks can proceed independently

```
Task 3 validation failed:
- tests: 2 failing
- Action: Fix tests or skip this task in release
- Other tasks: Continue normally
```

### 2. Implementation Blocker

Task cannot be completed due to missing dependency or unclear requirements.

**Response:**
- Mark task as blocked in backlog
- Document what's needed
- Continue with other tasks
- Revisit after getting clarity

```bash
# Update backlog task
mcp__backlog__task_edit --id task-{id} --status "blocked" \
  --notesAppend "Blocked: Need API endpoint for X"
```

### 3. Merge Conflict

Parallel tasks modify same files, causing conflicts on merge.

**Response:**
- Merge the simpler/smaller change first
- Rebase the other branch
- Resolve conflicts in the rebased branch

```bash
# After merging task-1
git checkout feature/task-2
git rebase main
# Resolve conflicts
git add .
git rebase --continue
git push --force-with-lease
```

### 4. Cascading Failure (Stacked Tasks)

Base task fails, blocking dependent tasks.

**Response:**
- Stop dependent tasks immediately
- Fix or abandon base task
- If abandoned: rebase dependents onto main (losing base changes)

```bash
# If task-1 is abandoned, rebase task-2 onto main
git checkout feature/task-2
git rebase --onto main feature/task-1
```

## Rollback Strategies

### Rollback Single Commit

If a merged task causes issues:

```bash
git revert <commit-hash>
git push
```

### Rollback Multiple Commits

If several tasks need rollback:

```bash
# Revert in reverse order (newest first)
git revert <newest-commit>
git revert <older-commit>
git push
```

### Hard Reset (Nuclear Option)

If main is badly broken and you need to go back:

```bash
# Find last good commit
git log --oneline

# Reset (WARNING: destructive)
git reset --hard <good-commit>
git push --force-with-lease
```

**Only use if:** No other collaborators have pulled the bad commits.

## Partial Release

If some tasks succeed and others fail:

1. Merge only successful tasks
2. Create release with completed features
3. Document incomplete tasks for next iteration

```bash
# Release what's done
gh release create v1.2.0 --notes "
## Features
- Task 1: ✅ Added auth
- Task 2: ✅ Added settings

## Deferred
- Task 3: Blocked (needs API update)
"
```

## Prevention Strategies

### 1. File Ownership Analysis

Before parallel execution, check for overlapping files:

```bash
# See which files each task's branch modifies
git diff --name-only main..feature/task-1
git diff --name-only main..feature/task-2

# If overlap detected → make tasks sequential, not parallel
```

### 2. Smaller Tasks

Smaller tasks = less overlap = fewer conflicts

### 3. Feature Flags

For risky changes, implement behind flags:

```typescript
if (featureFlags.newAuth) {
  // New implementation
} else {
  // Old implementation
}
```

Allows merging without full activation. Rollback = flip flag.

## Failure Checklist

When a task fails:

- [ ] Identify failure type (validation/blocker/conflict/cascade)
- [ ] Assess impact on other tasks
- [ ] Decide: fix, defer, or abandon
- [ ] Update backlog task status
- [ ] Communicate status (if working with human)
- [ ] Continue with unaffected tasks
