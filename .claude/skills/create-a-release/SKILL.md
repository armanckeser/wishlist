---
name: create-a-release
description: |
  Create a GitHub release with What's New updates and screenshots. Use when:
  (1) User says "create a release", "release this", "new release", "publish release"
  (2) User wants to publish completed work
  (3) After merging a feature branch to main

  Workflow: check version → identify changes → create stories → take screenshots → update What's New → commit → create release.
  CRITICAL: Always update What's New config and commit BEFORE creating the release.
---

# Create a Release

Use this skill when the user asks to create a release, publish a release, or says something like "release this", "create release", "new release".

## Pre-Release Checklist

Before creating a release, ensure:
1. All changes are committed and pushed to main
2. Pre-commit and pre-push hooks pass (tests, coverage)

## Release Workflow

### Step 1: Determine Next Version

Check the latest release to determine the next version:

```bash
gh release list --limit 1
```

Version bumping rules:
- **Major features** (new pages, major functionality): bump minor (0.26.x → 0.27.0)
- **Bug fixes only**: bump patch (0.26.0 → 0.26.1)

### Step 2: Identify What's New

Review commits since the last release:

```bash
gh release list --limit 1  # Get latest tag, e.g., v0.26.2
git log v0.26.2..HEAD --oneline
```

Identify features that deserve a What's New entry. Bug fixes and minor changes don't need What's New entries.

### Step 3: Create Storybook Stories (if needed)

If the new features don't have Storybook stories yet, create them:

1. **Find similar story files** to use as templates:
   ```bash
   find frontend/src -name "*.stories.tsx"
   ```

2. **Create story file** next to the component:
   ```typescript
   // Example: ComponentName.stories.tsx
   import type { Meta, StoryObj } from "@storybook/react-vite"
   import { ComponentName } from "./ComponentName"

   const meta: Meta<typeof ComponentName> = {
     title: "Components/Path/ComponentName",
     component: ComponentName,
     tags: ["autodocs"],
     parameters: {
       layout: "centered",
     },
   }

   export default meta
   type Story = StoryObj<typeof ComponentName>

   export const Default: Story = {
     args: {
       // Component props
     },
   }
   ```

3. **Important**: Components that use React Context need the appropriate providers:
   - Check existing `.stories.tsx` files in the same directory for examples
   - Use decorators to wrap stories with required context providers
   - Import mock data utilities from `@/storybook` (e.g., `createMockItem`, `withWishlistProviders`)

4. **Verify the story renders** by visiting it in Storybook:
   ```bash
   # Start Storybook if not running
   npm run storybook

   # Navigate to http://localhost:6006
   # Find your story and check it displays without errors
   ```

   If you see error messages like "must be used within a Provider", look at similar component stories to see which providers/decorators they use.

### Step 4: Take Screenshots

**Use the existing screenshot script** - this is the correct, maintainable approach:

1. **Start Storybook** (if not running):
   ```bash
   cd frontend && npm run storybook &
   sleep 15  # Wait for it to start
   ```

2. **Update the screenshot script** at `frontend/scripts/whats-new-screenshots.ts`:
   ```typescript
   const SCREENSHOTS: Screenshot[] = [
     {
       storyId: "components-path-componentname--story-name",
       output: "public/whats-new/feature-name.png",
       viewport: { width: 550, height: 450 },
       delay: 300,
     },
   ]
   ```

   **Tips:**
   - Story IDs are kebab-case: `components-wishlistitem-waivecooldowndialog--default`
   - Find story ID by visiting http://localhost:6006 and checking the URL
   - Adjust viewport dimensions to frame the component nicely
   - Use 300-500ms delay for animations

3. **Run the script**:
   ```bash
   npx tsx scripts/whats-new-screenshots.ts
   ```

4. **Verify screenshots**:
   ```bash
   ls -lh public/whats-new/
   ```

**What the script does automatically:**
- ✅ Uses dark theme (midnight) via `globals=theme:dark`
- ✅ Retina quality screenshots (`deviceScaleFactor: 2`)
- ✅ Captures components at proper viewport sizes
- ✅ Waits for animations to complete
- ✅ Creates output directories automatically
- ✅ **Detects errors and fails with helpful messages** if the component doesn't render

**Error Detection:**
The script will automatically fail if:
- Component throws an error (e.g., "must be used within a Provider")
- Story container is empty (component didn't render)
- Error messages are visible on the page

When errors occur, you'll see clear error messages telling you what's wrong with the story.

**DO NOT manually run `npx playwright screenshot`** - use the script!

### Step 5: Update What's New Config

Edit `frontend/src/config/whats-new.ts`:

1. **Update version**:
   ```typescript
   export const WHATS_NEW_VERSION = "0.28.0" // New version
   ```

2. **Replace sections** with new features only (don't keep old ones):
   ```typescript
   export const whatsNewContent: WhatsNewContent = {
     title: "What's New",
     sections: [
       {
         heading: "Feature Name",
         description: "Focus on BENEFITS not features. Answer 'what can I do now?'",
         image: "/whats-new/screenshot-name.png", // Optional
       },
     ],
   }
   ```

**Writing Guidelines** (from the config file):
- Focus on BENEFITS, not features
- Good: "Know exactly where your packages are!"
- Bad: "We added package tracking integration"
- Keep descriptions concise (1-2 sentences)
- Image paths are relative to `public/`: `/whats-new/feature.png`

### Step 6: Commit What's New Changes

```bash
git add frontend/src/config/whats-new.ts frontend/public/whats-new/ frontend/scripts/whats-new-screenshots.ts
# Also add any new story files
git add frontend/src/components/**/**.stories.tsx
git commit -m "feat: update What's New for vX.Y.Z

Co-Authored-By: Claude <noreply@anthropic.com>"
git push
```

### Step 7: Create the Release

**IMPORTANT**: Only create the release AFTER committing and pushing What's New changes.

```bash
gh release create vX.Y.Z --title "vX.Y.Z - Short Description" --notes "$(cat <<'EOF'
## What's New

### Feature Name

Brief description of the feature and its benefits.

![Feature Screenshot](https://raw.githubusercontent.com/armanckeser/wishlist/main/frontend/public/whats-new/screenshot.png)

### Another Feature

Description...

**Additional improvements:**
- Bullet point for minor fixes
- Another minor improvement
EOF
)"
```

### Step 8: Cleanup

```bash
pkill -f storybook 2>/dev/null || true
```

## Common Mistakes to Avoid

1. **Creating release before updating What's New** - The release points to a commit, so What's New must be committed first
2. **Not using the screenshot script** - Manually running playwright is error-prone and inconsistent
3. **Not verifying stories render** - Always check stories in Storybook before running the screenshot script
4. **Wrong theme** - Screenshots must use dark theme (midnight), not light (frost)
5. **Keeping old What's New sections** - Replace with only the new features

## Quick Reference

```bash
# Full workflow
gh release list --limit 1                       # Check current version
git log v0.X.Y..HEAD --oneline                  # See what's new
# Create stories if needed
cd frontend && npm run storybook &              # Start Storybook
sleep 15                                        # Wait for it
# Edit scripts/whats-new-screenshots.ts
npx tsx scripts/whats-new-screenshots.ts        # Take screenshots
# Edit src/config/whats-new.ts
git add -A && git commit && git push            # Commit first!
gh release create vX.Y.Z --title "..." --notes "..."  # Then release
pkill -f storybook                              # Cleanup
```
