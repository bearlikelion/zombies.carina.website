const COLORS = { L: '#e5a13a', V: '#5fa88c', R: '#c0392b', B: '#e4dccb', N: '#0e141c' };

// Each honor wears its own ribbon: amber for human deeds, verdigris for zombie ones, blood for the infected.
const RIBBONS = {
	survivor: 'L40 B20 L40',
	slayer: 'V15 L70 V15',
	hold_the_line: 'L20 B10 L40 B10 L20',
	last_standing: 'B45 L10 B45',
	last_stand_hero: 'L30 R10 L20 R10 L30',
	deadliest: 'V40 R20 V40',
	first_bite: 'R15 V70 R15',
	relentless: 'V20 N10 V40 N10 V20',
	patient_zero: 'R40 V20 R40',
	fresh_meat: 'B30 R40 B30',
};

const LIVE_SECONDS = 20 * 60;

const $ = (selector) => document.querySelector(selector);

function h(tag, attrs = {}, ...children) {
	const node = document.createElement(tag);
	for (const [key, value] of Object.entries(attrs)) {
		if (value == null || value === false) continue;
		if (key === 'class') node.className = value;
		else if (key === 'style') node.style.cssText = value;
		else node.setAttribute(key, value === true ? '' : value);
	}
	node.append(...children.flat().filter((child) => child != null && child !== false));
	return node;
}

async function getJSON(path) {
	const response = await fetch(path, { cache: 'no-cache' });
	if (!response.ok) throw new Error(`${path}: ${response.status}`);
	return response.json();
}

function ribbon(key) {
	let at = 0;
	const stops = (RIBBONS[key] || 'B100').split(' ').map((stripe) => {
		const color = COLORS[stripe[0]];
		const start = at;
		at += Number(stripe.slice(1));
		return `${color} ${start}% ${at}%`;
	});
	return h('span', { class: 'ribbon', style: `background: linear-gradient(90deg, ${stops.join(', ')})`, 'aria-hidden': 'true' });
}

const number = (value) => Number(value).toLocaleString();

function duration(seconds) {
	const s = Math.max(0, Math.round(seconds));
	const hours = Math.floor(s / 3600);
	const minutes = Math.floor((s % 3600) / 60);
	if (hours) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
	if (minutes) return `${minutes}m ${String(s % 60).padStart(2, '0')}s`;
	return `${s}s`;
}

function honorValue(honor, value) {
	if (honor.unit === 'seconds') return duration(value);
	return `${number(value)} ${value === 1 ? honor.unit.replace(/s$/, '') : honor.unit}`;
}

const prettyMap = (map) => map.replace(/([a-z])([A-Z])/g, '$1 $2');

const prettyWeapon = (weapon) => weapon.replace(/^Frontlines_/, '').replace(/_/g, ' ');

const playerLink = (id, name) => h('a', { href: `player.html?id=${encodeURIComponent(id)}` }, name);

