# zombies.carina.website

The public leaderboard for the Holdfast zombie Halloween event server hosted by CarinaMachina.
It shows Top Honors, every player's stats, player profiles and a campaign report for each event.

The server mod records every round, life, kill and outbreak pick into SQLite and saves a consistent copy to `stats/snapshot.db` in the server's root folder at most every 5 minutes.
A GitHub Actions workflow downloads that snapshot through the Pelican client API, turns it into JSON with `build.py`, and publishes `public/` to GitHub Pages.
Scheduled runs only rebuild when the snapshot changed, so an empty server costs nothing; pushes and manual runs always publish.
Until the Pelican secrets are set, pushes and manual runs publish the pages with no stats and scheduled runs do nothing.

## Layout

| Path | What |
|---|---|
| `build.py` | Downloads the snapshot and writes the JSON the pages read into `public/data/`. |
| `test_build.py` | Builds two hand-made rounds and checks the points, columns and honors. |
| `events.json` | Named event windows, each with its own campaign report. |
| `public/` | The static pages: the muster roll, player profiles and the campaign report. |
| `.github/workflows/leaderboard.yml` | Runs the build every 5 minutes and deploys to GitHub Pages. |

## Setup

1. Create a client API key in the Pelican panel for an account that can open the server's files.
2. Add the repository secrets `PELICAN_URL` (the panel address), `PELICAN_API_KEY` and `PELICAN_SERVER` (the short server id from the panel URL).
3. In the repository's Pages settings, set the source to GitHub Actions and the custom domain to `zombies.carina.website`, then tick Enforce HTTPS once the certificate is issued.
4. At Namecheap, add a CNAME record with host `zombies` and value `bearlikelion.github.io`.

The panel and the Wings node both need to be reachable from the internet, because the download link the panel hands out points at Wings.
GitHub pauses scheduled workflows after 60 days without a commit to the repository.

## Events

Named events go in `events.json` as a list of `{"slug", "name", "start", "end"}` with ISO times:

```json
[
	{"slug": "halloween-2026", "name": "Halloween 2026", "start": "2026-10-31T18:00:00-05:00", "end": "2026-11-01T02:00:00-05:00"}
]
```

Each started event gets its own campaign report, and it switches to final honors once its end time passes.

## Points

Points are 10 per human killed as a zombie, 5 per zombie killed as a human, 1 per minute alive as a human and 25 per round survived to the timer.
The values live in `POINTS` in `build.py`, and the site reads its explanation from there.

## Local preview

Copy a snapshot from the server, then:

```bash
python3 test_build.py
python3 build.py --db snapshot.db
python3 -m http.server -d public
```

The fixture schema in `test_build.py` mirrors the tables the mod creates, so update both together.
