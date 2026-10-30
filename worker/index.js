const SITE = 'https://zombies.carina.website';

const hex = (buffer) => [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');

function refHost(ref) {
	try {
		const url = new URL(ref);
		return url.origin === SITE ? '' : url.host;
	} catch {
		return '';
	}
}

export default {
	async fetch(request, env) {
		// ponytail: anyone can forge the Origin with curl; D1's 100k free writes a day is the ceiling, add a rate limit if it gets abused.
		if (request.method !== 'POST' || request.headers.get('Origin') !== SITE) return new Response(null, { status: 403 });
		const { page, ref } = await request.json().catch(() => ({}));
		if (typeof page !== 'string') return new Response(null, { status: 400 });
		const seed = new TextEncoder().encode(env.SALT + request.headers.get('CF-Connecting-IP') + request.headers.get('User-Agent'));
		const visitor = hex(await crypto.subtle.digest('SHA-256', seed)).slice(0, 16);
		await env.DB.prepare('INSERT INTO hits (page, ref, country, visitor) VALUES (?, ?, ?, ?)')
			.bind(page.slice(0, 200), refHost(ref), request.cf?.country ?? '', visitor)
			.run();
		return new Response(null, { status: 204 });
	},
};
