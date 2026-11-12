# Puskola

Online Sinhala library: Next.js (App Router) + Supabase.

## Run locally
1. Create `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_KEY` (the project URL and publishable key from the Supabase dashboard)
2. `npm install`
3. `npm run dev`

## Deploy (Vercel)
Import this repository in Vercel and add the same two variables.
In Supabase > Authentication > URL Configuration, set the Site URL to the live address and add `<address>/auth/callback` to the redirect URLs.

## Loading book text
Sign in as an admin, open `/admin`, and import the files in `content/` (one per edition).

## What exists
Storefront (home from widgets, browse, categories, authors, book pages), accounts, country setting, reader with themes and progress, back office with book flags and text import.
Not yet built: payments, highlights and notes, AI assistant, read aloud, media uploads, full back office.
