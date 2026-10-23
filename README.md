# NutriGlass AI — Food Scanner Starter

A mobile-first progressive web app prototype. It captures a food photo or accepts an uploaded image, sends it to a server-side Gemini vision endpoint, displays a cautious calorie range, and saves confirmed food logs locally plus to Supabase when configured.

## Setup

Requires Node.js 20 or newer.

1. Run `npm install`.
2. Set the server environment variable `GEMINI_API_KEY` to your Gemini API key. The default model is `gemini-3.8-flash`. You can override `GEMINI_MODEL` with another vision-capable model available to your account.
3. Optional cloud database: create a Supabase project, enable Anonymous Sign-Ins under Authentication settings, run `supabase/schema.sql` in SQL Editor, and add `SUPABASE_URL` plus `SUPABASE_ANON_KEY` (publishable/anon key) to your hosting environment. Never use a service-role or secret key in the browser.
4. Run `npm start`.
5. Open `http://localhost:3000`.

Do not commit your real API key. The key belongs only in the hosting provider's server-side environment settings. Camera access on deployed sites requires HTTPS; localhost is normally allowed.

## Deploy

Deploy to a Node.js host that supports an Express server and environment variables. Add `GEMINI_API_KEY` and optionally `GEMINI_MODEL` to the host settings. Static-only hosting will not run `server.js` without converting the API endpoint to a supported serverless function.

## Included

- Camera preview and photo capture
- Photo upload
- Server-side AI scan endpoint
- Food name, confidence, approximate portion, calorie range, uncertainty notes and suggestion
- User-confirmed daily food log saved in browser local storage and optionally synced to Supabase cloud database with per-user row-level security
- PWA manifest and basic app-shell cache

## Limitations

This is an early prototype, not a medical device. Photo-only calorie estimates may be wrong, especially for portion size and hidden ingredients. Anonymous Supabase accounts allow cloud sync without requiring an email. Anonymous accounts cannot be recovered after clearing browser data or switching devices unless an identity-linking/sign-in flow is added. The app does not yet include permanent account recovery, barcode lookup, a verified Nepali recipe database, or smart-glasses hardware integration. AI scanning needs a network connection and a configured API key.
