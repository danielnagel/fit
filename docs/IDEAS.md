# Ideas for later

> Collection point for ideas that aren't assigned to a fixed milestone (yet). No pressure to implement — only fleshed out when needed.

- **Ad-hoc activities** (formerly M6). `ad_hoc_activities`, multipart photo upload (multer, upload volume), form + display in the history. Not a blocker for other ideas/milestones.
- **Photo import via Claude Vision** (formerly M7). The backend calls the Anthropic API with the image + JSON schema structured output, `POST /api/plans/import-image`, upload UI with `<input type="file" accept="image/*" capture="environment">` (covers photo + file upload on every device), pre-fills the form from M3, manual entry always stays available. `ANTHROPIC_API_KEY` in `.env`. Not a blocker for M8.
- **Interfaces to other applications.** Connecting external training apps/devices, first the Garmin training watch via the [Garmin Activity API](https://developer.garmin.com/gc-developer-program/activity-api/). Probably only interesting for listing Garmin activities in the history as well (read-only import), not as a separate ad-hoc activity source with write-back.
