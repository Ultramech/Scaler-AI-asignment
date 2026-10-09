<div align="center">

<img src="docs/banner.svg" alt="AWS Route 53 Console Clone" width="760" />

## 🎬 Try the Live Demo

<a href="https://route53-clone-three-gamma.vercel.app"><img alt="Live demo" src="https://img.shields.io/badge/%E2%96%B6%20LIVE%20DEMO-VERCEL-ff9900?style=for-the-badge&labelColor=161b22" /></a>
<a href="https://route53-clone-api-s69g.onrender.com/docs"><img alt="API docs" src="https://img.shields.io/badge/%F0%9F%93%98%20API%20DOCS-RENDER-2ea44f?style=for-the-badge&labelColor=161b22" /></a>
<a href="https://github.com/Ultramech/Scaler-AI-asignment"><img alt="Source code" src="https://img.shields.io/badge/%F0%9F%92%BB%20SOURCE-GITHUB-8957e5?style=for-the-badge&labelColor=161b22" /></a>

</div>

> **A full-stack clone of the Amazon Route 53 console.** Hosted zones, DNS records, search, filters, pagination, modals and notifications on a real **FastAPI** backend with persistent **SQLite** storage, built to look and behave like the original. **No actual DNS is served or resolved.**

<div align="center">

**Next.js 15 (TypeScript)** · **FastAPI** · **SQLAlchemy** · **SQLite**

</div>

**Trying the demo:** open the link, enter any email address (for example `me@example.com`), press **Next**, enter any password and sign in. To try the other flow, choose **IAM user** and enter any account ID, then any username and password. Authentication is mocked, so there is nothing to register. A sample `example.com` zone is there to explore; create your own zones and records freely.

