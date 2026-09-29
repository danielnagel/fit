# Fit

<p align="center">
  <img src="frontend/public/logo.svg" alt="Logo" width="96" height="96">
</p>

Fitness-Tracking-Web-App: Trainingspläne mit frei konfigurierbaren Trainingsmethoden erstellen, Trainings mit Timer durchführen, Historie/Fortschritt einsehen. Läuft komplett in Docker-Containern.

## Voraussetzungen

- Docker + Docker Compose (`docker compose version`)
- Node.js (für den lokalen Dev-Modus und `npm`) — Version siehe `node --version`, getestet mit Node 22

Es gibt zwei Arten, die App laufen zu lassen: komplett in Docker (näher am späteren Deployment) oder im lokalen Dev-Modus (Backend/Frontend direkt auf dem Host, nur die DB in Docker — besser zum Debuggen).

## Variante A: alles in Docker

```sh
cp .env.example .env   # einmalig, Werte bei Bedarf anpassen
docker compose up --build
```

Danach laufen drei Container:

| Service        | URL/Port               | Zweck                          |
|-----------------|------------------------|---------------------------------|
| `fit-frontend`  | http://localhost:8080  | Gebautes Frontend hinter nginx (Browser hier öffnen) |
| `fit-backend`   | http://localhost:3000  | Express-API                     |
| `fit-db`        | http://localhost:5432  | PostgreSQL                      |

Das Frontend wird beim Build statisch gebaut und von nginx ausgeliefert, nginx leitet `/api` an das Backend weiter. Änderungen am Frontend brauchen deshalb einen Rebuild (`docker compose up --build`). Beim Backend sind `backend/src` und `backend/db` per Bind-Mount eingehängt, Änderungen dort lösen per `tsx watch` automatisch einen Reload aus. Ein Rebuild ist beim Backend nur bei Änderungen an `package.json` oder am Dockerfile nötig.

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

## Automatisierte Tests

```sh
npm test            # Backend- (vitest + supertest) und Frontend-Tests (vitest + Testing Library)
npm run test:e2e    # Playwright-E2E-Tests gegen den kompletten Docker-Stack
```

- Die Backend-Tests laufen gegen eine eigene Test-DB aus `docker-compose.test.yml` (Port 5433, Daten nur im tmpfs). Sie wird vor dem Lauf automatisch gestartet, die Dev-DB bleibt unberührt.
- Die E2E-Tests bauen vorher den kompletten Test-Stack aus `docker-compose.test.yml` frisch auf (Frontend auf http://localhost:8081). Einmalig vorher die Browser installieren: `npx playwright install --with-deps chromium`.

## Manuell prüfen

- Browser auf **http://localhost:5173** (Dev-Modus) bzw. **http://localhost:8080** (Docker) öffnen → Seite zeigt Übungen und Trainingspläne.
- Direkt gegen das Backend: `curl http://localhost:3000/api/health` → `{"status":"ok","db_time":"..."}`.
- Übungskatalog: im Browser unter "Übungen" eine Übung anlegen (erscheint sofort in der Liste), oder direkt `curl http://localhost:3000/api/exercises`.
- Logs bei Problemen: im Docker-Modus `docker compose logs -f fit-backend` bzw. `fit-frontend`; im lokalen Dev-Modus stehen beide Logs direkt (farblich getrennt) im Terminal von `npm run dev`. Beim Backend-Start sollten dort angewendete Migrationen auftauchen (`migration applied: ...`).
- Datenbank direkt prüfen: `docker compose exec fit-db psql -U fit -d fit -c "select now();"`.

## Dependencies aktuell halten

```sh
npm run deps:check    # zeigt veraltete Pakete in Root + allen Workspaces (npm-check-updates)
npm run deps:update    # hebt package.json-Versionen an und installiert neu
```

`deps:update` kann auch Major-Versionen anheben (z. B. React 18 → 19) — nach dem Lauf kurz `npm run dev` testen, ob noch alles läuft, bevor man committet.

## Lizenz

Dieses Projekt steht unter der PolyForm Noncommercial License 1.0.0, siehe [`LICENSE`](LICENSE).
