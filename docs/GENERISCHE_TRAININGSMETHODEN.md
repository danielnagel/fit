# Generische Trainingsmethoden — Konzept & Umsetzungsplan

> Referenz-Dokument, entstanden aus einer Konzept-Diskussion am 2026-07-23. Beschreibt, wie die vormals fest codierten Trainingsmethoden (`plan_days.type`) durch ein generisches, vom Nutzer erweiterbares System ersetzt wurden. Umgesetzt als Meilenstein **M6**.

## Motivation

Der Nutzer möchte eigene Trainingsmethoden definieren können (z. B. klassische Studio-Sätze mit fester Pause, Warmup-/Cooldown-Blöcke), nicht nur die 5 vordefinierten. Die Software liefert dafür nur den Mechanismus, die konkreten Methoden sind konfigurierbare Daten.

## Das Modell: 4 Dimensionen

Gegen alle 5 bestehenden Methoden sowie zusätzliche Praxisfälle (klassischer Fitnessstudio-Satz, Warmup/Cooldown) durchgespielt — vier Dimensionen reichen aus, keine dynamischen Spalten/kein rohes SQL nötig:

| Dimension | Werte | Bedeutung |
|---|---|---|
| **Scope** | `single` / `pair` / `all` | wie viele Übungen bilden eine Einheit: eine Übung (Interval, Ladder, HIIT, klassischer Satz), ein festes Paar (Superset), alle Übungen des Blocks zusammen als eine Runde (Circuit) |
| **Timing-Familie** | `fixed-window-remainder` / `fixed-work-rest` / `self-paced` | wie Arbeits-/Pausendauer bestimmt werden (Details unten) |
| **Rest-Formel** (nur bei `self-paced`) | `proportional` (Faktor × gemessene Vorgänger-Dauer) / `fixed` (konstanter Wert) | Ladder: proportional, Faktor 1,0. Circuit (neu gedacht): proportional, Faktor 0,5. Klassischer Studio-Satz: fixed, z. B. 60s |
| **Stop-Bedingung** | `fixed-count` / `time-budget` / `all-exercises-done` | feste Rundenzahl (Interval, HIIT, Superset), Zeitbudget mit Kulanz zum Beenden der laufenden Einheit (Ladder, Circuit), oder kein Timer — fertig wenn alle Übungen erledigt sind (klassischer Studio-Durchlauf; macht die Zeitfelder optional) |
| **Reps-Range je Übung** | `reps_min`/`reps_max` (optional) | Ziel-Wiederholungsband, bereits heute in `plan_day_exercises` vorhanden; im Plan-Formular nur bei `fixed-window-remainder`/`fixed-work-rest` abfragbar — bei `self-paced` (Ladder, Circuit, klassischer Studio-Satz) ergibt sich die tatsächliche Wiederholungszahl erst beim Training, ein Ziel-Band beim Planen ergibt dort keinen Sinn |

### Mapping der 5 bestehenden Methoden

| Methode | Scope | Timing-Familie | Rest-Formel | Stop-Bedingung | Reps-Range |
|---|---|---|---|---|---|
| Interval | single | fixed-window-remainder | – | fixed-count (3) | 6–12 |
| Ladder | single | self-paced | proportional ×1,0 | time-budget (7,5 Min) | keine |
| Superset | pair | fixed-window-remainder | – | fixed-count (2) | 1–5 / 6–12 |
| Circuit | all | self-paced | proportional ×0,5 | time-budget (20 Min) | je Übung individuell |
| HIIT | single | fixed-work-rest | – | fixed-count (8) | keine |

Zusätzlich abgedeckt, ohne neue Dimension:
- **Klassischer Studio-Satz** (3×6–12, feste 1 Min Pause): single / self-paced / rest_formula=fixed(60s) / all-exercises-done.
- **Warmup/Cooldown** (z. B. 8 Min gehen): single / fixed-work-rest mit `rounds=1`, `rest_seconds=0` — keine neue Logik, nur diese Parameterwerte.

## Datenmodell

Das Projekt hatte dieses Blöcke-Konzept bereits einmal (`0005_plan_blocks.sql`: `plan_days → plan_blocks → plan_block_exercises`), es wurde in `0006_day_is_block.sql` wieder eingestampft, weil ein Block pro Tag damals ausreichte (Kommentar: *"Ein Trainingstag besteht aus genau einem Block eines Typs... Block-Ebene entfällt"*). Der jetzige Plan kehrt das um — diesmal generisch statt mit festem Typ-Enum, und mit mehreren Blöcken pro Tag (Warmup + Hauptteil + Cooldown in einem Trainingstag).

