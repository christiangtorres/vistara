# Vistara — Conference Badge Scanner

Next.js 14 + Supabase + Anthropic Claude vision, deployed on Vercel.

## Stack

- **Frontend / API**: Next.js 14 (App Router), TypeScript
- **DB**: Supabase Postgres (`contacts` table)
- **Storage**: Supabase Storage (private `badges` bucket)
- **AI**: Anthropic Claude (Opus 4.7) for badge OCR + company-guess
- **Auth**: shared-password cookie gate via `middleware.ts`

## One-time setup

### 1. Supabase
- Create a Supabase project.
- SQL Editor → paste & run [`supabase_migration.sql`](./supabase_migration.sql).
- Project Settings → API → copy the **Project URL**, **anon public key**, and **service_role key**.

### 2. Vercel
- Import this GitHub repo in Vercel.
- Project Settings → Environment Variables:
  - `APP_PASSWORD` = `vistara2026` (or whatever you pick — shared between you and your coworker)
  - `ANTHROPIC_API_KEY` = your Anthropic key
  - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase URL
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon key
  - `SUPABASE_SERVICE_ROLE_KEY` = service-role key (server only)
- Deploy.

### 3. Domain
Point `bluehostaitesting.com/vistara` at the Vercel project (or just use the Vercel-assigned `*.vercel.app` URL).

## Local dev

```
npm install
cp .env.example .env.local   # fill in real values
npm run dev
```

## Usage

- Visit the site, log in with your name + shared password.
- **Scan** tab → take a photo of the badge. Claude reads it, fills the form, and adds a guess at what the company does.
- Add your own notes, save.
- **Contacts** tab lists everyone you've scanned, with CSV export.

## Files

- `app/` — Next.js pages + API routes
- `lib/` — Supabase client + auth helpers
- `middleware.ts` — password gate
- `supabase_migration.sql` — schema + storage bucket
