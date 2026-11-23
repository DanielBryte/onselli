# Onselli Feature Branching Workflow

This document defines the feature branching workflow for **Onselli**. All new features, refactors, and fixes are developed in isolated feature branches off `dev`, then merged to `dev` for staging deployment (`onselli-dev`), and finally promoted to `master` for production (`onselli.com`).

---

## 1. Branch & Environment Mapping

| Branch | Environment | Live URL | Database | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **`feat/*`, `fix/*`** | Local Work | `localhost:3000` | Local / Neon Dev | Feature-specific development branches branched off `dev`. |
| **`dev`** | Staging (QA) | [onselli-dev](https://onselli-dev) | Neon DB (Staging), Bachs Sandbox | Staging trunk. Feature branches merge here. Pushing to `origin dev` deploys to `onselli-dev`. |
| **`master`** | Production | [onselli.com](https://onselli.com) | Prod Neon DB, Live Bachs/Stripe | Real creators & live transactions. Deploys to `onselli.com` when `dev` is merged. |

---

## 2. Step-by-Step Feature Workflow

### 1. Branch from `dev`
```bash
git checkout dev
git pull origin dev
git checkout -b feat/creator-product-flow
```

### 2. Develop & Test Locally
Implement features using shared UI primitives (`app/components/ui/`).
Verify health check:
```bash
npm run typecheck
```

### 3. Commit
```bash
git add <files>
git commit -m "feat(products): revamp creator product creation, edit flow, and preview page"
```

### 4. Merge to `dev` & Deploy to Staging (`onselli-dev`)
```bash
git checkout dev
git merge feat/creator-product-flow
git push origin dev
```

### 5. Release to Production (`onselli.com`)
After testing on `onselli-dev`:
```bash
git checkout master
git merge dev
git push origin master
git checkout dev
```
