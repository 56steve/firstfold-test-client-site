# Firstfold test client site

A minimal client website for testing the Firstfold blog connection end to end: the customer writes a post in
their Firstfold dashboard, and it appears here within about a minute, with no redeploy.

It belongs to the test customer **TEST 2 – Firstfold QA** and is not a real business. It is also the starting
point for the blog part of real client sites.

## How it works

- `lib/firstfold-blog.ts` calls `GET https://app.firstfold.io/api/site/posts` with the client's token as a bearer
  token. The token identifies the business, so it only ever returns that business's **published** posts.
- The token is read on the server only (`server-only`); it is never sent to the browser.
- Pages use `revalidate = 60`: a published, edited, unpublished or deleted post shows on the site within about a
  minute.
- `/` shows the latest three posts, `/blog` all of them, `/blog/[slug]` one post.

## Deploying on Vercel

1. Import this repository as a new Vercel project (framework: Next.js, no build settings to change).
2. Get the token: **admin.firstfold.io → Clients → the client → "Their website's blog token" → Generate token**.
3. In the Vercel project, **Settings → Environment Variables**, add for Production and Preview:
   - `FIRSTFOLD_SITE_TOKEN` = the token
   - `FIRSTFOLD_API_ORIGIN` = `https://app.firstfold.io` (optional; this is the default)
4. Redeploy so the variables take effect.

If the token is replaced in the admin later, the blog shows a "refused this site's blog token" notice until the new
token is pasted into Vercel and the project is redeployed.

## Known limits of the platform (not this site)

- **Cover images need a login on the platform**, so they do not load for the public yet.
- **Post addresses are not unique**: two posts with the same title share one address; the newest is shown.

## Local development

```bash
cp .env.example .env.local   # then paste the token
pnpm install
pnpm dev
```

Checks: `pnpm lint`, `pnpm typecheck`, `pnpm build`.
