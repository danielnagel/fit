# Ideen für später

> Sammelstelle für Ideen, die (noch) keinem festen Meilenstein zugeordnet sind. Kein Umsetzungsdruck — wird nur bei Bedarf konkretisiert.

- **Ad-hoc-Aktivitäten** (ehem. M6). `ad_hoc_activities`, Multipart-Foto-Upload (multer, Upload-Volume), Formular + Anzeige in der Historie. Kein Blocker für andere Ideen/Meilensteine.
- **Foto-Import via Claude Vision** (ehem. M7). Backend ruft Anthropic API mit Bild + JSON-Schema-Structured-Output auf, `POST /api/plans/import-image`, Upload-UI mit `<input type="file" accept="image/*" capture="environment">` (deckt Foto + Datei-Upload auf jedem Gerät ab), befüllt Formular aus M3 vor, manuelle Eingabe bleibt immer nutzbar. `ANTHROPIC_API_KEY` in `.env`. Kein Blocker für M8.
- **Schnittstellen zu anderen Applikationen.** Anbindung externer Trainings-Apps/Geräte, als erstes die Garmin-Trainingsuhr über die [Garmin Activity API](https://developer.garmin.com/gc-developer-program/activity-api/). Vermutlich nur interessant, um Garmin-Aktivitäten mit in der Historie aufzulisten (Read-only-Import), nicht als eigene Ad-hoc-Aktivitäts-Quelle mit Rückschreiben.
