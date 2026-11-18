// Shared fetch for the World Wire screen and the bottom headline crawl.

const DEFAULT_URL = 'https://southern-star-wire.ugbootshuffler.workers.dev/api/wire';

let cache = null;
let inflight = null;

const wireUrl = () => {
	const params = new URLSearchParams(window.location.search);
	return params.get('wireApi') || window.WORLD_WIRE_URL || DEFAULT_URL;
};

const fetchWire = async ({ fresh = false } = {}) => {
	if (!fresh && cache) return cache;
	if (inflight) return inflight;
	inflight = (async () => {
		const response = await fetch(wireUrl(), { cache: 'no-store' });
		if (!response.ok) throw new Error(`World wire ${response.status}`);
		cache = await response.json();
		return cache;
	})();
	try {
		return await inflight;
	} finally {
		inflight = null;
	}
};

const startWireRefresh = (onUpdate, intervalMs = 5 * 60 * 1000) => {
	const tick = async (fresh = false) => {
		try {
			const payload = await fetchWire({ fresh });
			onUpdate(payload);
		} catch (error) {
			console.error('World wire fetch failed', error);
		}
	};
	tick(false);
	return setInterval(() => tick(true), intervalMs);
};

export { fetchWire, startWireRefresh, wireUrl };