> **About data on the hosted demo.** The app stores everything in SQLite and keeps it for as long as the database file exists (see [Data persistence](#data-persistence)). The hosted API runs on Render's free tier, whose disk is wiped whenever the server restarts or redeploys, after which only the sample zone is back. A scheduled GitHub Action keeps the server awake, which makes this rare, but treat data on the hosted demo as temporary. Run the app locally for durable data.

![Hosted zone details](docs/screenshots/03-hosted-zone-details.png)

<details>
<summary>More screenshots</summary>

| | |
| --- | --- |
| ![Sign in](docs/screenshots/01-sign-in.png) | ![Hosted zones](docs/screenshots/02-hosted-zones.png) |
| ![Create record](docs/screenshots/04-create-record.png) | ![Import zone file](docs/screenshots/05-import-zone-file.png) |
| ![DNSSEC signing](docs/screenshots/06-dnssec.png) | ![Preferences](docs/screenshots/07-preferences.png) |

![Dark mode](docs/screenshots/08-dark-mode.png)

</details>

## Contents

- [Assignment checklist](#assignment-checklist)
- [Features](#features)
- [Run locally](#run-locally)
- [Configuration](#configuration)
- [Architecture](#architecture)
- [Database schema](#database-schema)
- [Data persistence](#data-persistence)
- [API overview](#api-overview)
- [Testing](#testing)
- [Deployment](#deployment)
- [Design decisions and limitations](#design-decisions-and-limitations)

## Assignment checklist

| Requirement | Status | Where |
| --- | --- | --- |
| Next.js (TypeScript) frontend, FastAPI backend, SQLite database | Done | `frontend/`, `backend/` |
| Mocked authentication: login, logout, session persistence | Done | AWS-style sign-in page (root and IAM user flows), account menu → *Sign out*, session kept in `localStorage` |
| **Hosted zones**: view, search, create, edit, delete | Done | Hosted zones list, create/edit pages, delete confirmation |
| **DNS records**: view, search, create, edit, delete | Done | Hosted zone page → *Records* tab, create/edit record pages |
| Record types A, AAAA, CNAME, TXT, MX, NS, PTR, SRV, CAA | Done | Per-type validation in `backend/app/dns.py` |
| All data persists in SQLite | Done | `backend/route53.db`, created on first start |
| Route 53 experience: navigation, tables, forms, search, filters, pagination, modals, notifications | Done | See [Features](#features) |
| Mocked sections as placeholders (Dashboard, Traffic policies, Health checks, Resolver, Profiles) | Done | Dashboard page with live counts; the rest show a "Coming soon" page |
| **Bonus:** import BIND zone files | Done | *Import zone file* page with live preview |
| **Bonus:** export hosted zones as JSON or BIND | Done | *Export JSON / Export BIND* on the records card |
| **Bonus:** dark mode | Done | Account menu, remembered between visits |
| **Bonus:** keyboard shortcuts | Done | Press `?` to list them |
| **Bonus:** bulk operations | Done | Select several records to delete them or change their TTL together |
| README: setup, architecture, database schema, API overview | Done | This file |
| Demo: a hosted working link | Done | See the table at the top |

## Features

**Authentication (mocked).** A sign-in page modelled on the real AWS one: root user (email address, then password) or IAM user (account ID or alias, then username and password), with the feedback, multi-session and language links, the cube background and the promo panel. Any credentials are accepted: IAM, accounts and billing are intentionally mocked. The session survives reloads and *Sign out* clears it.

**Hosted zones**
- Table with search, sortable and resizable columns, pagination, single selection, and a *Preferences* dialog (page size, wrap lines, search mode, visible columns).
- Create public or private zones (private zones take a VPC), with description and tags. Domain names are validated and duplicates are rejected. Every zone starts with an apex `NS` and `SOA` record, like Route 53.
- Zone page: collapsible details (ID, description, query log, type, record count, name servers) and the *Records*, *Accelerated recovery*, *DNSSEC signing* and *Hosted zone tags* tabs.
- Edit the description and tags, delete behind a "type `delete` to confirm" dialog, *Test record*, *Configure query logging*, *Manage tags*.

**DNS records**
- Types `A`, `AAAA`, `CNAME`, `TXT`, `MX`, `NS`, `PTR`, `SRV`, `CAA` (plus the zone's `SOA`), with per-type value validation (IPv4/IPv6, MX priority, SRV, CAA, quoted TXT, hostnames).
- Filter by text, type, routing policy and alias; sort; paginate; the right-hand panel shows the selected record with copy buttons.
- *Quick create* adds several records at once (atomically); a *wizard* starts from the routing policy. Alias records, TTL presets, multi-value records, edit, delete.
- Safety rules: duplicates and CNAME conflicts are rejected, the apex NS/SOA records cannot be deleted or renamed.

**Console experience.** Top bar with global search (`Alt+S`), breadcrumbs, collapsible side navigation, an *Info* help panel, dismissible flash notifications, hash-based routing (Back/Forward and deep links work) and a responsive layout.

**Bonus features.** BIND import with live preview and conflict detection, JSON/BIND export, dark mode, keyboard shortcuts (`?` lists them: `/` filter, `N` new record, `C` new zone, `R` refresh, `Alt+S` search, `Esc` close) and bulk delete / bulk TTL change.

## Run locally

Requirements: Python 3.12+ and Node.js 20+.

```bash
# Terminal 1: API on http://localhost:8000
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Terminal 2: web app on http://localhost:3000
cd frontend
npm install
npm run dev
```

Open <http://localhost:3000> and sign in with any email address and password. Interactive API docs are at <http://localhost:8000/docs>. On first start the API creates the database and seeds an `example.com` zone so there is something to explore.

## Configuration

| Variable | Where | Default | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | frontend (build time) | `http://localhost:8000` | URL of the API |
| `ROUTE53_DATABASE_URL` | backend | `sqlite:///./route53.db` | SQLite file location |
| `ROUTE53_CORS_ORIGINS` | backend | `http://localhost:3000,http://127.0.0.1:3000` | Comma-separated browser origins allowed to call the API |
| `ROUTE53_CORS_ORIGIN_REGEX` | backend | none | Regex for origins that change per deployment, e.g. `https://.*\.vercel\.app` |

## Architecture

```mermaid
flowchart LR
    subgraph Browser
        UI["Next.js app<br/>views, components, hash router"]
    end
    subgraph API["FastAPI service"]
        R["Routes (main.py)"]
        D["DNS rules (dns.py)<br/>validation, BIND import/export"]
        M["SQLAlchemy models"]
    end
    DB[("SQLite")]
    UI -- "JSON over HTTPS<br/>Bearer demo token" --> R
    R --> D
    R --> M --> DB
```

```
backend/app
  main.py      FastAPI routes, serializers, startup (create tables, migrate, seed)
  models.py    SQLAlchemy models
  schemas.py   Pydantic request models
  dns.py       DNS rules: name/value validation, default NS/SOA, BIND parse/export
  db.py        engine, session factory, additive column migration
backend/tests  smoke.py: end-to-end API test on a temporary database
frontend/app
  page.tsx     session handling and route switch
  lib/         API client, hash router, console context (theme, notifications, help), hooks
  components/  Frame (top bar, navigation, tools panel), DataTable, forms, modals, tabs
  views/       one file per page (zones, zone detail, create/edit zone, record forms, import, ...)
  styles/      design tokens plus frame, component and page CSS
frontend/e2e   console.e2e.mjs: browser test of the whole UI
```

The frontend keeps no durable state of its own: every list, form and count comes from the API. Only UI preferences (theme, table preferences, panel position, session token) live in `localStorage`. Pages are addressed by hash (`#/hostedzones/<id>?tab=dnssec`), so Back/Forward and deep links work without server routing.

## Database schema

```mermaid
erDiagram
    hosted_zones ||--o{ dns_records : "has"
    hosted_zones ||--o{ hosted_zone_tags : "has"
    hosted_zones {
        string id PK "Z + 19 characters"
        string name UK "FQDN with trailing dot"
        string comment
        bool private_zone
        string vpc_region
        string vpc_id
        datetime created_at
        string query_log_group
        bool accelerated_recovery
        bool dnssec_enabled
        string dnssec_ksk_name
        datetime dnssec_enabled_at
    }
    hosted_zone_tags {
        int id PK
        string zone_id FK
        string key
        string value
    }
    dns_records {
        int id PK
        string zone_id FK
        string name "FQDN"
        string type
        string value "one value per line"
        int ttl
        string routing_policy
        bool alias
        bool evaluate_target_health
        string set_identifier
    }
```

Deleting a hosted zone cascades to its records and tags. Columns added after the first release are added to existing databases at startup (`db.migrate`), so upgrading never requires deleting `route53.db`.

## Data persistence

Every piece of state lives in one SQLite file, `backend/route53.db` (override with `ROUTE53_DATABASE_URL`): hosted zones, records, tags and the DNSSEC, accelerated-recovery and query-logging settings. The file is created on first start, an `example.com` sample zone is seeded only when the database is empty, and restarting the API never deletes anything. This was checked by creating a zone with a tag and a record, stopping the server, restarting it on the same file, and reading all of it back.

| Where it runs | Persistence |
| --- | --- |
| **Local** (`uvicorn` + `npm run dev`) | Durable: the SQLite file stays on your disk across restarts. |
| **Hosted demo** (Render free tier) | Temporary: the host wipes its disk on restart or redeploy. A keep-alive job makes restarts rare. |

For a hosted deployment that keeps its data, run the API on a host with a persistent disk and set `ROUTE53_DATABASE_URL` to a path on it, for example `sqlite:////data/route53.db` (on Render this needs a paid plan with a disk). No code changes are needed.

## API overview

All endpoints except `/health` and `/auth/login` need `Authorization: Bearer route53-demo-session`. Errors are returned as `{"detail": "message"}`. Full interactive docs: `/docs`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/health` | Liveness check |
| POST | `/auth/login` | Issue the demo session |
| GET, POST | `/zones` | List / search (`?q=`), create a hosted zone |
| GET, PUT, DELETE | `/zones/{id}` | Read, update description and tags, delete |
| PUT | `/zones/{id}/tags` | Replace the tags |
| PUT, DELETE | `/zones/{id}/query-logging` | Set or remove the CloudWatch log group |
| PUT | `/zones/{id}/accelerated-recovery` | Enable or disable |
| PUT | `/zones/{id}/dnssec` | Enable (creates a key-signing key) or disable |
| POST | `/zones/{id}/test-record` | Simulate the answer Route 53 would give |
| GET, POST | `/zones/{id}/records` | List / search (`?q=`), create a record |
| POST | `/zones/{id}/records/batch` | Create several records atomically |
| DELETE, PATCH | `/zones/{id}/records` | Bulk delete by id / bulk change TTL |
| GET, PUT, DELETE | `/records/{id}` | Read, update, delete a record |
| POST | `/zones/{id}/records/import/preview` | Parse a BIND zone file without saving |
| POST | `/zones/{id}/records/import` | Import a BIND zone file |
| GET | `/zones/{id}/export?format=json\|bind` | Export a hosted zone |
| GET | `/search?q=` | Global search across zones and records |

## Testing

```bash
# API: boots the server on a temporary SQLite file and exercises it over HTTP
cd backend && .venv/bin/python tests/smoke.py

# Type check and production build
cd frontend && npx tsc --noEmit && npm run build

# UI: drives the real app in a headless browser (needs the API and `npm run dev` running)
cd frontend && npx playwright install chromium && npm run e2e
```

The API suite covers authentication, zone and record CRUD, validation and conflict errors, protected records, batch rollback, bulk operations, import/export, DNSSEC, query logging and test-record. The browser suite (55 steps) covers sign-in/out, every page and dialog, filtering, sorting, pagination, preferences, import/export, keyboard shortcuts, dark mode and deletion. It can also run against a deployment: `BASE=<frontend url> API=<api url> npm run e2e`.

## Deployment

- **Frontend:** Vercel. Set `NEXT_PUBLIC_API_URL` to the API URL and deploy the `frontend/` directory.
- **API:** Render, defined by [`render.yaml`](render.yaml) (a blueprint for `backend/`). It sets `ROUTE53_CORS_ORIGIN_REGEX` so any `*.vercel.app` frontend may call it.
- **Keep-alive:** [`.github/workflows/keep-alive.yml`](.github/workflows/keep-alive.yml) pings `/health` every 10 minutes so the free tier does not sleep.

For durable data in production, run the API on a host with a persistent disk and point `ROUTE53_DATABASE_URL` at it, for example `sqlite:////data/route53.db`.

## Design decisions and limitations

- **DNS is simulated.** Nothing is propagated or resolved. Name servers are generated per zone; DNSSEC, accelerated recovery and query logging persist their settings only.
- **Authentication is mocked on purpose.** Any credentials are accepted and the API issues a fixed demo token, as the assignment allows for IAM and account concerns. There is no sign-up flow.
- **A small, direct data model.** Three tables map straight to SQLAlchemy models; multi-value records keep one value per line so an edit stays a single row.
- **Validation lives on the server** (`dns.py`) and is mirrored in the forms for fast feedback.
- **Alias targets.** The endpoint-type dropdown in the alias form only changes the placeholder; the target is stored as a plain DNS name.
- **Hosted demo persistence.** The code persists everything in SQLite; only the free hosting tier is temporary. See [Data persistence](#data-persistence).
