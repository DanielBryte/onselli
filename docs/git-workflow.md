# Onselli Solo Developer Git Workflow (2-Branch Model)

This document outlines the standard 2-branch workflow for **Onselli**. It eliminates the friction of managing dozens of micro-branches while keeping production completely protected.

---

## 1. Branch & Environment Mapping

| Branch | Environment | Live URL | Database | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **`dev`** | Staging & Local | [onselli-dev](https://onselli-dev) | Neon DB (Staging), Bachs Sandbox | Active coding branch. Tested locally on `localhost:3000`. Pushing to `origin dev` deploys to `onselli-dev`. |
| **`master`** | Production | [onselli.com](https://onselli.com) | Prod Neon DB, Live Bachs/Stripe | Real creators & live transactions. Deploys to `onselli.com` when `dev` is merged. |

---

## 2. Daily Workflow

### Active Coding (Stay on `dev`)
Work directly on `dev`:
```bash
git checkout dev
# make changes...
git add <files>
git commit -m "feat(courses): implement video upload and module ordering"
```

### Deploy to Staging (`onselli-dev`)
Whenever you want to test on the live staging link:
```bash
git push origin dev
```

### Deploy to Production (`onselli.com`)
Once verified on `onselli-dev`:
```bash
git checkout master
git merge dev
git push origin master
git checkout dev    # return to dev to continue coding
```
