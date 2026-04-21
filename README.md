# Crypto + Institutional Finance Calendar

Small static app for tracking major crypto, central bank, macro, and banking events across 2026 and 2027.

## What it does

- Month-by-month calendar view
- Quarter planning view
- Category filters
- Search across titles, notes, and locations
- Built-in event editor for adjusting dates
- Optional shared Supabase backend for team-wide live edits
- Import and export JSON for sharing revisions
- Seed data that mixes confirmed dates with clearly labeled estimated placeholders
- Canonical repo-backed `events.json` for durable event data

## Run it locally

Because the app uses ES modules, serve it over a simple local web server instead of opening `index.html` directly.

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Editing the calendar

There are two easy ways to update dates:

1. Use the in-app editor and then export the JSON.
2. Edit [`data/events.js`](/Users/bennettholloway/Documents/New project/data/events.js) directly if you want source-controlled changes.
3. Use [`events.json`](/Users/bennettholloway/Documents/New project/events.json) as the repo-backed canonical data file for deployed/shared versions.

## Permanent event updates

The app now treats [`events.json`](/Users/bennettholloway/Documents/New project/events.json) as the canonical event dataset when it is available.

- All views render from the same canonical event list.
- Browser edits still cache locally right away.
- If you configure a GitHub token in browser local storage under `github_token`, edits can be written back to `events.json` in the GitHub repo.
- If Supabase is configured, Supabase remains the higher-priority shared backend.

## Enable shared team editing with Supabase

The app now supports a shared Supabase table so colleagues see the same data.

### 1. Create a Supabase project

Create a project in [Supabase](https://supabase.com/).

### 2. Create the table and policies

Run the SQL in [`supabase/schema.sql`](/Users/bennettholloway/Documents/New project/supabase/schema.sql) in the Supabase SQL editor.

This creates:

- a `calendar_events` table
- an `updated_at` trigger
- row-level security policies for read/write access

Important:

- The included policies allow `anon` clients to read and write.
- That is convenient for an internal shared app, but it is intentionally open.
- If you want tighter control later, switch the policies to `authenticated` users only.

### 3. Add your project settings

Open [`config.js`](/Users/bennettholloway/Documents/New project/config.js) and fill in:

```js
export const calendarConfig = {
  backend: {
    provider: "supabase",
    projectUrl: "https://YOUR-PROJECT.supabase.co",
    anonKey: "YOUR-ANON-KEY",
    table: "calendar_events"
  }
};
```

You can find the project URL and anon key in Supabase project settings under API.

### 4. Start the app

```bash
python3 -m http.server 8000
```

The first time the app connects to an empty table, it uploads the seed calendar automatically.

## How syncing works

- If `config.js` is blank, the app stays in local-only mode.
- If Supabase is configured, the app loads shared events from the database.
- Creating, editing, deleting, or importing events writes them to Supabase.
- `Sync now` refreshes the calendar from the shared table.

## Seed data notes

- Confirmed 2026 and 2027 FOMC dates come from the Federal Reserve meeting calendar.
- Confirmed 2026 ECB dates come from the ECB Governing Council schedule.
- Confirmed 2026 IMF / World Bank, Sibos, Bitcoin, TOKEN2049, ETHDenver, Paris Blockchain Week, and Breakpoint dates come from organizer sites.
- Several 2027 crypto and macro events are intentionally marked `estimated` because official organizer dates were not yet published when this app was seeded.

## Sharing with colleagues

You can share this as:

- A zipped folder they run locally
- A static site on GitHub Pages, Netlify, Vercel, or an internal web server
- A shared internal folder plus exported JSON updates

For the Supabase version, the easiest setup is to host this static app internally and point everyone at the same deployed site.
