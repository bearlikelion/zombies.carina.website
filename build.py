#!/usr/bin/env python3
# Turns the mod's stats snapshot into the JSON the leaderboard pages read.
# With no --db it downloads the snapshot from the Pelican panel, skipping the build when it has not changed unless FORCE=true.
import argparse
import json
import os
import shutil
import sqlite3
import tempfile
import urllib.request
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent

POINTS = {'zombie_kill': 10, 'human_kill': 5, 'human_minute': 1, 'round_survived': 25}

# Lives closed for these reasons ended without the player dying.
DEATH = "cause NOT IN ('respawn', 'left', 'roundend', 'mapchange', 'restart')"

HONORS = [
	('survivor', 'The Survivor', 'Longest single life as a human', 'seconds',
		"SELECT player_id, max(coalesce(ended_at, :now) - spawned_at) AS v FROM l WHERE side = 'human' GROUP BY player_id"),
	('deadliest', 'The Deadliest', 'Most humans killed as a zombie', 'kills',
		"SELECT killer_id AS player_id, count(*) AS v FROM k WHERE killer_side = 'zombie' GROUP BY killer_id"),
	('patient_zero', 'Patient Zero', 'Most times picked to start the outbreak', 'picks',
		"SELECT player_id, count(*) AS v FROM o GROUP BY player_id"),
	('slayer', 'Zombie Slayer', 'Most zombies killed as a human', 'kills',
		"SELECT killer_id AS player_id, count(*) AS v FROM k WHERE killer_side = 'human' GROUP BY killer_id"),
	('hold_the_line', 'Hold the Line', 'Most rounds survived to the timer', 'rounds',
		"SELECT player_id, count(*) AS v FROM l WHERE side = 'human' AND survived GROUP BY player_id"),
	('last_standing', 'Last One Standing', 'Most rounds as the final human alive', 'rounds',
		f"""SELECT player_id, count(*) AS v FROM (
			SELECT player_id,
				row_number() OVER (PARTITION BY round_id ORDER BY survived DESC, ended_at DESC) AS n,
				sum(survived) OVER (PARTITION BY round_id) AS survivors,
				count(*) OVER (PARTITION BY round_id) AS humans
			FROM l WHERE side = 'human' AND (survived OR {DEATH}) AND round_id IN (SELECT id FROM r WHERE ended_at IS NOT NULL))
		WHERE n = 1 AND survivors <= 1 AND humans >= 2 GROUP BY player_id"""),
	('last_stand_hero', 'Last Stand Hero', 'Most zombies killed in the final two minute Last Stand', 'kills',
		"SELECT killer_id AS player_id, count(*) AS v FROM k WHERE killer_side = 'human' AND last_stand GROUP BY killer_id"),
	('first_bite', 'First Bite', 'Most rounds landing the first zombie kill on a human', 'rounds',
		"""SELECT killer_id AS player_id, count(*) AS v FROM (
			SELECT killer_id, row_number() OVER (PARTITION BY round_id ORDER BY at) AS n FROM k WHERE killer_side = 'zombie')
		WHERE n = 1 GROUP BY killer_id"""),
	('fresh_meat', 'Fresh Meat', 'Most rounds as the first human to fall', 'rounds',
		f"""SELECT player_id, count(*) AS v FROM (
			SELECT player_id, row_number() OVER (PARTITION BY round_id ORDER BY ended_at) AS n
			FROM l WHERE side = 'human' AND {DEATH} AND cause != 'KilledByAdmin')
		WHERE n = 1 GROUP BY player_id"""),
	('relentless', 'Relentless', 'Most deaths as a zombie', 'deaths',
		f"SELECT player_id, count(*) AS v FROM l WHERE side = 'zombie' AND {DEATH} GROUP BY player_id"),
]

LEADERBOARD = f"""
	WITH lk AS (
		SELECT player_id,
			count(DISTINCT round_id) AS rounds,
			coalesce(sum(side = 'human' AND {DEATH}), 0) AS human_deaths,
			coalesce(sum(side = 'zombie' AND {DEATH}), 0) AS zombie_deaths,
			sum(CASE WHEN side = 'human' THEN coalesce(ended_at, :now) - spawned_at ELSE 0 END) AS time_alive,
			sum(side = 'human' AND survived) AS rounds_survived
		FROM l GROUP BY player_id),
	kk AS (
		SELECT killer_id AS player_id, sum(killer_side = 'human') AS human_kills, sum(killer_side = 'zombie') AS zombie_kills
		FROM k GROUP BY killer_id)
	SELECT p.id, p.name, lk.rounds, coalesce(kk.human_kills, 0) AS human_kills, lk.human_deaths,
		coalesce(kk.zombie_kills, 0) AS zombie_kills, lk.zombie_deaths, lk.time_alive, lk.rounds_survived
	FROM lk JOIN players p ON p.id = lk.player_id LEFT JOIN kk ON kk.player_id = lk.player_id"""


