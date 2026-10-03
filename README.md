# Fit

<p align="center">
  <img src="frontend/public/logo.svg" alt="Logo" width="96" height="96">
</p>

Fitness-Tracking-Web-App: Trainingspläne mit frei konfigurierbaren Trainingsmethoden erstellen, Trainings mit Timer durchführen, Historie/Fortschritt einsehen. Läuft komplett in Docker-Containern.

Zugriff nur mit Login. Jeder Benutzer hat eigene Übungen, Trainingsmethoden, Pläne und Historie. Benutzer werden ausschließlich per CLI angelegt (siehe [Benutzer verwalten](#benutzer-verwalten)), eine Registrierung gibt es nicht.

## Voraussetzungen

- Docker + Docker Compose (`docker compose version`)
- Node.js 24 (für den lokalen Dev-Modus und `npm`)

Es gibt zwei Arten, die App laufen zu lassen: komplett in Docker (näher am späteren Deployment) oder im lokalen Dev-Modus (Backend/Frontend direkt auf dem Host, nur die DB in Docker — besser zum Debuggen).

## Variante A: alles in Docker

```sh
cp .env.example .env   # einmalig, Werte anpassen, JWT_SECRET per `openssl rand -hex 32` setzen
docker compose up --build
```

Danach einen Benutzer anlegen (siehe [Benutzer verwalten](#benutzer-verwalten)) und auf http://localhost:8080 einloggen.

Danach laufen drei Container:

| Service        | URL/Port               | Zweck                          |
|-----------------|------------------------|---------------------------------|
| `fit-frontend`  | http://localhost:8080  | Gebautes Frontend hinter nginx (Browser hier öffnen) |
| `fit-backend`   | http://localhost:3000  | Express-API                     |
| `fit-db`        | localhost:5432 (nur lokal gebunden) | PostgreSQL            |

Das Frontend wird beim Build statisch gebaut und von nginx ausgeliefert, nginx leitet `/api` an das Backend weiter. Änderungen am Frontend brauchen deshalb einen Rebuild (`docker compose up --build`). Das Backend läuft lokal mit dem `dev`-Target des Dockerfiles: `backend/src` und `backend/db` sind per Bind-Mount eingehängt, Änderungen dort lösen per `tsx watch` automatisch einen Reload aus. Ein Rebuild ist beim Backend nur bei Änderungen an `package.json`, am Dockerfile oder an der CLI (`backend/src/cli`, läuft aus dem beim Build kompilierten `dist/`) nötig.

```sh
docker compose down        # Container stoppen, DB-Daten (Volume) bleiben erhalten
docker compose down -v     # zusätzlich alle Daten löschen
```

## Variante B: lokaler Dev-Modus (empfohlen zum Entwickeln/Debuggen)

Einmalig alle Abhängigkeiten installieren (Backend + Frontend als npm-Workspaces, ein Befehl im Projekt-Root installiert beides):

```sh
cp .env.example .env   # falls noch nicht vorhanden
npm install
```

Danach starten:

```sh
npm run dev
```

Das Skript (`scripts/dev.mjs`) macht zwei Dinge:
1. Prüft, ob die Postgres-DB (`fit-db`) läuft, und startet sie bei Bedarf via Docker (wartet auf "healthy").
2. Startet Backend und Frontend **lokal** per `npm run dev --workspace=<backend|frontend>` (nicht in Docker) — d. h. `tsx watch` bzw. Vite laufen direkt mit Node auf dem Host, mit vollem Hot Reload und Debugger-Zugriff (z. B. `node --inspect`, Breakpoints in der IDE).

Danach wie gewohnt: Browser auf http://localhost:5173, Backend direkt unter http://localhost:3000/api/health.

Beenden mit `Strg+C` (stoppt Backend/Frontend; die DB bleibt im Hintergrund laufen, `docker compose down` stoppt sie bei Bedarf).

Variante A und B teilen sich dieselbe Datenbank, angelegte Benutzer gelten also für beide.

## Benutzer verwalten

Alle Befehle laufen im Backend-Container. Bei laufendem Stack (Variante A) per `exec`, sonst (Variante B) per `docker compose run --rm fit-backend …`:

```sh
docker compose exec fit-backend npm run user:create                      # interaktiv, Passwort ohne Echo
docker compose exec fit-backend npm run user:create -- anna geheim123    # nicht interaktiv
docker compose exec fit-backend npm run user:list
docker compose exec fit-backend npm run user:set-password -- anna
docker compose exec fit-backend npm run user:delete -- anna              # fragt nach, --yes überspringt das
docker compose exec fit-backend npm run user:assign-data -- --from Default --to anna
```

- `user:create` legt für den neuen Benutzer die Standard-Trainingsmethoden an (Intervallsatz, Stufensatz, …), `--no-seed` lässt das weg. Passwörter brauchen mindestens 8 Zeichen.
- `user:assign-data` überträgt alle Daten (Pläne, Übungen, Trainingsmethoden, Wochen samt Sessions) in einer Transaktion auf einen anderen Benutzer. Bei Konflikten (gleichnamige Übungen, beide mit aktiver Woche) bricht es ohne Änderungen ab und listet die Konflikte auf.
- `Default` ist der Benutzer, dem nach dem Update auf die Benutzerverwaltung alle bis dahin vorhandenen Daten gehören. Er kann sich nicht einloggen; mit `user:create -- <name> <passwort> --no-seed` und `user:assign-data -- --from Default --to <name>` übernimmt man seine Daten.

## Automatisierte Tests

```sh
npm test            # Backend- (vitest + supertest) und Frontend-Tests (vitest + Testing Library)
npm run test:e2e    # Playwright-E2E-Tests gegen den kompletten Docker-Stack
```

- Die Backend-Tests laufen gegen eine eigene Test-DB aus `docker-compose.test.yml` (Port 5433, Daten nur im tmpfs). Sie wird vor dem Lauf automatisch gestartet, die Dev-DB bleibt unberührt.
- Die E2E-Tests bauen vorher den kompletten Test-Stack aus `docker-compose.test.yml` frisch auf (Prod-Images, Frontend auf http://localhost:8081), legen den Benutzer `e2e` an und loggen sich einmal pro Lauf ein. Einmalig vorher die Browser installieren: `npx playwright install --with-deps chromium`.
- Die CI (`.github/workflows/ci.yml`) führt alle drei Testarten aus und veröffentlicht auf `main` danach die Images (siehe [Deployment](#deployment)).

## Manuell prüfen

- Browser auf **http://localhost:5173** (Dev-Modus) bzw. **http://localhost:8080** (Docker) öffnen → Login, danach Training, Pläne, Übungen usw.
- Direkt gegen das Backend: `curl http://localhost:3000/api/health` → `{"status":"ok","db_time":"..."}` (ohne Login erreichbar).
- Alle anderen API-Routen brauchen das Login-Cookie, z. B.:
  ```sh
  curl -c /tmp/fit-cookie -H 'Content-Type: application/json' -d '{"username":"anna","password":"geheim123"}' http://localhost:3000/api/auth/login
  curl -b /tmp/fit-cookie http://localhost:3000/api/exercises
  ```
- Logs bei Problemen: im Docker-Modus `docker compose logs -f fit-backend` bzw. `fit-frontend`; im lokalen Dev-Modus stehen beide Logs direkt (farblich getrennt) im Terminal von `npm run dev`. Beim Backend-Start sollten dort angewendete Migrationen auftauchen (`migration applied: ...`).
- Datenbank direkt prüfen: `docker compose exec fit-db psql -U fit -d fit -c "select now();"`.

## Deployment

Die CI veröffentlicht bei jedem erfolgreichen Lauf auf `main` zwei Images:

- `ghcr.io/danielnagel/fit-backend` (Express-API, führt beim Start ausstehende Migrationen aus)
- `ghcr.io/danielnagel/fit-frontend` (nginx mit dem gebauten Frontend, leitet `/api` an das Backend weiter)

Jeweils mit den Tags `latest` und dem Commit-SHA. Für ein eigenes Deployment braucht es dazu eine PostgreSQL-16-Datenbank und einen Reverse-Proxy mit TLS vor dem Frontend.

Umgebungsvariablen des Backends:

| Variable | Pflicht | Bedeutung |
|---|---|---|
| `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` | ja | Verbindung zur Datenbank |
| `JWT_SECRET` | ja | Signiert die Login-Cookies, z. B. `openssl rand -hex 32`. Ohne startet das Backend nicht. |
| `NODE_ENV=production` | hinter TLS | Setzt das `Secure`-Flag am Login-Cookie. Über plain http verwirft der Browser das Cookie dann. |
| `TRUST_PROXY_HOPS` | hinter Proxies | Anzahl Reverse-Proxies vor dem Backend (z. B. `2` für TLS-Proxy + Frontend-nginx), damit das Login-Rate-Limit die echte Client-IP sieht. Default `0`. |
| `PORT` | nein | Default `3000` |
| `MODE=demo` | nein | Demo-Modus, siehe unten |

Umgebungsvariablen des Frontends:

| Variable | Bedeutung |
|---|---|
| `BACKEND_HOST` | Hostname des Backends, an den `/api` weitergeleitet wird (Port 3000). Default `fit-backend`. |

Benutzer werden auch im Deployment per CLI im Backend-Container angelegt (`npm run user:create` usw., siehe [Benutzer verwalten](#benutzer-verwalten)).

### Demo-Modus

Mit `MODE=demo` zeigt die Login-Seite zusätzlich „Demo ausprobieren“. Jeder Klick legt einen eigenen Benutzer `demo-xxxxxx` mit Beispieldaten an: Standard-Trainingsmethoden, sechs Übungen, ein Plan mit zwei Trainingstagen, drei abgeschlossene Wochen Historie und eine laufende Woche. Besucher sehen sich gegenseitig nicht. Nach einer Stunde läuft der Zugang ab; das Backend löscht abgelaufene Demo-Benutzer samt Daten alle fünf Minuten. Pro IP sind 20 Demo-Zugänge pro Stunde erlaubt. Für eine öffentliche Demo eine eigene Instanz mit eigener Datenbank verwenden.

## Dependencies aktuell halten

```sh
npm run deps:check    # zeigt veraltete Pakete in Root + allen Workspaces (npm-check-updates)
npm run deps:update    # hebt package.json-Versionen an und installiert neu
```

`deps:update` kann auch Major-Versionen anheben (z. B. React 18 → 19) — nach dem Lauf kurz `npm run dev` testen, ob noch alles läuft, bevor man committet.

## Lizenz

Dieses Projekt steht unter der PolyForm Noncommercial License 1.0.0, siehe [`LICENSE`](LICENSE).
