# Git Worktree Patterns

Use worktrees when subagents need **truly parallel filesystem access** - e.g., running dev servers simultaneously or avoiding file lock conflicts.

## When to Use Worktrees

**Use worktrees when:**
- Multiple agents need to run dev servers on different ports
- Agents modify the same files in incompatible ways during development
- You need to test branches side-by-side
- Build artifacts would conflict between branches

**Skip worktrees when:**
- Tasks modify different files (just use branches)
- Only one agent runs at a time
- Changes are small and quick

## Creating Worktrees

```bash
# Create worktree for a task
git worktree add ../project-task-{id} -b feature/task-{id}-{name}

# Or from existing branch
git worktree add ../project-task-{id} feature/task-{id}-{name}
```

**Naming convention:** `{project}-task-{id}` in parent directory

## Managing Multiple Worktrees

```bash
# List all worktrees
git worktree list

# Example output:
# /Users/dev/project           abc1234 [main]
# /Users/dev/project-task-1    def5678 [feature/task-1-auth]
# /Users/dev/project-task-2    ghi9012 [feature/task-2-ui]
```

## Subagent Prompt for Worktree Tasks

```
Task: Implement [task title]

Context:
- Working directory: /path/to/project-task-{id}  # ← worktree path
- Branch: feature/task-{id}-{name}
- Dev server port: 517{id}  # e.g., 5171, 5172, etc.

[rest of prompt...]
```

## Cleanup After Merge

Remove worktrees after merging:
```bash
git worktree remove ../project-task-{id}
# or force if dirty:
git worktree remove ../project-task-{id} --force
```

**Batch cleanup:**
```bash
# Remove all task worktrees
for dir in ../project-task-*; do
  git worktree remove "$dir" --force 2>/dev/null
done
git worktree prune
```

## Stacked Worktrees (Dependencies)

For stacked tasks, worktrees can branch from each other:

```bash
# Task 1 (base)
git worktree add ../project-task-1 -b feature/task-1-base

# Task 2 (depends on task 1)
cd ../project-task-1
git worktree add ../project-task-2 -b feature/task-2-dependent

# Task 2's worktree is based on task 1's branch
```

When task-1 updates, rebase task-2:
```bash
cd ../project-task-2
git fetch origin
git rebase feature/task-1-base
```

## Worktree vs Branch Decision Tree

```
Need parallel filesystem access?
├─ Yes → Use worktrees
│   ├─ Tasks independent? → Create from main
│   └─ Tasks stacked? → Create from previous task's branch
└─ No → Use branches only
    └─ Each agent: checkout, implement, push, done
```