- **`training_methods`** (Katalog, wiederverwendbar über beliebig viele Pläne/Tage): `id`, `name`, `scope`, `timing_family`, Timing-Parameter (je nach Familie: Fenstergröße, oder Rest-Formel-Typ + Faktor/Konstante, oder Arbeits-/Pausendauer), `stop_condition`, Stop-Parameter (Rundenzahl oder Zeitbudget-Sekunden). Die 5 heutigen Methoden werden zu fünf Katalog-Zeilen; custom Methoden kommen über den Layout-Designer als weitere Zeilen dazu.
- **`plan_blocks`** (Instanz, pro Trainingstag): `id`, `plan_day_id`, `block_order`, `training_method_id` (FK).
- **`plan_block_exercises`** (Nachfolger von `plan_day_exercises`): `id`, `plan_block_id` (FK statt `plan_day_id`), `exercise_id`, `exercise_order`, `reps_min`, `reps_max`, `note`.
- **`plan_days`** verliert `type`/`rounds`/`rest_seconds`/`round_duration_seconds`/`work_seconds`/`total_duration_seconds` — die wandern in `training_methods`/`plan_blocks`. `plan_days` bleibt nur noch Name + Reihenfolge im Wochenzyklus.

### Migrationssicherheit

Bestehende, bereits konfigurierte Pläne dürfen dabei nicht verloren gehen:
- Migrationsskript erzeugt für jeden bestehenden `plan_days`-Datensatz genau einen `training_methods`-Eintrag (mit den heutigen Werten) und genau einen `plan_blocks`-Eintrag, der darauf verweist.
- Bestehende `plan_day_exercises`-Zeilen werden auf den neuen Block umgehängt (`plan_block_id` statt `plan_day_id`).
- Abgeschlossene Trainingseinheiten (`training_sessions.day_snapshot`, `logged_sets`) sind komplett unberührt — die liegen als eingefrorenes JSON zum Session-Start-Zeitpunkt vor und hängen nicht live am Plan-Schema.
- Ergebnis: direkt nach der Migration verhält sich jeder bestehende Plan exakt wie vorher (ein Tag = ein Block mit den bisherigen Übungen), zusätzlich sind mehrere Blöcke pro Tag möglich.

### Rekord-/Vergleichslogik generalisieren

Die kürzlich gebaute `ladder_records`-Logik (`MAX(unit_index)` je Übung, siehe `sessions.ts`) und `previous_logged_sets` (letztes Mal an derselben Position) sind bereits allgemein genug — sie müssen nur pro `training_method` wissen, ob "Rekord" `max(reps an Position X)`, `max(unit_index erreicht)` oder beides bedeutet, statt hart auf `type === 'ladder'` zu prüfen.

## Backend-Anpassungen (grob)

- CRUD für `training_methods` (Grundlage für den Layout-Designer).
- Plan-CRUD (`PUT /api/plans/:id`) muss verschachtelte Blöcke statt eines einzelnen Typs pro Tag speichern/liefern.
- `buildDaySnapshot` (in `sessions.ts`) snapshotet künftig eine Liste von Blöcken (je mit Methode + Übungen) statt eines einzelnen Typs.

## Frontend-Anpassungen (grob)

- **Layout-Designer**: geführtes Formular für die 4 Dimensionen (Auswahlfelder/Zahlen), kein Freitext-DSL, kein rohes SQL.
- **Ein generischer Runner** (ggf. eine Handvoll Varianten je Timing-Familie) ersetzt die 5 heute fest programmierten Komponenten (`IntervalRunner`, `LadderRunner`, `SupersetRunner`, `CircuitRunner`, `HiitRunner`) — er interpretiert die 4 Dimensionen eines Blocks zur Laufzeit, statt per `type`-String auf feste Komponenten zu verzweigen. Notwendig, weil custom Methoden keine vorprogrammierte Komponente haben, auf die verzweigt werden könnte.
- `PlanForm.tsx` muss Blöcke pro Tag statt eines einzelnen Typs editieren können.

## Noch offen / nicht Teil dieses Plans

- Exaktes UI-Design des Layout-Designers.
- Genaue Feld-/Tabellennamen sind Vorschläge, keine finalen Festlegungen.

## Vorgeschlagene Umsetzungsschritte

- [x] **Schema-Migration** — `training_methods`, `plan_blocks`, `plan_block_exercises` anlegen; Datenmigration bestehender `plan_days` (automatischer Wrap in je einen Katalog-Eintrag + Block, s. o.); `plan_days` um die alten Typ-Felder bereinigen.
- [x] **Backend** — CRUD für `training_methods`; Plan-API auf Blöcke umgestellt; `buildDaySnapshot`/`loadSessionDetail` auf Block-Struktur umgestellt; Rekord-/Vergleichslogik generalisiert.
- [x] **Frontend: generischer Runner** — ersetzt die 5 festen Runner-Komponenten, interpretiert die 4 Dimensionen zur Laufzeit.
- [x] **Frontend: Layout-Designer** — UI zum Anlegen/Bearbeiten eigener Methoden im Katalog.
- [x] **Frontend: `PlanForm.tsx`** — Blöcke pro Tag statt einzelnem Typ editierbar machen.
- [x] **Doku** — an das neue Modell anpassen.
