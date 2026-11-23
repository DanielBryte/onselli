# Onselli Git Workflow & Release Management

This document defines the standard engineering and branch management workflow for the **Onselli** platform. Following this process ensures smooth development, predictable deployments, zero regressions, and effortless rollbacks.

---

## 1. Environment & Branch Mapping

| Environment | Branch | Live URL | Database / Services | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Production** | `master` | [onselli.com](https://onselli.com) | Production Neon DB, Live Bachs/Stripe, SES/Zepto | Real creators, live payments, live buyers. |
| **Staging** | `dev` | [onselli-dev](https://onselli-dev) | Staging Neon DB, Bachs Sandbox, Test storage | End-to-end rehearsal, verification, QA. |
| **Local** | `feat/*`, `fix/*` | `localhost:3000` | Local / Neon Dev branch | Active engineering, UI development. |

---

## 2. Branch Hierarchy & Rules

```mermaid
gitGraph
   commit id: "Initial Master"
   branch dev
   checkout dev
   commit id: "Setup Staging"
   branch feat/product-library-unslop
   checkout feat/product-library-unslop
   commit id: "feat: add SearchInput"
   commit id: "ui: align ellipsis dropdowns"
   checkout dev
   merge feat/product-library-unslop
   checkout master
   merge dev id: "Release to Prod (onselli.com)"
```

### Golden Rules:
1. **`master` is Sacred:** Never push unverified code directly to `master`. Code reaches `master` only by merging from `dev` after being verified on the staging deployment (`onselli-dev`).
2. **`dev` is the Staging Trunk:** All new work branches off `dev` and merges back into `dev`.
3. **Short-Lived Feature Branches:** Create small, focused branches from `dev`:
   - `feat/feature-name` for new user-facing functionality.
   - `fix/bug-name` for bug fixes.
   - `ui/refactor-name` for design-system, layout, or anti-slop improvements.
4. **Small, Atomic Commits:** Commit often with clear Conventional Commit messages. Avoid 1,000-line omnibus commits touching 20 unrelated features.

---

## 3. Standard Step-by-Step Developer Workflow

### Step 1: Start from Clean `dev`
Always ensure your base branch is up to date:
```bash
git checkout dev
git pull origin dev
```

### Step 2: Create a Feature Branch
```bash
git checkout -b feat/course-curriculum-editor
```

### Step 3: Implement Using Shared UI Primitives
Never build ad-hoc inputs, buttons, or modals from scratch. Always use the established component library in `app/components/ui/`:
- `<Button variant="primary|secondary|tertiary|destructive" size="sm|md|lg" />`
- `<Input />` & `<SearchInput />`
- `<Badge variant="published|draft|archived|active|failed" />`
- `<Card />` / `<Panel />`
- `<EmptyState />`
- `<DropdownMenu />`
- `<WorkspaceSelect />`

### Step 4: Verify Before Staging (The 15-Second Health Check)
Run the typecheck to ensure zero regressions:
```bash
npm run typecheck
```
Check what files were touched:
```bash
git status --short
```

### Step 5: Commit with Conventional Commits
```bash
git add app/components/ui/SearchInput.tsx app/workspace/CreatorProductLibrary.tsx
git commit -m "feat(library): replace raw inputs with SearchInput and clean dropdown menus"
```

| Type | Purpose | Example |
| :--- | :--- | :--- |
| `feat:` | New feature | `feat(auth): add 2FA challenge and backup code verification` |
| `fix:` | Bug fix | `fix(cart): prevent slide-over layout shift on narrow viewports` |
| `ui:` | Design / styling / anti-slop | `ui(dashboard): align baselines and apply tabular-nums to KPI values` |
| `refactor:` | Code restructuring | `refactor(db): extract schema helpers to dedicated module` |
| `db:` | Schema migration | `db: add 0026_order_buyer_name migration` |
| `chore:` | Config / dependencies | `chore: update next.config and typescript dependencies` |

### Step 6: Merge to `dev` for Staging Deployment
```bash
git checkout dev
git merge feat/course-curriculum-editor
git push origin dev
```
*Your CI/CD or Vercel automatically deploys `dev` to **onselli-dev** for testing.*

### Step 7: Release to Production (`onselli.com`)
Once verified on `onselli-dev`:
```bash
git checkout master
git merge dev
git push origin master
```
*Your production environment deploys to **onselli.com**.*

---

## 4. Emergency Fixes (Hotfixes)

If a critical bug happens in production:
1. Branch off `master`: `git checkout -b hotfix/critical-checkout-fix master`
2. Fix and verify with `npm run typecheck`.
3. Merge into `master` and push for instant production release.
4. Merge back into `dev` so staging also has the fix:
   ```bash
   git checkout dev
   git merge master
   git push origin dev
   ```

---

## 5. Deployment Checklist

Before triggering a production release from `master`:
- [ ] `npm run typecheck` passes with 0 errors.
- [ ] Database migrations applied: `npm run db:migrate`
- [ ] Environmental variables verified in `.env.production` (Bachs live keys, Better Auth secret, SES email credentials).
- [ ] Staging test completed on [onselli-dev](https://onselli-dev).
