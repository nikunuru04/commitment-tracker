# Commitment Tracker

Personal finance dashboard for tracking income, recurring commitments, payments, and savings — soft pastel-pink UI, MYR amounts, single Docker deployment.

**Status**: deployed at `http://10.10.0.103:2620` (LAN).

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 18 + TypeScript + Vite 5, Tailwind CSS 3.4, DaisyUI 4.12, shadcn-style Radix components, Lucide icons, TanStack Query 5, Recharts 2 |
| Backend | FastAPI + Pydantic v2, SQLAlchemy 2 |
| Database | SQLite (WAL mode) at `/data/app.db` in a named Docker volume |
| Deploy | Docker multi-stage build, Docker Compose, single container, non-root user |

## Library responsibilities (DaisyUI vs shadcn/ui)

- **DaisyUI** owns the theme (`roseblush` custom theme in `frontend/tailwind.config.js`), buttons, cards, badges, tables, stat cards, form input base styles.
- **shadcn-style components** (`frontend/src/components/ui/`, hand-written Radix wrappers) own dialogs, confirm dialogs (alert-dialog), dropdown menus, popovers, selects, tabs, tooltips, and the custom month picker.
- Single colour system: Tailwind theme tokens mirror the DaisyUI `roseblush` tokens; Recharts uses the same hex values.
- One Tailwind setup (v3), no competing theme providers.

## Project structure

```
backend/
  app/
    main.py        app factory, SPA serving, routers
    config.py      env settings (pydantic-settings)
    db.py          engine/session, PRAGMAs (WAL, FK, busy_timeout)
    migrations.py  ordered idempotent migration runner (schema_migrations table)
    models.py      SQLAlchemy models
    schemas.py     Pydantic request/response schemas
    engine.py      pure calculation engine (occurrences, totals) — no DB imports
    clock.py       TZ-safe today() (Asia/Kuala_Lumpur)
    auth.py        optional password auth (PBKDF2 hash, bearer token)
    routers/       categories, incomes, commitments, transactions, savings, summary(+export), auth
  tests/           pytest suite (35 tests) — engine, API, auth, SPA serving
frontend/
  src/pages/       Dashboard, Income, Commitments, Transactions, Calendar, Reports, Settings
  src/components/  Layout (sidebar + mobile drawer), AuthGate, dialogs, ui/, states
  src/lib/         api client, query hooks, format helpers (formatMYR), types
Dockerfile         multi-stage: node build → python slim runtime
compose.yaml       project "commitment-tracker", port 2620→8000, volume commitment-tracker-data
```

## Financial calculation rules

All money is stored and transported as **integer sen** (`amount_sen`). No floats in the engine. Display formats via `Intl.NumberFormat("ms-MY", {style:"currency",currency:"MYR"})`.

For a selected month `M` (`YYYY-MM`, window = calendar month, timezone Asia/Kuala_Lumpur):

```
Total Income      = Σ incomes with income_date in M
Total Commitments = Σ over non-archived commitments of amount × |occurrences in M|   (savings excluded)
Total Savings     = Σ savings_allocations with allocation_date in M
Available Balance = Total Income − Total Commitments − Total Savings   (can be negative)
```

Recurring occurrence generation (`backend/app/engine.py`):

- `one_time`: start_date only
- `weekly`: start_date + 7k days
- `monthly`: same day-of-month every month from the start month, **clamped to month end** (Jan 31 → Feb 28)
- `yearly`: same month/day each year from the start year (Feb 29 → Feb 28 on non-leap years)
- Recurring commitments are open-ended (future months included in planning)

Payments vs allocations (no double counting):

- Dashboard/report **totals use planned allocations**, never payment transactions.
- A payment (`POST /api/commitments/{id}/pay`) creates a transaction bound to `(commitment_id, occurrence_date)` with a UNIQUE constraint — one payment per occurrence; duplicates return 409.
- `paid_sen` is informational only (paid vs planned in Reports) and is never subtracted again.
- Unlinked `expense` transactions are "out-of-plan spending" records; they are displayed but not subtracted from Available Balance (per the formula above).
- Income exists only in the `incomes` table (single source of truth); it is never duplicated into transactions.

