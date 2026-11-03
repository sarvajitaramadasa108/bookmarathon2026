# Book Marathon 2026

Standalone English/Telugu registration site for Hare Krishna Vaikuntham Cultural Centre, Visakhapatnam.

## Run

Requires **Node.js 24+**. There are no third-party runtime dependencies or build step.

```sh
npm start
```

Open http://localhost:3026. `npm run dev` restarts the server when files change. `npm test` runs validation, persistence, idempotency, API and security tests with isolated test databases.

## Included

- Marathon: 23 November 2026–31 January 2027; orientation: 15 November 2026.
- Complete English/Telugu language switch, including field errors and submission states. Switching preserves entered values. Only the language preference is saved in browser storage.
- Supplied posters and 2023–2025 book distribution charts. 2023 medium books are **64 (estimated)**: `round(161 × 161 / 404)`. Every other category value is transcribed from the supplied screenshots. The inconsistent overall totals are not displayed.
- Name, Indian mobile number, age, gender, area, devotee contact, participation, and contact consent.
- Participation: every day full day, every day evenings, or weekends.
- 22 canonical devotee names copied from `HkmVizagTech/pancajanya-app`, `lib/views/distributor/profile_form_screen.dart`, `_guideAndPreacherOptions`, source blob `2edc4620f77c3969eafcf21707030de284c33da3`. Telugu display labels retain the English canonical values for storage.
- Server-side validation, prepared SQL statements, durable SQLite storage and retry-safe registration references.

This is an independent application. It makes **no requests or writes** to Panchajanya, the ERP backend or its frontend. No shared credentials are needed.

## Storage and hosting

Registrations are saved in `data/registrations.sqlite` on the server, outside the public directory and excluded from Git. The server returns a success message only after the database insert succeeds. There is no public registration-list or export endpoint.

The repository now deploys as a static Vercel site: `public/` is copied to `dist/` during the build. Registration validation and the confirmation screen run in the browser; no backend or Vercel function is required for the simple form.

Environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3026` | HTTP port |
| `HOST` | `127.0.0.1` | Bind address; use `0.0.0.0` inside a container |
| `DB_PATH` | `<repo>/data/registrations.sqlite` | Durable SQLite file path |
| `PUBLIC_ORIGIN` | Same host as request | Exact production origin, e.g. `https://marathon.example.org` |

Terminate HTTPS at your hosting platform/reverse proxy. Back up the database and its WAL safely, e.g. using SQLite's online backup tooling. Restrict operator access to the data directory. The API rate limit is 20 POST attempts per actual peer IP per 10 minutes. Behind a shared reverse proxy, configure visitor rate limiting at the proxy and adapt the server limit before a large public launch; untrusted forwarding headers are intentionally ignored.

Google Fonts is optional; bundled system font fallbacks keep the page usable when unavailable. All supplied imagery is served locally. Confirmation references confirm registration only; this app does not send SMS or WhatsApp messages.

## Export for organizers

Run locally on the server as an authorized operator:

```sh
node export.mjs > registrations.csv
```

The UTF-8 CSV includes the supplied personal details, participation and reference, with spreadsheet formula protection. Keep exports private. `DB_PATH` is honored. Run `node export.mjs` directly (not `npm run export > file`) when redirecting so npm banners do not contaminate the CSV.

## Repository scope

All application changes belong to `sarvajitaramadasa108/bookmarathon2026`. Other project repositories are read-only references, and are neither dependencies nor deployment targets.
