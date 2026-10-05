# Fit

<p align="center">
  <img src="frontend/public/logo.svg" alt="Logo" width="96" height="96">
</p>

Fitness tracking web app: create training plans with freely configurable training methods, run trainings with a timer, review history and progress. Runs entirely in Docker containers.

Access requires a login. Every user has their own exercises, training methods, plans and history. Users are created via the CLI only (see [Managing users](#managing-users)), there is no sign-up.

## Requirements

- Docker + Docker Compose (`docker compose version`)
- Node.js 24 (for the local dev mode and `npm`)

There are two ways to run the app: entirely in Docker (closer to the actual deployment) or in the local dev mode (backend/frontend directly on the host, only the DB in Docker — better for debugging).

## Option A: everything in Docker

```sh
cp .env.example .env   # once; adjust the values, set JWT_SECRET via `openssl rand -hex 32`
docker compose up --build
```

This starts three containers:

| Service        | URL/port               | Purpose                         |
|----------------|------------------------|---------------------------------|
| `fit-frontend` | http://localhost:8080  | Built frontend behind nginx (open this in the browser) |
| `fit-backend`  | http://localhost:3000  | Express API                     |
| `fit-db`       | localhost:5432 (bound to localhost only) | PostgreSQL    |

Then create a user (see [Managing users](#managing-users)) and log in at http://localhost:8080.

The frontend is built statically at image build time and served by nginx, which forwards `/api` to the backend. Frontend changes therefore need a rebuild (`docker compose up --build`). Locally the backend runs with the Dockerfile's `dev` target: `backend/src` and `backend/db` are bind-mounted, changes there trigger an automatic reload via `tsx watch`. The backend only needs a rebuild after changes to `package.json`, the Dockerfile or the CLI (`backend/src/cli`, which runs from the `dist/` compiled at build time).

```sh
docker compose down        # stop the containers, DB data (volume) is kept
docker compose down -v     # additionally delete all data
```

## Option B: local dev mode (recommended for development/debugging)

Install all dependencies once (backend + frontend as npm workspaces, one command in the project root installs both):

```sh
cp .env.example .env   # if not done yet
npm install
```

Then start:

```sh
npm run dev
```

The script (`scripts/dev.mjs`) does two things:
1. Checks whether the Postgres DB (`fit-db`) is running and starts it via Docker if needed (waits for "healthy").
2. Starts backend and frontend **locally** via `npm run dev --workspace=<backend|frontend>` (not in Docker) — i.e. `tsx watch` and Vite run directly with Node on the host, with full hot reload and debugger access (e.g. `node --inspect`, breakpoints in the IDE).

Then as usual: browser at http://localhost:5173, backend directly at http://localhost:3000/api/health.

Stop with `Ctrl+C` (stops backend/frontend; the DB keeps running in the background, `docker compose down` stops it if needed).

Options A and B share the same database, so created users work for both.

## Managing users

All commands run in the backend container. With the stack running (option A) via `exec`, otherwise (option B) via `docker compose run --rm fit-backend …`:

```sh
docker compose exec fit-backend npm run user:create                      # interactive, password without echo
docker compose exec fit-backend npm run user:create -- anna secret123    # non-interactive
docker compose exec fit-backend npm run user:list
docker compose exec fit-backend npm run user:set-password -- anna
docker compose exec fit-backend npm run user:delete -- anna              # asks for confirmation, --yes skips it
docker compose exec fit-backend npm run user:assign-data -- --from Default --to anna
```

- `user:create` creates the default training methods (interval set, ladder set, superset, circuit interval, high-intensity set) for the new user, `--no-seed` skips that. Passwords need at least 8 characters.
- `user:assign-data` moves all data (plans, exercises, training methods, weeks including sessions) to another user in one transaction. On conflicts (exercises with the same name, both users with an active week) it aborts without changes and lists the conflicts.
- `Default` is the user that owns all data that existed before the update to user management. It can't log in; `user:create -- <name> <password> --no-seed` followed by `user:assign-data -- --from Default --to <name>` takes over its data.

## Automated tests

```sh
npm test            # backend (vitest + supertest) and frontend tests (vitest + Testing Library)
npm run test:e2e    # Playwright E2E tests against the complete Docker stack
```

- The backend tests run against a separate test DB from `docker-compose.test.yml` (port 5433, data in tmpfs only). It is started automatically before the run, the dev DB stays untouched.
- The E2E tests first build the complete test stack from `docker-compose.test.yml` from scratch (prod images, frontend at http://localhost:8081), create the user `e2e` and log in once per run. Install the browsers once beforehand: `npx playwright install --with-deps chromium`.
- CI (`.github/workflows/ci.yml`) runs all three kinds of tests and then publishes the images on `main` (see [Deployment](#deployment)).

## Checking manually

- Open **http://localhost:5173** (dev mode) or **http://localhost:8080** (Docker) in the browser → login, then training, plans, exercises etc.
- Directly against the backend: `curl http://localhost:3000/api/health` → `{"status":"ok","db_time":"..."}` (reachable without login).
- All other API routes need the login cookie, e.g.:
  ```sh
  curl -c /tmp/fit-cookie -H 'Content-Type: application/json' -d '{"username":"anna","password":"secret123"}' http://localhost:3000/api/auth/login
  curl -b /tmp/fit-cookie http://localhost:3000/api/exercises
  ```
- Logs when something goes wrong: in Docker mode `docker compose logs -f fit-backend` or `fit-frontend`; in the local dev mode both logs show up directly (color-coded) in the terminal of `npm run dev`. Applied migrations should appear there when the backend starts (`migration applied: ...`).
- Check the database directly: `docker compose exec fit-db psql -U fit -d fit -c "select now();"`.

## Deployment

On every successful run on `main`, CI publishes two images:

- `ghcr.io/danielnagel/fit-backend` (Express API, applies pending migrations on startup)
- `ghcr.io/danielnagel/fit-frontend` (nginx with the built frontend, forwards `/api` to the backend)

Each tagged `latest` and with the commit SHA. A deployment additionally needs a PostgreSQL 16 database and a reverse proxy with TLS in front of the frontend.

Backend environment variables:

| Variable | Required | Meaning |
|---|---|---|
| `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` | yes | Database connection |
| `JWT_SECRET` | yes | Signs the login cookies, e.g. `openssl rand -hex 32`. The backend doesn't start without it. |
| `NODE_ENV=production` | behind TLS | Sets the `Secure` flag on the login cookie. Over plain http the browser then drops the cookie. |
| `TRUST_PROXY_HOPS` | behind proxies | Number of reverse proxies in front of the backend (e.g. `2` for TLS proxy + frontend nginx), so the login rate limit sees the real client IP. Default `0`. |
| `PORT` | no | Default `3000` |
| `MODE=demo` | no | Demo mode, see below |

Frontend environment variables:

| Variable | Meaning |
|---|---|
| `BACKEND_HOST` | Hostname of the backend that `/api` is forwarded to (port 3000). Default `fit-backend`. |

In a deployment, users are created via the CLI in the backend container as well (`npm run user:create` etc., see [Managing users](#managing-users)).

### Demo mode

With `MODE=demo` the login page additionally shows "Try the demo". Every click creates a separate user `demo-xxxxxx` with example data: the default training methods, six exercises, a plan with two training days, three completed weeks of history and a running week. Visitors don't see each other. Access expires after one hour; the backend deletes expired demo users including their data every five minutes. Each IP may create 20 demo accounts per hour. Use a separate instance with its own database for a public demo.

## Keeping dependencies up to date

```sh
npm run deps:check    # shows outdated packages in the root + all workspaces (npm-check-updates)
npm run deps:update   # bumps package.json versions and reinstalls
```

`deps:update` can also bump major versions (e.g. React 18 → 19) — after running it, quickly test with `npm run dev` that everything still works before committing.

## License

This project is licensed under the PolyForm Noncommercial License 1.0.0, see [`LICENSE`](LICENSE).
