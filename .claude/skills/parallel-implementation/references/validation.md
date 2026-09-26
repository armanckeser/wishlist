# Validation Patterns

Each subagent must validate their work before marking complete.

## Minimum Validation (All Tasks)

```bash
# 1. Run existing tests
npm test          # or: uv run pytest, go test, etc.

# 2. Run linter
npm run lint      # or: uv run ruff check, etc.

# 3. Type check (if applicable)
npx tsc --noEmit  # or: uv run mypy, etc.
```

All must pass. If tests fail, fix before completing.

## Adding Tests

New functionality requires tests. Follow project conventions:

```typescript
// Frontend: colocate with component or in __tests__/
describe("NewFeature", () => {
  it("should do the thing", () => {
    // ...
  })
})
```

```python
# Backend: in tests/ directory, mirror source structure
def test_new_feature():
    # ...
```

## UI Screenshot Validation

For frontend changes, capture a screenshot to prove the change works.

### Using the Screenshot Script

The skill includes a reusable screenshot script:

```bash
# Full page
npx tsx .claude/skills/parallel-implementation/scripts/screenshot.ts \
  http://localhost:5173/debug screenshots/task-{id}.png

# Specific element
npx tsx .claude/skills/parallel-implementation/scripts/screenshot.ts \
  http://localhost:5173 screenshots/card.png "[data-testid='card']"
```

### Debug Page Pattern

If the project has a `/debug` route (like this one), use it for isolated component screenshots:

```bash
# Screenshot the debug sandbox
npx tsx scripts/screenshot.ts http://localhost:5173/debug screenshots/debug.png

# Screenshot a specific section
npx tsx scripts/screenshot.ts http://localhost:5173/debug screenshots/cards.png \
  "[data-testid='card-preview']"
```

### Playwright Component Screenshot

If project has Playwright set up:

```typescript
// In a test file
import { test, expect } from '@playwright/test'

test('screenshot new feature', async ({ page }) => {
  await page.goto('/path-to-feature')
  await page.waitForSelector('[data-testid="feature-element"]')
  await page.screenshot({
    path: 'screenshots/feature-name.png',
    fullPage: false
  })
})
```

Run with:
```bash
npx playwright test screenshot-test.spec.ts
```

### Quick Screenshot Script

For one-off screenshots without full test setup:

```typescript
// scripts/screenshot.ts
import { chromium } from 'playwright'

async function screenshot(url: string, selector: string, output: string) {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.goto(url)
  await page.waitForSelector(selector)

  const element = await page.$(selector)
  await element?.screenshot({ path: output })

  await browser.close()
}

// Usage: npx tsx scripts/screenshot.ts
screenshot('http://localhost:5173', '[data-testid="my-component"]', 'screenshot.png')
```

### Screenshot Naming Convention

```
screenshots/
  task-{id}-{description}.png
  task-42-new-header.png
  task-43-filter-panel.png
```

## Validation Checklist Template

Copy into subagent prompt:

```markdown
Validation required:
- [ ] `npm test` passes (or equivalent)
- [ ] `npm run lint` passes (or equivalent)
- [ ] New tests added for new functionality
- [ ] [UI only] Screenshot saved to screenshots/task-{id}-{name}.png
```

## Handling Validation Failures

If validation fails:

1. **Test failure**: Fix the code or update the test if behavior changed intentionally
2. **Lint failure**: Run `npm run lint -- --fix` or fix manually
3. **Type error**: Fix types, don't use `any` to bypass
4. **Screenshot fails**: Ensure dev server is running, check selector exists

Report failures clearly:
```
Validation FAILED:
- tests: 2 failing (ComponentA.test.ts, ComponentB.test.ts)
- lint: passed
- types: 1 error in utils.ts:42

Investigating test failures...
```
