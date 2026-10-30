#!/usr/bin/env python3
# Writes sample.db: 25 made-up players over 30 rounds ending now, for previewing the site without the server.
# With sample-avatars.json ({steam_id: avatar_url}) beside it, players get those Steam ids; build with STEAM_AVATARS=sample-avatars.json.
import json
import random
import sqlite3
import sys
import time
from pathlib import Path

from test_build import SCHEMA

NAMES = ['Sgt. Pepperpot', 'CarinaMachina', 'Lt. Dan', '[93rd] Hamish', 'Le Grognard', 'Brambleworth', 'Pvt. Pyle', 'xX_Musket_Xx',
	'Tobias Fenwick', 'Colonel Mustard', 'Jäger Klaus', 'Old Nell', 'Pip', 'Corporal Clegg', 'The Drummer Boy', 'Ensign Ruth',
	'Gunner Haig', 'Mister Bones', 'Quartermaster', 'Fifer Finn', 'Wellesley', 'Marguerite', 'Hob', 'Captain Ahab', 'Lady Grey']
MAPS = ['FortWilly', 'OverTheTop', 'HeroesLanding', 'FortAlFarid', 'Boston', 'FortImraan', 'ArendanRiver', 'KingsmanBay']
WEAPONS = ['Musket_Brown_Bess', 'Rifle_Baker', 'Frontlines_Rifle_Lee_Enfield', 'Pistol_Sea_Service', 'Frontlines_Rifle_Gewehr98']
ROUNDS = 30
SPACING = 1500
AVATARS = Path(__file__).resolve().parent / 'sample-avatars.json'


def kill(con, round_id, at, killer, killer_side, victim, weapon, last_stand):
	con.execute('INSERT INTO kills (round_id, at, killer_id, killer_side, victim_id, victim_side, weapon, headshot, last_stand) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
		(round_id, at, killer, killer_side, victim, 'zombie' if killer_side == 'human' else 'human', weapon, killer_side == 'human' and random.random() < 0.2, last_stand))


def life(con, round_id, player, side, start, end, survived, cause):
	con.execute('INSERT INTO lives (round_id, player_id, side, spawned_at, ended_at, survived, cause) VALUES (?, ?, ?, ?, ?, ?, ?)', (round_id, player, side, start, end, survived, cause))


def main(path):
	random.seed(7)
	path.unlink(missing_ok=True)
	con = sqlite3.connect(path)
	con.executescript(SCHEMA)
	now = time.time() - 120
	first = now - ROUNDS * SPACING
	steam_ids = list(json.loads(AVATARS.read_text())) if AVATARS.exists() else []
	con.executemany('INSERT INTO players (id, playfab_id, name, first_seen, last_seen, steam_id) VALUES (?, ?, ?, ?, ?, ?)',
		[(i, f'pf{i}', name, first, now, steam_ids[i - 1] if i <= len(steam_ids) else None) for i, name in enumerate(NAMES, 1)])
	for round_id in range(1, ROUNDS + 1):
		start = first + (round_id - 1) * SPACING
		length = random.randint(600, 1200)
		end = start + length
		present = random.sample(range(1, len(NAMES) + 1), random.randint(6, 18))
		winner = random.choice(['human', 'zombie', 'zombie'])
		con.execute('INSERT INTO rounds VALUES (?, ?, ?, ?, ?, ?)', (round_id, random.choice(MAPS), 'Invasion', start, end, winner))
		picks = random.sample(present, 2)
		con.executemany('INSERT INTO outbreak_picks VALUES (?, ?)', [(round_id, p) for p in picks])
		survivors = random.sample([p for p in present if p not in picks], 2) if winner == 'human' else []
		for player in present:
			if player in survivors:
				life(con, round_id, player, 'human', start, end, 1, 'roundend')
				for _ in range(random.randint(1, 6)):
					at = random.uniform(start + 100, end)
					kill(con, round_id, at, player, 'human', random.choice(present), random.choice(WEAPONS), at > end - 120)
				continue
			if player in picks:
				death, cause = start + 90, 'KilledByAdmin'
			else:
				death, cause = start + random.randint(120, length - 30), random.choice(['HitByMeleeWeapon', 'HitByMeleeWeapon', 'FallDamage'])
			life(con, round_id, player, 'human', start, death, 0, cause)
			if cause == 'HitByMeleeWeapon':
				kill(con, round_id, death, random.choice(picks), 'zombie', player, 'Sword_British_Hanger', False)
			spawn = death + 5
			while spawn < end - 20:
				died = min(end, spawn + random.randint(60, 400))
				life(con, round_id, player, 'zombie', spawn, died, 0, 'ShotByFirearm' if died < end else 'roundend')
				if died < end:
					killer = random.choice([p for p in present if p != player])
					kill(con, round_id, died, killer, 'human', player, random.choice(WEAPONS), died > end - 120)
				spawn = died + 5
	con.commit()
	con.close()


if __name__ == '__main__':
	main(Path(sys.argv[1] if len(sys.argv) > 1 else 'sample.db'))
