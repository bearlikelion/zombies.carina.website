# Visits

Counts page views and unique visitors for the site without a third party tracker, so ad blockers leave it alone.
Each page load sends one beacon from `app.js` to this Worker, which writes a row to D1.
Visitors are a salted hash of IP and user agent, with no cookies and no stored IPs.

## Setup

Run these from this folder.

```sh
npx wrangler login
npx wrangler d1 create zombies
```

Paste the printed `database_id` into `wrangler.toml`, then:

```sh
npx wrangler d1 execute zombies --remote --command "CREATE TABLE hits (at TEXT DEFAULT CURRENT_TIMESTAMP, page TEXT, ref TEXT, country TEXT, visitor TEXT)"
openssl rand -hex 16 | npx wrangler secret put SALT
npx wrangler deploy
```

Put the printed workers.dev URL in the `sendBeacon` call at the bottom of `public/app.js`.
The Pages workflow does not deploy this Worker, so run `npx wrangler deploy` again after changing it.

## Queries

Views and uniques per day (UTC):

```sh
npx wrangler d1 execute zombies --remote --command "SELECT date(at) AS day, count(*) AS views, count(DISTINCT visitor) AS uniques FROM hits GROUP BY day ORDER BY day"
```

Top pages, with each player profile and event report counted separately:

```sh
npx wrangler d1 execute zombies --remote --command "SELECT page, count(*) AS views, count(DISTINCT visitor) AS uniques FROM hits GROUP BY page ORDER BY views DESC LIMIT 25"
```

Where visitors came from:

```sh
npx wrangler d1 execute zombies --remote --command "SELECT ref, count(*) AS views FROM hits WHERE ref != '' GROUP BY ref ORDER BY views DESC"
```

The same SQL works in the D1 console of the Cloudflare dashboard.
