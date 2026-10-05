# Generic training methods — concept & implementation plan

> Reference document, written after a concept discussion on 2026-07-23. Describes how the formerly hard-coded training methods (`plan_days.type`) were replaced by a generic system the user can extend. Implemented as milestone **M6**.

## Motivation

The user wants to be able to define their own training methods (e.g. classic gym sets with a fixed rest, warmup/cooldown blocks), not just the 5 predefined ones. The software only provides the mechanism for this, the concrete methods are configurable data.

## The model: 4 dimensions

Played through against all 5 existing methods plus additional real-world cases (classic gym set, warmup/cooldown) — four dimensions are enough, no dynamic columns/no raw SQL needed:

| Dimension | Values | Meaning |
|---|---|---|
| **Scope** | `single` / `pair` / `all` | how many exercises form a unit: one exercise (interval, ladder, HIIT, classic set), a fixed pair (superset), all exercises of the block together as one round (circuit) |
| **Timing family** | `fixed-window-remainder` / `fixed-work-rest` / `self-paced` | how work/rest durations are determined (details below) |
| **Rest formula** (only for `self-paced`) | `proportional` (factor × measured duration of the previous set) / `fixed` (constant value) | Ladder: proportional, factor 1.0. Circuit (reworked): proportional, factor 0.5. Classic gym set: fixed, e.g. 60s |
| **Stop condition** | `fixed-count` / `time-budget` / `all-exercises-done` | fixed number of rounds (interval, HIIT, superset), time budget with grace for finishing the running unit (ladder, circuit), or no timer — done when all exercises are done (classic gym workout; makes the time fields optional) |
| **Rep range per exercise** | `reps_min`/`reps_max` (optional) | target rep range, already present in `plan_day_exercises` today; only asked for in the plan form with `fixed-window-remainder`/`fixed-work-rest` — with `self-paced` (ladder, circuit, classic gym set) the actual rep count only emerges during the training, a target range at planning time makes no sense there |

### Mapping of the 5 existing methods

| Method | Scope | Timing family | Rest formula | Stop condition | Rep range |
|---|---|---|---|---|---|
| Interval | single | fixed-window-remainder | – | fixed-count (3) | 6–12 |
| Ladder | single | self-paced | proportional ×1.0 | time-budget (7.5 min) | none |
| Superset | pair | fixed-window-remainder | – | fixed-count (2) | 1–5 / 6–12 |
| Circuit | all | self-paced | proportional ×0.5 | time-budget (20 min) | individual per exercise |
| HIIT | single | fixed-work-rest | – | fixed-count (8) | none |

Additionally covered, without a new dimension:
- **Classic gym set** (3×6–12, fixed 1 min rest): single / self-paced / rest_formula=fixed(60s) / all-exercises-done.
- **Warmup/cooldown** (e.g. 8 min walking): single / fixed-work-rest with `rounds=1`, `rest_seconds=0` — no new logic, just these parameter values.

## Data model

The project already had this block concept once (`0005_plan_blocks.sql`: `plan_days → plan_blocks → plan_block_exercises`), it was dropped again in `0006_day_is_block.sql` because one block per day was enough at the time (comment: *"A training day consists of exactly one block of one type... the block level goes away"*). The current plan reverses that — this time generic instead of with a fixed type enum, and with several blocks per day (warmup + main part + cooldown in one training day).

- **`training_methods`** (catalog, reusable across any number of plans/days): `id`, `name`, `scope`, `timing_family`, timing parameters (depending on the family: window size, or rest formula type + factor/constant, or work/rest duration), `stop_condition`, stop parameters (number of rounds or time budget in seconds). Today's 5 methods become five catalog rows; custom methods are added as further rows via the layout designer.
- **`plan_blocks`** (instance, per training day): `id`, `plan_day_id`, `block_order`, `training_method_id` (FK).
- **`plan_block_exercises`** (successor of `plan_day_exercises`): `id`, `plan_block_id` (FK instead of `plan_day_id`), `exercise_id`, `exercise_order`, `reps_min`, `reps_max`, `note`.
- **`plan_days`** loses `type`/`rounds`/`rest_seconds`/`round_duration_seconds`/`work_seconds`/`total_duration_seconds` — they move into `training_methods`/`plan_blocks`. `plan_days` only keeps the name + position in the weekly cycle.

### Migration safety

Existing, already configured plans must not be lost in the process:
- The migration script creates exactly one `training_methods` entry (with today's values) and exactly one `plan_blocks` entry pointing at it for every existing `plan_days` row.
- Existing `plan_day_exercises` rows are moved to the new block (`plan_block_id` instead of `plan_day_id`).
- Completed training sessions (`training_sessions.day_snapshot`, `logged_sets`) are completely untouched — they exist as JSON frozen at session start and aren't tied live to the plan schema.
- Result: right after the migration every existing plan behaves exactly as before (one day = one block with the previous exercises), and several blocks per day become possible.

### Generalizing the record/comparison logic

The recently built `ladder_records` logic (`MAX(unit_index)` per exercise, see `sessions.ts`) and `previous_logged_sets` (last time at the same position) are already general enough — they only need to know per `training_method` whether "record" means `max(reps at position X)`, `max(unit_index reached)` or both, instead of checking hard for `type === 'ladder'`.

## Backend changes (rough)

- CRUD for `training_methods` (basis for the layout designer).
- Plan CRUD (`PUT /api/plans/:id`) has to store/return nested blocks instead of a single type per day.
- `buildDaySnapshot` (in `sessions.ts`) will snapshot a list of blocks (each with method + exercises) instead of a single type.

## Frontend changes (rough)

- **Layout designer**: guided form for the 4 dimensions (select fields/numbers), no free-text DSL, no raw SQL.
- **One generic runner** (possibly a handful of variants per timing family) replaces the 5 components hard-coded today (`IntervalRunner`, `LadderRunner`, `SupersetRunner`, `CircuitRunner`, `HiitRunner`) — it interprets a block's 4 dimensions at runtime instead of branching to fixed components via a `type` string. Necessary because custom methods have no pre-programmed component that could be branched to.
- `PlanForm.tsx` has to be able to edit blocks per day instead of a single type.

## Still open / not part of this plan

- Exact UI design of the layout designer.
- The exact field/table names are suggestions, not final decisions.

## Proposed implementation steps

- [x] **Schema migration** — create `training_methods`, `plan_blocks`, `plan_block_exercises`; data migration of existing `plan_days` (automatic wrap into one catalog entry + block each, see above); clean the old type fields out of `plan_days`.
- [x] **Backend** — CRUD for `training_methods`; plan API switched to blocks; `buildDaySnapshot`/`loadSessionDetail` switched to the block structure; record/comparison logic generalized.
- [x] **Frontend: generic runner** — replaces the 5 fixed runner components, interprets the 4 dimensions at runtime.
- [x] **Frontend: layout designer** — UI for creating/editing custom methods in the catalog.
- [x] **Frontend: `PlanForm.tsx`** — make blocks per day editable instead of a single type.
- [x] **Docs** — adapt to the new model.
