# Onselli

> High-conversion digital product commerce, course hosting, and membership platform tailored for modern African creators.

---

## 1. Environments & 3-Branch Setup

A frictionless 3-branch workflow designed for rapid solo development without the overhead of juggling micro-feature branches:

| Branch | Environment | Live URL | Database / Services | How You Use It |
| :--- | :--- | :--- | :--- | :--- |
| **`dev`** | **Local Development** | `localhost:3000` | Local / Neon Dev branch | **Your daily workhorse.** You stay here and commit directly as you build. |
| **`staging`** | **Staging (QA)** | [onselli-dev](https://onselli-dev) | Neon DB (Staging), Bachs Sandbox | Merge `dev` here when you want to test on the staging link. |
| **`master`** | **Production** | [onselli.com](https://onselli.com) | Neon DB (Prod), Live Bachs/Stripe | Merge `staging` here when ready to ship live to real users. |

---

## 2. Frictionless Solo Workflow

```mermaid
flowchart LR
    A["1. Code directly in 'dev'"] --> B["2. Test locally (localhost:3000)"]
    B --> C["3. Push to 'staging' (onselli-dev)"]
    C --> D["4. Verify on staging link"]
    D --> E["5. Push to 'master' (onselli.com)"]
```

### Daily Coding Routine (Stay on `dev`):
You don't need to create new branches for every small task. Just keep working directly in `dev`:
```bash
# Verify you are on dev
git checkout dev

# Code your feature, then commit directly:
git add <files>
git commit -m "feat(courses): add video upload progress indicator"
```

---

### Ready to test on Staging (`onselli-dev`)?
When you want to see your changes live on the staging URL:
```bash
git checkout staging
git merge dev
git push origin staging
git checkout dev    # switch back to dev to keep coding
```
*Your staging environment (`onselli-dev`) will automatically build and deploy.*

---

### Ready to ship to Production (`onselli.com`)?
Once you verify that everything looks and works great on `onselli-dev`:
```bash
git checkout master
git merge staging
git push origin master
git checkout dev    # switch back to dev
```
*Your live site (`onselli.com`) is now updated.*

---

## 3. Design System & Anti-Slop Guidelines

1. **Restrained Color Palette:**
   - Brand Primary: Deep Emerald (`#006b4c`, hover `#00523a`)
   - Neutral Surfaces: `#ffffff`, subtle borders `#e5e7eb` / `#f3f4f6`, background `#f9fafb`
   - No novelty rainbow gradients, neon glow shadows, or fuzzy purple glassmorphism.
2. **Standard UI Primitives (`app/components/ui/`):**
   - `<Button variant="primary|secondary|tertiary|destructive" size="sm|md|lg" />`
   - `<Input />` & `<SearchInput placeholder="..." />`
   - `<Badge variant="published|draft|archived|active|failed" />`
   - `<Card />` & `<Panel />`
   - `<EmptyState />`
   - `<DropdownMenu />`
3. **Intentional Radii Scale:**
   - Standard elements: `rounded-lg` (8px)
   - Large cards / panels: `rounded-xl` (12px)
   - Badges & Pills: `rounded-full` (9999px)
4. **Data & Metrics:**
   - Always use `tabular-nums` for currency, pricing, and analytics numbers to prevent horizontal jitter.

---

## 4. Development Scripts

```bash
# Start local development server
npm run dev

# Run TypeScript typecheck (must pass with 0 errors)
npm run typecheck

# Build for production
npm run build

# Database schema migrations
npm run db:generate   # Generate migration SQL from schema
npm run db:migrate    # Apply migrations to database
npm run db:studio     # Launch visual Drizzle Studio

# Background job schedule sync
npm run jobs:sync-schedules
```

---

## 5. Architecture & Documentation Links

- [System Architecture](file:///docs/architecture.md)
- [Git Workflow Details](file:///docs/git-workflow.md)
- [Database & Auth Setup](file:///docs/auth-setup.md)
- [Bachs Payment & Payouts Architecture](file:///docs/bachs-payouts.md)
- [Full Product Specification](file:///docs/SPEC.md)
- [Development Plan & Milestones](file:///docs/development-plan.md)
