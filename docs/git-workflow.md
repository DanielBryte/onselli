# Onselli Solo Developer Git Workflow

This document outlines the frictionless 3-branch workflow designed for rapid solo development on **Onselli**.

---

## 1. Branch & Environment Mapping

| Branch | Environment | Live URL | Database | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **`dev`** | Local Development | `localhost:3000` | Local / Neon Dev branch | Active daily coding. Commit directly here — zero branch hopping overhead. |
| **`staging`** | Staging (QA) | [onselli-dev](https://onselli-dev) | Staging Neon DB, Bachs Sandbox | Merge `dev` here when ready to preview & test on staging link. |
| **`master`** | Production | [onselli.com](https://onselli.com) | Prod Neon DB, Live Bachs/Stripe | Merge `staging` here when ready to deploy to real users. |

---

## 2. Daily Workflow

### Active Coding (Stay on `dev`)
Work on your features, pages, and components directly on `dev`:
```bash
git checkout dev
# make your changes...
git add <files>
git commit -m "feat(courses): implement video upload and module ordering"
```

### Deploy to Staging (`onselli-dev`)
Whenever you want to test on the staging server:
```bash
git checkout staging
git merge dev
git push origin staging
git checkout dev    # return to dev to continue coding
```

### Deploy to Production (`onselli.com`)
Once everything looks right on `onselli-dev`:
```bash
git checkout master
git merge staging
git push origin master
git checkout dev    # return to dev
```