## API overview

All endpoints under `/api` (OpenAPI docs at `/docs` when auth is off). Key routes: `incomes`, `commitments` (+`occurrences`, `/{id}/pay`), `categories`, `transactions`, `savings/goals`, `savings/allocations`, `summary?month=`, `reports/monthly`, `reports/history`, `export`, `auth/*`, `health`. Money in/out is integer sen; errors are `{"detail": ...}` with 400/401/404/409/422.

Deletion policies (no silent history destruction): a category in use → 409; a commitment with payment history → 409 (archive instead); a savings goal with allocations → 409. Deleting a payment "unpays" that occurrence.

## Environment variables

| Var | Default | Purpose |
|---|---|---|
| `DATA_DIR` | `./data` | SQLite directory (volume-mounted to `/data` in Docker) |
| `STATIC_DIR` | — | Serve built frontend from this dir (SPA fallback included) |
| `APP_PASSWORD` | *(empty)* | When set, all API routes (except health/login/status) require `Authorization: Bearer <token>` after `POST /api/auth/login` |
| `CORS_ORIGINS` | `*` | Comma-separated allowed origins |
| `TZ` | `Asia/Kuala_Lumpur` | Date-boundary timezone for paid/overdue logic |

Auth notes: password is stored as `pbkdf2_sha256` hash in the DB (a successful env login bootstraps the hash once; afterwards the stored hash wins over the env value). Changing the password invalidates all tokens. Never commit real `.env` files.

## Local development

```bash
# backend (Python 3.12)
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
DATA_DIR=./data .venv/bin/uvicorn app.main:app --reload --port 8000

# frontend (Node 20+)
cd frontend
npm install
npm run dev        # http://localhost:5173, proxies /api → :8000

# tests
cd backend && .venv/bin/pytest -q
```

## Docker

```bash
docker compose up -d --build      # build + start (http://<host>:2620)
docker compose ps                 # status incl. healthcheck
docker compose logs -f app        # application logs
docker compose restart app        # controlled restart (data persists)
docker compose down               # stop + remove container (volume persists)
docker compose up -d --build      # redeploy after code update
```

Healthcheck: `GET /api/health` every 30s inside the container.

## Deployment (remote server 10.10.0.103)

```bash
rsync -az --exclude .git --exclude node_modules --exclude frontend/dist \
  --exclude 'backend/.venv' --exclude 'backend/data' --exclude .env \
  -e ssh ./ nik@10.10.0.103:commitment-tracker/
ssh nik
cd ~/commitment-tracker
printf 'APP_PASSWORD=<choose-a-password>\nTZ=Asia/Kuala_Lumpur\n' > .env && chmod 600 .env
docker compose up -d --build
```

Resources (all project-scoped): directory `~/commitment-tracker`, container `commitment-tracker-app`, image `commitment-tracker:latest`, volume `commitment-tracker-data`, host port 2620 → container 8000. No database port is published.

## Backup & restore

```bash
# backup (SQLite file inside the named volume)
ssh nik 'docker exec commitment-tracker-app cat /data/app.db' > ct-backup-$(date +%F).db
# or JSON export: Settings page → Export (or GET /api/export with a bearer token)

# restore
ssh nik 'docker compose -f ~/commitment-tracker/compose.yaml down'
ssh nik 'docker cp ct-backup-2026-10-22.db commitment-tracker-app:/data/app.db'
ssh nik 'cd ~/commitment-tracker && docker compose up -d'
```

## Update / redeploy procedure

1. `git commit` locally, rsync again (same command as deployment).
2. `docker compose up -d --build` — migrations run automatically at startup; data in `commitment-tracker-data` survives rebuilds.

## Known limitations

- Income records are one-off dated entries (no recurring income); add a record per month.
- Available Balance does not subtract unlinked expense transactions (they are informational; commitment allocations already represent planned spending).
- Single-user, single-container SQLite — no concurrent multi-user writes; fine for personal use.
- Frontend bundle ~265 kB gzip (single chunk); fine for LAN use.
- Auth is a single shared password + bearer token, suitable for a trusted LAN, not for public internet exposure.