def scope(con, start, end):
	for name in 'rlko':
		con.execute(f'DROP VIEW IF EXISTS temp.{name}')
	con.execute(f'CREATE TEMP VIEW r AS SELECT * FROM rounds WHERE started_at >= {float(start)} AND started_at < {float(end)}')
	for name, table in (('l', 'lives'), ('k', 'kills'), ('o', 'outbreak_picks')):
		con.execute(f'CREATE TEMP VIEW {name} AS SELECT * FROM {table} WHERE round_id IN (SELECT id FROM r)')


def points(row):
	return (row['zombie_kills'] * POINTS['zombie_kill'] + row['human_kills'] * POINTS['human_kill']
		+ int(row['time_alive'] // 60) * POINTS['human_minute'] + row['rounds_survived'] * POINTS['round_survived'])


def one(con, sql, now):
	return con.execute(sql, {'now': now}).fetchone()[0] or 0


def window(con, start, end, now, avatars):
	scope(con, start, end)
	leaderboard = [dict(row) for row in con.execute(LEADERBOARD, {'now': now})]
	for row in leaderboard:
		row['time_alive'] = round(row['time_alive'])
		row['points'] = points(row)
		row['avatar'] = avatars.get(row['id'])
	leaderboard.sort(key=lambda row: (-row['points'], row['name'].lower()))
	for rank, row in enumerate(leaderboard, 1):
		row['rank'] = rank
	names = {row['id']: row['name'] for row in leaderboard}
	honors = []
	for key, title, description, unit, sql in HONORS:
		top = con.execute(f'SELECT player_id, v FROM ({sql}) WHERE v > 0 ORDER BY v DESC, player_id LIMIT 3', {'now': now}).fetchall()
		honors.append({'key': key, 'title': title, 'description': description, 'unit': unit,
			'top': [{'id': pid, 'name': names.get(pid, '?'), 'avatar': avatars.get(pid), 'value': round(v)} for pid, v in top]})
	survived = one(con, "SELECT count(*) FROM l WHERE side = 'human' AND survived", now)
	human_deaths = one(con, f"SELECT count(*) FROM l WHERE side = 'human' AND {DEATH}", now)
	maps = [dict(row) for row in con.execute(f"""
		SELECT r.map, count(DISTINCT r.id) AS rounds,
			sum(r.winner = 'human') AS human_wins, sum(r.winner = 'zombie') AS zombie_wins,
			(SELECT count(*) FROM l JOIN r r2 ON r2.id = l.round_id WHERE r2.map = r.map AND l.side = 'human' AND {DEATH}) AS human_deaths
		FROM r GROUP BY r.map ORDER BY rounds DESC, r.map""")]
	hours = [0] * 24
	for hour, count in con.execute("SELECT CAST(strftime('%H', at, 'unixepoch') AS INTEGER), count(*) FROM k GROUP BY 1"):
		hours[hour] = count
	summary = {
		'rounds': one(con, 'SELECT count(*) FROM r', now),
		'human_wins': one(con, "SELECT count(*) FROM r WHERE winner = 'human'", now),
		'zombie_wins': one(con, "SELECT count(*) FROM r WHERE winner = 'zombie'", now),
		'human_lives_lost': human_deaths,
		'zombies_defeated': one(con, f"SELECT count(*) FROM l WHERE side = 'zombie' AND {DEATH}", now),
		'survival_rate': survived / (survived + human_deaths) if survived + human_deaths else 0,
		'players': one(con, 'SELECT count(DISTINCT player_id) FROM l', now),
		'hours_played': round(one(con, 'SELECT sum(coalesce(ended_at, :now) - spawned_at) FROM l', now) / 3600, 1),
		'kills': one(con, 'SELECT count(*) FROM k', now),
		'headshots': one(con, 'SELECT count(*) FROM k WHERE headshot', now),
		'outbreaks': one(con, 'SELECT count(DISTINCT round_id) FROM o', now),
		'maps': maps,
		'deadliest_map': max(maps, key=lambda m: m['human_deaths'] / m['rounds'])['map'] if maps else None,
		'human_weapons': [dict(row) for row in con.execute(
			"SELECT weapon, count(*) AS kills, sum(headshot) AS headshots FROM k WHERE killer_side = 'human' GROUP BY weapon ORDER BY kills DESC, weapon LIMIT 8")],
		'kills_by_hour_utc': hours,
		# One letter per round in start order: h humans held, z zombies won, - no winner.
		'winners': ''.join({'human': 'h', 'zombie': 'z'}.get(w, '-') for (w,) in con.execute('SELECT winner FROM r ORDER BY started_at, id')),
	}
	return {'leaderboard': leaderboard, 'honors': honors, 'summary': summary}


def profile(con, row, honors, now, avatars):
	pid = {'p': row['id'], 'now': now}
	maps = [dict(r) for r in con.execute("""
		SELECT r.map, count(DISTINCT r.id) AS rounds,
			(SELECT count(*) FROM k JOIN r r2 ON r2.id = k.round_id WHERE r2.map = r.map AND k.killer_id = :p AND k.killer_side = 'human') AS human_kills,
			(SELECT count(*) FROM k JOIN r r2 ON r2.id = k.round_id WHERE r2.map = r.map AND k.killer_id = :p AND k.killer_side = 'zombie') AS zombie_kills
		FROM l JOIN r ON r.id = l.round_id WHERE l.player_id = :p GROUP BY r.map ORDER BY rounds DESC""", pid)]
	rounds = [dict(r) for r in con.execute(f"""
		SELECT r.id, r.map, r.started_at, r.winner,
			round(coalesce(r.ended_at, :now) - r.started_at) AS length,
			round(max(CASE WHEN l.side = 'human' THEN coalesce(l.ended_at, :now) - l.spawned_at END)) AS human_time,
			round(min(CASE WHEN l.side = 'human' AND l.{DEATH} THEN l.ended_at - r.started_at END)) AS turned_at,
			max(l.side = 'human' AND l.survived) AS survived,
			coalesce(sum(l.side = 'zombie' AND l.{DEATH}), 0) AS zombie_deaths,
			(SELECT count(*) FROM k WHERE k.round_id = r.id AND k.killer_id = :p AND k.killer_side = 'human') AS human_kills,
			(SELECT count(*) FROM k WHERE k.round_id = r.id AND k.killer_id = :p AND k.killer_side = 'zombie') AS zombie_kills,
			(SELECT count(*) FROM o WHERE o.round_id = r.id AND o.player_id = :p) AS picked
		FROM l JOIN r ON r.id = l.round_id WHERE l.player_id = :p GROUP BY r.id ORDER BY r.started_at DESC""", pid)]
	for r in rounds:
		r['points'] = points({'zombie_kills': r['zombie_kills'], 'human_kills': r['human_kills'], 'time_alive': r['human_time'] or 0, 'rounds_survived': r['survived'] or 0})
	weapons = [dict(r) for r in con.execute(
		'SELECT weapon, killer_side AS side, count(*) AS kills FROM k WHERE killer_id = :p GROUP BY weapon, killer_side ORDER BY kills DESC LIMIT 5', pid)]
	seen = con.execute('SELECT first_seen, last_seen FROM players WHERE id = :p', pid).fetchone()
	return {
		**row,
		'first_seen': seen[0],
		'last_seen': seen[1],
		'outbreak_picks': con.execute('SELECT count(*) FROM o WHERE player_id = :p', pid).fetchone()[0],
		'honors': [h['key'] for h in honors if h['top'] and h['top'][0]['id'] == row['id']],
		'nemesis': rival(con, 'SELECT killer_id AS id, count(*) AS n FROM k WHERE victim_id = :p GROUP BY killer_id', pid, avatars),
		'prey': rival(con, 'SELECT victim_id AS id, count(*) AS n FROM k WHERE killer_id = :p AND victim_id IS NOT NULL GROUP BY victim_id', pid, avatars),
		'records': {
			'longest_life': best(rounds, lambda r: r['human_time'] or 0),
			'most_kills': best(rounds, lambda r: r['human_kills'] + r['zombie_kills']),
			'best_round': best(rounds, lambda r: r['points']),
		},
		'maps': maps,
		'recent': rounds[:20],
		'weapons': weapons,
	}


def rival(con, sql, params, avatars):
	top = con.execute(f'SELECT p.id, p.name, t.n FROM ({sql}) AS t JOIN players p ON p.id = t.id ORDER BY t.n DESC, p.id LIMIT 1', params).fetchone()
	return {'id': top[0], 'name': top[1], 'avatar': avatars.get(top[0]), 'count': top[2]} if top else None


def best(rounds, value):
	top = max(rounds, key=value, default=None)
	return {'value': value(top), 'map': top['map'], 'started_at': top['started_at']} if top and value(top) else None


def steam_avatars(con):
	key = os.environ.get('STEAM_API_KEY')
	ids = dict(con.execute('SELECT steam_id, id FROM players WHERE steam_id IS NOT NULL'))
	# Previews can map Steam ids to avatar URLs from a local file instead of calling Steam.
	if os.environ.get('STEAM_AVATARS'):
		urls = json.loads(Path(os.environ['STEAM_AVATARS']).read_text())
		return {ids[steam_id]: url for steam_id, url in urls.items() if steam_id in ids}
	avatars = {}
	if not key or not ids:
		return avatars
	steam_ids = list(ids)
	for i in range(0, len(steam_ids), 100):
		url = f"https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key={key}&steamids={','.join(steam_ids[i:i + 100])}"
		try:
			with urllib.request.urlopen(url, timeout=30) as response:
				for player in json.load(response)['response']['players']:
					avatars[ids[player['steamid']]] = player['avatarfull']
		except Exception as error:
			print(f'Steam avatars unavailable: {error}')
	return avatars


def timestamp(text):
	return datetime.fromisoformat(text.replace('Z', '+00:00')).timestamp()


def build(db, out, now):
	con = sqlite3.connect(f'file:{db}?mode=ro', uri=True)
	con.row_factory = sqlite3.Row
	data = out / 'data'
	shutil.rmtree(data, ignore_errors=True)
	(data / 'players').mkdir(parents=True)
	(data / 'events').mkdir()
	write = lambda path, value: (data / path).write_text(json.dumps(value, separators=(',', ':')))

	avatars = steam_avatars(con)
	everything = window(con, 0, now + 1, now, avatars)
	write('all-time.json', everything)
	for row in everything['leaderboard']:
		write(f"players/{row['id']}.json", profile(con, row, everything['honors'], now, avatars))

	events = []
	for event in json.loads((ROOT / 'events.json').read_text()):
		start, end = timestamp(event['start']), timestamp(event['end'])
		ended = end <= now
		events.append({**event, 'ended': ended})
		if start <= now:
			write(f"events/{event['slug']}.json", window(con, start, min(end, now + 1), min(end, now), avatars))

	write('meta.json', {'generated_at': datetime.now().timestamp(), 'snapshot_at': now, 'points': POINTS, 'events': events})
	con.close()


def pelican(path):
	url = f"{os.environ['PELICAN_URL'].rstrip('/')}/api/client/servers/{os.environ['PELICAN_SERVER']}/{path}"
	request = urllib.request.Request(url, headers={'Authorization': f"Bearer {os.environ['PELICAN_API_KEY']}", 'Accept': 'application/json', 'User-Agent': 'holdfast-zombies-leaderboard'})
	with urllib.request.urlopen(request, timeout=60) as response:
		return json.load(response)


def published_snapshot():
	try:
		with urllib.request.urlopen(f"{os.environ['SITE_URL'].rstrip('/')}/data/meta.json", timeout=30) as response:
			return json.load(response).get('snapshot_at')
	except Exception:
		return None


def download(dest):
	files = pelican('files/list?directory=%2Fstats')['data']
	snapshot = next(f['attributes'] for f in files if f['attributes']['name'] == 'snapshot.db')
	modified = timestamp(snapshot['modified_at'])
	if os.environ.get('SITE_URL') and os.environ.get('FORCE') != 'true' and published_snapshot() == modified:
		return None
	url = pelican('files/download?file=%2Fstats%2Fsnapshot.db')['attributes']['url']
	with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'holdfast-zombies-leaderboard'}), timeout=120) as response:
		dest.write_bytes(response.read())
	return modified


def output(changed):
	if 'GITHUB_OUTPUT' in os.environ:
		with open(os.environ['GITHUB_OUTPUT'], 'a') as f:
			f.write(f"changed={'true' if changed else 'false'}\n")


def main():
	parser = argparse.ArgumentParser()
	parser.add_argument('--db', type=Path, help='use a local snapshot instead of downloading one')
	parser.add_argument('--out', type=Path, default=ROOT / 'public')
	args = parser.parse_args()
	if args.db:
		build(args.db, args.out, args.db.stat().st_mtime)
		return
	if not os.environ.get('PELICAN_URL'):
		print('PELICAN_URL is not set, so there are no stats to publish')
		output(os.environ.get('FORCE') == 'true')
		return
	with tempfile.TemporaryDirectory() as temp:
		db = Path(temp) / 'snapshot.db'
		modified = download(db)
		if modified is None:
			print('Snapshot unchanged, skipping build')
			output(False)
			return
		build(db, args.out, modified)
		output(True)


if __name__ == '__main__':
	main()
