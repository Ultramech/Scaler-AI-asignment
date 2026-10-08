# Route 53 Console Clone

A functional clone of the AWS Route 53 console with persistent storage and a backend API. The goal is to recreate the Route 53 *experience and workflows* (navigation, tables, forms, search, filters, pagination, modals, notifications), not real DNS.

- **Frontend:** Next.js 15 (TypeScript, App Router)
- **Backend:** FastAPI + SQLAlchemy
- **Database:** SQLite (`backend/route53.db`, created on first start)

## Live demo

- App: <https://route53-clone-three-gamma.vercel.app> (sign in with any email)
- API: <https://route53-clone-api-s69g.onrender.com/docs>

The frontend runs on Vercel and the API on Render's free tier. The free tier sleeps when idle, so the first request can take up to a minute, and its disk is reset on restart, so records created in the demo are not kept long-term (the sample `example.com` zone is re-created). Run it locally for durable storage.

## Features

**Authentication (mocked)** – sign in, sign out and a session that survives reloads. No AWS account or credentials are involved.

**Hosted zones** – full CRUD, all persisted in SQLite.
- List with search, sorting, pagination, selectable rows and a *Preferences* dialog (page size, wrap lines, search mode, visible columns).
- Create (public or private zone, description, tags, validation, duplicate detection). Every zone starts with an apex `NS` and `SOA` record, like Route 53.
- Details page: collapsible *Hosted zone details* (name, ID, description, query log, type, record count, name servers), plus the **Records**, **Accelerated recovery**, **DNSSEC signing** and **Hosted zone tags** tabs.
- Edit (description and tags), delete with the “type `delete` to confirm” dialog, *Test record*, *Configure query logging*.

**DNS records** – `A`, `AAAA`, `CNAME`, `TXT`, `MX`, `NS`, `PTR`, `SRV`, `CAA` (plus the zone's `SOA`).
- View, search (text, type, routing policy, alias), sort, paginate, select; the right-hand panel shows the selected record's details with copy buttons.
- *Quick create* (several records at once, atomically) and the *wizard* (routing policy first), alias records, TTL presets, multi-value records, edit, delete and bulk delete. The apex NS/SOA records can be edited but not deleted or renamed.
- Per-type value validation (IPv4/IPv6, MX priority, SRV, CAA, quoted TXT, hostnames), duplicate and CNAME-conflict detection.

**Route 53 experience** – top bar with global search (`Alt+S`), breadcrumbs, collapsible side navigation, resizable table columns, an *Info* help panel, flash notifications, hash-based routing so Back/Forward and deep links work, and a responsive layout.

**Mocked sections** – Dashboard (live hosted-zone count) and every other sidebar section show a “Coming soon” page.

**Bonus** – import records from a pasted/uploaded BIND zone file with a live preview, export a zone as JSON or BIND, dark mode (account menu), keyboard shortcuts (`?` lists them: `/` filter, `N` new record, `C` new hosted zone, `R` refresh, `Alt+S` search, `Esc` close dialogs) and bulk operations (select several records to delete them or change their TTL together).

## Run locally

```bash
# Terminal 1 – API on :8000
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Terminal 2 – web app on :3000
cd frontend
npm install
npm run dev
```

Open <http://localhost:3000> and choose **Sign in** (any valid email works). Interactive API docs are at <http://localhost:8000/docs>. Set `NEXT_PUBLIC_API_URL` if the API runs elsewhere.

## Architecture

```
backend/app
  main.py      FastAPI routes, serializers, startup (create tables, migrate, seed)
  models.py    SQLAlchemy models
  schemas.py   Pydantic request models
  dns.py       DNS rules: name/value validation, default NS/SOA, BIND parse/export
  db.py        engine, session, additive column migration
frontend/app
  page.tsx           session handling + route switch
  lib/               api client, hash router, console context (theme, flash messages, help), hooks
  components/        Frame (top bar, nav, tools panel), DataTable, forms, modals, tabs
  views/             one file per page (zones list, zone detail, create/edit zone, record forms, import, ...)
  styles/            design tokens + frame/components/pages CSS
```

The frontend keeps no durable state of its own: every list, form and count comes from the API. UI-only preferences (theme, table preferences, panel position, session token) live in `localStorage`.

## Database schema

`hosted_zones` – `id` (PK, `Z` + 19 characters), `name` (unique, trailing dot), `comment`, `private_zone`, `vpc_region`, `vpc_id`, `created_at`, `query_log_group`, `accelerated_recovery`, `dnssec_enabled`, `dnssec_ksk_name`, `dnssec_enabled_at`.

`hosted_zone_tags` – `id`, `zone_id` → `hosted_zones.id`, `key`, `value`.

`dns_records` – `id`, `zone_id` → `hosted_zones.id`, `name` (FQDN), `type`, `value` (one value per line), `ttl`, `routing_policy`, `alias`, `evaluate_target_health`, `set_identifier`.

Deleting a hosted zone cascades to its records and tags. Columns added after the first release are added to existing databases on startup (`db.migrate`).

## API overview

All endpoints except `/health` and `/auth/login` need `Authorization: Bearer route53-demo-session`. Errors are `{"detail": "message"}`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/auth/login` | Create the demo session |
| GET, POST | `/zones` | List/search (`?q=`), create |
| GET, PUT, DELETE | `/zones/{id}` | Read, update description/tags, delete |
| PUT | `/zones/{id}/tags` | Replace tags |
| PUT, DELETE | `/zones/{id}/query-logging` | Set / remove the CloudWatch log group |
| PUT | `/zones/{id}/accelerated-recovery` | Enable/disable |
| PUT | `/zones/{id}/dnssec` | Enable (creates a KSK) / disable signing |
| POST | `/zones/{id}/test-record` | Simulate a DNS answer from the zone's records |
| GET, POST | `/zones/{id}/records` | List/search (`?q=`), create one |
| POST | `/zones/{id}/records/batch` | Create several records atomically |
| DELETE, PATCH | `/zones/{id}/records` | Bulk delete by id / bulk change TTL |
| GET, PUT, DELETE | `/records/{id}` | Read, update, delete a record |
| POST | `/zones/{id}/records/import/preview`, `/zones/{id}/records/import` | Preview / import a BIND zone file |
| GET | `/zones/{id}/export?format=json\|bind` | Export a zone |
| GET | `/search?q=` | Global search across zones and records |

## Tests

```bash
cd backend && .venv/bin/python tests/smoke.py
```

The smoke suite boots the API on a temporary SQLite file and exercises authentication, zone and record CRUD, validation and conflict errors, protected records, batch/rollback, import/export, DNSSEC, query logging and test-record over HTTP.

The frontend type-checks with `npx tsc --noEmit` and builds with `npm run build`.

## Notes and limitations

- DNS is simulated: nothing is propagated or resolved. Name servers are generated per zone, and DNSSEC, accelerated recovery and query logging only persist their settings.
- The session token is a fixed demo value, as allowed for the mocked authentication.
- Alias target types in the form are cosmetic (they change the placeholder); the target is stored as a plain DNS name.
