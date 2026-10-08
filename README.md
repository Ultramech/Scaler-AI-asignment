# Route 53 Console Clone

A full-stack, high-fidelity Route 53 management experience built for the assignment. It models the console workflows—not real DNS propagation—with persistent SQLite storage.

## Features

- Mock sign-in with persistent browser session
- Hosted zone CRUD, filtering, public/private zones, and cascading record deletion
- DNS record CRUD and search for `A`, `AAAA`, `CNAME`, `TXT`, `MX`, `NS`, `PTR`, `SRV`, and `CAA`
- AWS-console-inspired responsive UI, confirmation dialogs, notifications, loading-safe empty states, and placeholder Route 53 sections
- Seeded example zone so the first run is immediately explorable
- Bonus: BIND zone-file import, JSON/BIND exports, persisted dark mode, keyboard shortcuts, and bulk record deletion

## Run locally

Terminal 1:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Terminal 2:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. The mock login is prefilled; any valid email works. API documentation is at `http://localhost:8000/docs`.

## Architecture

`frontend/` is a Next.js 15 TypeScript client. It keeps the interface state close to the console and uses the FastAPI API for all durable data. `backend/` is a FastAPI service with SQLAlchemy. CORS permits the local Next development server.

## Database schema

`hosted_zones`: `id`, `name` (unique), `comment`, `private_zone`, `created_at`.

`dns_records`: `id`, `zone_id` (foreign key to hosted_zones), `name`, `type`, `value`, `ttl`, `routing_policy`.

Deleting a hosted zone cascades to its DNS records. The SQLite database is `backend/route53.db` and is created automatically on first start.

## API overview

All zone and record endpoints expect `Authorization: Bearer route53-demo-session` after `POST /auth/login`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/auth/login` | Create demo session |
| GET/POST | `/zones` | List/filter and create zones |
| PUT/DELETE | `/zones/{id}` | Update/delete zone |
| GET/POST | `/zones/{id}/records` | List/filter and create records |
| PUT/DELETE | `/records/{id}` | Update/delete record |
| POST | `/zones/{id}/records/import` | Import supported records from a BIND zone file |
| GET | `/zones/{id}/export?format=json|bind` | Export a hosted zone as JSON or BIND |
| DELETE | `/zones/{id}/records` | Bulk delete selected record IDs |

## Bonus workflow guide

Within an open hosted zone, use **Import BIND** to add `A`, `AAAA`, `CNAME`, `TXT`, `MX`, `NS`, `PTR`, `SRV`, or `CAA` records from a zone file. **Export JSON** and **Export BIND** download the current persisted zone. Select one or more record checkboxes to reveal the safe bulk-delete action.

The record editor supports Simple, Weighted, Latency, Failover, and Geolocation policy labels to mirror the Route 53 record workflow. This remains a local Route 53 simulation: it does not propagate DNS or access an AWS account.

Keyboard shortcuts: press `/` to focus the record filter, `N` to create a record, and `Escape` to close an open dialog. The top bar color-mode control persists the theme in the local browser.

## Verification

The frontend passes `npm run build`. Backend smoke checks cover persistence plus BIND import/export and bulk deletion; run `cd backend && .venv/bin/python tests/smoke.py`. Before a demo, create a zone, add/edit/delete a record, filter both lists, import/export a BIND file, try bulk deletion, and toggle dark mode.
