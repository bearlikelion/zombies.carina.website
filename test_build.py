#!/usr/bin/env python3
# Builds two hand-made rounds and checks the points, columns and honors that come out.
import json
import sqlite3
import tempfile
from pathlib import Path

import build

SCHEMA = """
	CREATE TABLE players (id INTEGER PRIMARY KEY, playfab_id TEXT NOT NULL UNIQUE, name TEXT NOT NULL, first_seen REAL NOT NULL, last_seen REAL NOT NULL);
	CREATE TABLE rounds (id INTEGER PRIMARY KEY, map TEXT NOT NULL, mode TEXT NOT NULL, started_at REAL NOT NULL, ended_at REAL, winner TEXT);
	CREATE TABLE lives (id INTEGER PRIMARY KEY, round_id INTEGER NOT NULL, player_id INTEGER NOT NULL, side TEXT NOT NULL, spawned_at REAL NOT NULL, ended_at REAL, survived INTEGER NOT NULL DEFAULT 0, cause TEXT);
	CREATE TABLE kills (id INTEGER PRIMARY KEY, round_id INTEGER NOT NULL, at REAL NOT NULL, killer_id INTEGER NOT NULL, killer_side TEXT NOT NULL, victim_id INTEGER, victim_side TEXT NOT NULL, weapon TEXT NOT NULL, headshot INTEGER NOT NULL, last_stand INTEGER NOT NULL);
	CREATE TABLE outbreak_picks (round_id INTEGER NOT NULL, player_id INTEGER NOT NULL);
"""

A, B, C = 1, 2, 3


def fixture(path):
	con = sqlite3.connect(path)
	con.executescript(SCHEMA)
	con.executemany('INSERT INTO players VALUES (?, ?, ?, 1000, 3200)', [(A, 'pfA', 'Alice'), (B, 'pfB', 'Bob'), (C, 'pfC', 'Carl')])
	con.executemany('INSERT INTO rounds VALUES (?, ?, ?, ?, ?, ?)', [
		(1, 'FortWilly', 'ArmySiege', 1000, 1600, 'zombie'),
		(2, 'OverTheTop', 'Invasion', 2000, 3200, 'human'),
	])
	con.executemany('INSERT INTO lives (round_id, player_id, side, spawned_at, ended_at, survived, cause) VALUES (?, ?, ?, ?, ?, ?, ?)', [
		(1, C, 'human', 1000, 1090, 0, 'KilledByAdmin'),
		(1, B, 'human', 1000, 1200, 0, 'ShotByFirearm'),
		(1, A, 'human', 1000, 1500, 0, 'HitByMeleeWeapon'),
		(1, C, 'zombie', 1095, 1300, 0, 'ShotByFirearm'),
		(1, C, 'zombie', 1305, 1600, 0, 'roundend'),
		(1, A, 'zombie', 1505, 1600, 0, 'roundend'),
		(1, B, 'zombie', 1205, 1600, 0, 'roundend'),
		(2, C, 'human', 2000, 2090, 0, 'KilledByAdmin'),
		(2, B, 'human', 2000, 2300, 0, 'HitByMeleeWeapon'),
		(2, A, 'human', 2000, 3200, 1, 'roundend'),
		(2, C, 'zombie', 2095, 2500, 0, 'ShotByFirearm'),
		(2, C, 'zombie', 2505, 3200, 0, 'roundend'),
		(2, B, 'zombie', 2305, 3200, 0, 'roundend'),
	])
	con.executemany('INSERT INTO kills (round_id, at, killer_id, killer_side, victim_id, victim_side, weapon, headshot, last_stand) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [
		(1, 1200, C, 'zombie', B, 'human', 'Sword_British_Hanger', 0, 0),
		(1, 1300, A, 'human', C, 'zombie', 'Musket_Brown_Bess', 1, 0),
		(1, 1500, C, 'zombie', A, 'human', 'Sword_British_Hanger', 0, 0),
		(2, 2300, C, 'zombie', B, 'human', 'Frontlines_German_Trench_Club', 0, 0),
		(2, 2500, A, 'human', C, 'zombie', 'Rifle_Lee_Enfield', 0, 1),
	])
	con.executemany('INSERT INTO outbreak_picks VALUES (?, ?)', [(1, C), (2, C)])
	con.commit()
	con.close()


def main():
	with tempfile.TemporaryDirectory() as temp:
		db = Path(temp) / 'snapshot.db'
		fixture(db)
		build.build(db, Path(temp), 4000)
		data = json.loads((Path(temp) / 'data' / 'all-time.json').read_text())
		profile = json.loads((Path(temp) / 'data' / 'players' / '1.json').read_text())

	rows = {row['name']: row for row in data['leaderboard']}
	assert [row['name'] for row in data['leaderboard']] == ['Alice', 'Carl', 'Bob']
	alice = rows['Alice']
	assert (alice['human_kills'], alice['human_deaths'], alice['zombie_kills'], alice['zombie_deaths']) == (2, 1, 0, 0)
	assert (alice['time_alive'], alice['rounds_survived'], alice['points']) == (1700, 1, 63)
	carl = rows['Carl']
	assert (carl['human_kills'], carl['human_deaths'], carl['zombie_kills'], carl['zombie_deaths'], carl['points']) == (0, 2, 3, 2, 33)
	assert rows['Bob']['points'] == 8

	honors = {h['key']: (h['top'][0]['name'], h['top'][0]['value']) for h in data['honors'] if h['top']}
	assert honors == {
		'survivor': ('Alice', 1200),
		'deadliest': ('Carl', 3),
		'patient_zero': ('Carl', 2),
		'slayer': ('Alice', 2),
		'hold_the_line': ('Alice', 1),
		'last_standing': ('Alice', 2),
		'last_stand_hero': ('Alice', 1),
		'first_bite': ('Carl', 2),
		'fresh_meat': ('Bob', 2),
		'relentless': ('Carl', 2),
	}, honors

	summary = data['summary']
	assert (summary['rounds'], summary['human_wins'], summary['zombie_wins']) == (2, 1, 1)
	assert (summary['human_lives_lost'], summary['zombies_defeated'], summary['players']) == (5, 2, 3)
	assert summary['maps'][0]['rounds'] == 1 and summary['headshots'] == 1

	assert set(profile['honors']) == {'survivor', 'slayer', 'hold_the_line', 'last_standing', 'last_stand_hero'}
	assert [r['map'] for r in profile['recent']] == ['OverTheTop', 'FortWilly']
	assert profile['recent'][0]['survived'] == 1 and profile['recent'][0]['human_time'] == 1200
	print('ok')


if __name__ == '__main__':
	main()