function when(timestamp) {
	return new Date(timestamp * 1000).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function dispatch(meta) {
	const node = $('#dispatch');
	const age = Date.now() / 1000 - meta.snapshot_at;
	const live = age < LIVE_SECONDS;
	node.classList.toggle('live', live);
	if (!live) {
		node.textContent = `Last dispatch ${when(meta.snapshot_at)}`;
		return;
	}
	const minutes = Math.round(age / 60);
	node.textContent = minutes < 1 ? 'Updated just now' : `Updated ${minutes} minute${minutes === 1 ? '' : 's'} ago`;
}

function honorCard(honor) {
	const [first, ...rest] = honor.top;
	return h('li', { class: 'honor' },
		ribbon(honor.key),
		h('h3', {}, honor.title),
		h('p', { class: 'honor-desc' }, honor.description),
		first
			? [
				h('div', { class: 'honor-holder' }, playerLink(first.id, first.name)),
				h('p', { class: 'honor-value' }, honorValue(honor, first.value)),
			]
			: h('p', { class: 'honor-unclaimed' }, 'Unclaimed'),
		rest.length > 0 && h('ol', { class: 'runners', 'aria-label': 'Runners up' },
			rest.map((runner) => h('li', {}, playerLink(runner.id, runner.name), h('span', {}, honorValue(honor, runner.value))))),
	);
}

function bars(rows, label, count) {
	const max = Math.max(1, ...rows.map(count));
	return h('ul', { class: 'bars' }, rows.map((row) => h('li', {},
		h('span', { class: 'label' }, label(row)),
		h('span', { class: 'track' }, h('span', { class: 'fill', style: `width: ${(count(row) / max) * 100}%` })),
		h('span', { class: 'count' }, number(count(row))),
	)));
}

async function rollPage() {
	let rows = [];
	let sort = { key: 'points', dir: -1 };

	function renderRows() {
		const query = $('#search').value.trim().toLowerCase();
		const shown = rows
			.filter((row) => row.name.toLowerCase().includes(query))
			.sort((a, b) => {
				const x = a[sort.key];
				const y = b[sort.key];
				return (typeof x === 'string' ? x.localeCompare(y) : x - y) * sort.dir || a.rank - b.rank;
			});
		$('#roll tbody').replaceChildren(...shown.map((row) => h('tr', {},
			h('td', { class: 'rank' }, row.rank),
			h('td', { class: 'name' }, playerLink(row.id, row.name)),
			h('td', {}, number(row.human_kills)),
			h('td', {}, number(row.human_deaths)),
			h('td', {}, duration(row.time_alive)),
			h('td', {}, number(row.zombie_kills)),
			h('td', {}, number(row.zombie_deaths)),
			h('td', { class: 'points-cell' }, number(row.points)),
		)));
		const empty = $('#empty');
		empty.hidden = shown.length > 0;
		empty.textContent = rows.length ? `No one on the roll matches "${query}".` : 'No rounds recorded yet. The roll fills in a few minutes after the first outbreak.';
		for (const th of document.querySelectorAll('#roll th[data-key]')) {
			if (th.dataset.key === sort.key) th.setAttribute('aria-sort', sort.dir < 0 ? 'descending' : 'ascending');
			else th.removeAttribute('aria-sort');
		}
	}

	async function load() {
		const [meta, data] = await Promise.all([getJSON('data/meta.json'), getJSON('data/all-time.json')]);
		dispatch(meta);
		const s = data.summary;
		$('#ledger').replaceChildren(
			h('strong', { class: 'human' }, number(s.human_lives_lost)), ` human${s.human_lives_lost === 1 ? ' has' : 's have'} fallen and `,
			h('strong', { class: 'zombie' }, number(s.zombies_defeated)), ` zombie${s.zombies_defeated === 1 ? ' has' : 's have'} been put down across `,
			h('strong', {}, number(s.rounds)), ` round${s.rounds === 1 ? '' : 's'}.`,
		);
		$('#honors').replaceChildren(...data.honors.map(honorCard));
		const p = meta.points;
		$('#points').replaceChildren(
			h('li', {}, `${p.zombie_kill} for each human you kill as a zombie`),
			h('li', {}, `${p.human_kill} for each zombie you kill as a human`),
			h('li', {}, `${p.human_minute} for every minute you stay alive as a human`),
			h('li', {}, `${p.round_survived} for every round you survive to the timer`),
		);
		rows = data.leaderboard;
		renderRows();
	}

	for (const th of document.querySelectorAll('#roll th[data-key]')) {
		const button = h('button', { type: 'button' }, th.textContent);
		th.replaceChildren(button);
		button.addEventListener('click', () => {
			const key = th.dataset.key;
			sort = { key, dir: sort.key === key ? -sort.dir : (key === 'name' || key === 'rank' ? 1 : -1) };
			renderRows();
		});
	}
	$('#search').addEventListener('input', renderRows);
	try {
		await load();
	} catch {
		$('#empty').hidden = false;
		$('#empty').textContent = 'No rounds recorded yet. The roll fills in a few minutes after the first outbreak.';
	}
	setInterval(() => load().catch(() => {}), 60 * 1000);
}

async function playerPage() {
	const id = new URLSearchParams(location.search).get('id');
	let player;
	let meta;
	let all;
	try {
		[player, meta, all] = await Promise.all([getJSON(`data/players/${encodeURIComponent(id)}.json`), getJSON('data/meta.json'), getJSON('data/all-time.json')]);
	} catch {
		$('#profile').replaceChildren(h('p', { class: 'empty' }, 'No soldier by that id is on the roll. Pick a name from the muster roll instead.'));
		return;
	}
	dispatch(meta);
	document.title = `${player.name} · Holdfast Zombies`;
	const honors = all.honors.filter((honor) => player.honors.includes(honor.key));
	$('#profile').replaceChildren(
		h('section', { class: 'profile-head' },
			h('p', { class: 'eyebrow' }, `Rank ${player.rank} of ${all.leaderboard.length}`),
			h('h1', {}, player.name),
			h('p', { class: 'profile-sub' }, `${number(player.points)} points across ${number(player.rounds)} round${player.rounds === 1 ? '' : 's'}. First seen ${when(player.first_seen)}, last seen ${when(player.last_seen)}.`),
			honors.length > 0 && h('ul', { class: 'rack', 'aria-label': 'Honors held' },
				honors.map((honor) => h('li', {}, ribbon(honor.key), honor.title))),
		),
		h('section', { class: 'sides' },
			h('div', { class: 'side' },
				h('h3', { class: 'human' }, 'As a human'),
				h('dl', { class: 'figures' },
					h('div', {}, h('dt', {}, 'Zombies killed'), h('dd', {}, number(player.human_kills))),
					h('div', {}, h('dt', {}, 'Times infected'), h('dd', {}, number(player.human_deaths))),
					h('div', {}, h('dt', {}, 'Time alive'), h('dd', {}, duration(player.time_alive))),
					h('div', {}, h('dt', {}, 'Rounds survived'), h('dd', {}, number(player.rounds_survived))),
				),
			),
			h('div', { class: 'side' },
				h('h3', { class: 'zombie' }, 'As a zombie'),
				h('dl', { class: 'figures' },
					h('div', {}, h('dt', {}, 'Humans killed'), h('dd', {}, number(player.zombie_kills))),
					h('div', {}, h('dt', {}, 'Times put down'), h('dd', {}, number(player.zombie_deaths))),
					h('div', {}, h('dt', {}, 'Outbreak picks'), h('dd', {}, number(player.outbreak_picks))),
				),
			),
		),
		h('div', { class: 'columns' },
			h('section', {},
				h('h2', {}, 'Maps fought'),
				bars(player.maps, (row) => prettyMap(row.map), (row) => row.rounds),
			),
			player.weapons.length > 0 && h('section', {},
				h('h2', {}, 'Weapons of choice'),
				bars(player.weapons, (row) => h('span', { class: row.side }, prettyWeapon(row.weapon)), (row) => row.kills),
			),
		),
		h('section', {},
			h('h2', {}, 'Recent rounds'),
			h('ol', { class: 'rounds' }, player.recent.map((round) => h('li', {},
				h('span', { class: 'map' }, prettyMap(round.map), h('span', { class: 'when' }, when(round.started_at))),
				h('span', { class: 'outcome' }, outcome(round)),
				h('span', { class: 'tally' },
					h('span', { class: 'human' }, `${round.human_kills} zombie${round.human_kills === 1 ? '' : 's'} killed`), ' · ',
					h('span', { class: 'zombie' }, `${round.zombie_kills} human${round.zombie_kills === 1 ? '' : 's'} killed`)),
			))),
		),
	);
}

function outcome(round) {
	const result = round.winner === 'human' ? 'Humans held.' : round.winner === 'zombie' ? 'Zombies won.' : 'No winner.';
	if (round.picked) return `Picked by the outbreak. ${result}`;
	if (round.survived) return h('span', { class: 'human' }, `Survived the round. ${result}`);
	if (round.human_time != null) return `Fell after ${duration(round.human_time)}. ${result}`;
	return `Rose as a zombie. ${result}`;
}

async function reportPage() {
	const slug = new URLSearchParams(location.search).get('event');
	let meta;
	let data;
	try {
		meta = await getJSON('data/meta.json');
		data = await getJSON(slug ? `data/events/${encodeURIComponent(slug)}.json` : 'data/all-time.json');
	} catch {
		$('#report').classList.add('stack');
	$('#report').replaceChildren(h('p', { class: 'empty' }, 'Nothing to report yet. Come back after the first outbreak.'));
		return;
	}
	dispatch(meta);
	const event = meta.events.find((e) => e.slug === slug);
	const started = meta.events.filter((e) => Date.parse(e.start) / 1000 <= meta.snapshot_at);
	const s = data.summary;
	const decided = s.human_wins + s.zombie_wins;
	const peak = Math.max(...s.kills_by_hour_utc);
	const offset = Math.round(-new Date().getTimezoneOffset() / 60);
	const localHours = Array.from({ length: 24 }, (_, hour) => s.kills_by_hour_utc[(((hour - offset) % 24) + 24) % 24] || 0);
	const deadliest = s.maps.find((m) => m.map === s.deadliest_map);
	const hourLabel = (hour) => new Date(2000, 0, 1, hour).toLocaleTimeString([], { hour: 'numeric' });

	$('#report').classList.add('stack');
	$('#report').replaceChildren(
		h('section', { class: 'hero' },
			h('p', { class: 'eyebrow' }, 'Campaign report'),
			h('h1', {}, event ? event.name : 'All time'),
			event && h('p', { class: 'profile-sub' }, `${new Date(event.start).toLocaleDateString()} to ${new Date(event.end).toLocaleDateString()}`),
			event && !event.ended && h('span', { class: 'status human' }, 'In progress'),
			h('nav', { class: 'chips', 'aria-label': 'Reports' },
				h('a', { href: 'infographic.html', 'aria-current': slug ? false : 'page' }, 'All time'),
				started.map((e) => h('a', { href: `infographic.html?event=${encodeURIComponent(e.slug)}`, 'aria-current': e.slug === slug ? 'page' : false }, e.name)),
			),
			h('dl', { class: 'toll' },
				h('div', { class: 'human' }, h('dt', {}, 'Human lives lost'), h('dd', {}, number(s.human_lives_lost))),
				h('div', { class: 'zombie' }, h('dt', {}, 'Zombies defeated'), h('dd', {}, number(s.zombies_defeated))),
			),
		),
		h('section', {},
			h('h2', {}, `${number(s.rounds)} round${s.rounds === 1 ? '' : 's'} fought`),
			h('div', { class: 'split', role: 'img', 'aria-label': `Humans won ${s.human_wins}, zombies won ${s.zombie_wins}` },
				h('span', { class: 'human', style: `flex: ${s.human_wins}` }),
				h('span', { class: 'zombie', style: `flex: ${s.zombie_wins}` }),
			),
			h('div', { class: 'split-legend' },
				h('span', { class: 'human' }, `Humans held the line ${number(s.human_wins)} time${s.human_wins === 1 ? '' : 's'}`),
				h('span', { class: 'zombie' }, `Zombies overran them ${number(s.zombie_wins)} time${s.zombie_wins === 1 ? '' : 's'}`),
			),
			decided < s.rounds && h('p', { class: 'note' }, `${number(s.rounds - decided)} round${s.rounds - decided === 1 ? '' : 's'} ended without a winner.`),
		),
		h('section', {},
			h('dl', { class: 'facts' },
				h('div', {}, h('dt', {}, 'Most popular map'), h('dd', {}, s.maps[0] ? prettyMap(s.maps[0].map) : 'None yet')),
				h('div', {}, h('dt', {}, deadliest ? `Deadliest map, ${(deadliest.human_deaths / deadliest.rounds).toFixed(1)} humans lost per round` : 'Deadliest map'), h('dd', {}, deadliest ? prettyMap(deadliest.map) : 'None yet')),
				h('div', {}, h('dt', {}, 'Humans who survived their round'), h('dd', {}, `${Math.round(s.survival_rate * 100)}%`)),
				h('div', {}, h('dt', {}, 'Players'), h('dd', {}, number(s.players))),
				h('div', {}, h('dt', {}, 'Hours played'), h('dd', {}, number(s.hours_played))),
				h('div', {}, h('dt', {}, 'Outbreaks started'), h('dd', {}, number(s.outbreaks))),
				h('div', {}, h('dt', {}, 'Kills'), h('dd', {}, number(s.kills))),
				h('div', {}, h('dt', {}, 'Headshots'), h('dd', {}, number(s.headshots))),
			),
		),
		h('div', { class: 'columns' },
			s.maps.length > 0 && h('section', {}, h('h2', {}, 'Rounds per map'), bars(s.maps, (row) => prettyMap(row.map), (row) => row.rounds)),
			s.human_weapons.length > 0 && h('section', {}, h('h2', {}, 'What humans fought with'), bars(s.human_weapons, (row) => prettyWeapon(row.weapon), (row) => row.kills)),
		),
		s.kills > 0 && h('section', {},
			h('h2', {}, 'When the killing happens'),
			h('div', { class: 'hours', role: 'img', 'aria-label': `Busiest hour ${hourLabel(localHours.indexOf(peak))}, your local time` },
				localHours.map((count, hour) => h('span', { class: count === peak ? 'peak' : null, style: `height: ${(count / peak) * 100}%`, title: `${hourLabel(hour)}: ${count} kills` }))),
			h('div', { class: 'hour-labels', 'aria-hidden': 'true' }, [0, 6, 12, 18, 23].map((hour) => h('span', {}, hourLabel(hour)))),
			h('p', { class: 'note' }, `Kills by hour in your local time. The busiest hour is ${hourLabel(localHours.indexOf(peak))}.`),
		),
		h('section', {},
			h('h2', {}, event && event.ended ? 'Final honors' : 'Honors so far'),
			h('ul', { class: 'honors' }, data.honors.map(honorCard)),
		),
	);
}

const pages = { roll: rollPage, player: playerPage, report: reportPage };
pages[document.body.dataset.page]?.();
