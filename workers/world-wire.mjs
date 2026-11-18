// World Wire RSS aggregator.
// Runs locally via the Express /api/wire route (npm start).
// Ready to deploy later as a Cloudflare Worker (wrangler.toml); do not deploy from this prototype.

const CACHE_MS = 5 * 60 * 1000;
const FETCH_MS = 8000;
const USER_AGENT = 'SouthernStar4000/1.1 (world-wire; local prototype)';

// Outlet lean matches Monitor Light. 8kun / "Notables" is intentionally omitted.
export const DESKS = [
	{
		id: 'world',
		label: 'World',
		feeds: [
			{ source: 'BBC World', lean: 'Independent', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
			{ source: 'Guardian World', lean: 'Left', url: 'https://www.theguardian.com/world/rss' },
			{ source: 'Al Jazeera', lean: 'Left', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
			{ source: 'NPR World', lean: 'Left', url: 'https://feeds.npr.org/1004/rss.xml' },
			{ source: 'Fox News', lean: 'Right', url: 'https://moxie.foxnews.com/google-publisher/world.xml' },
		],
	},
	{
		id: 'americas',
		label: 'Americas',
		feeds: [
			{ source: 'BBC US & Canada', lean: 'Independent', url: 'https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml' },
			{ source: 'BBC Latin America', lean: 'Independent', url: 'https://feeds.bbci.co.uk/news/world/latin_america/rss.xml' },
			{ source: 'NPR News', lean: 'Left', url: 'https://feeds.npr.org/1001/rss.xml' },
			{ source: 'Fox News', lean: 'Right', url: 'https://feeds.foxnews.com/foxnews/national.xml' },
		],
	},
	{
		id: 'europe',
		label: 'Europe',
		feeds: [
			{ source: 'BBC Europe', lean: 'Independent', url: 'https://feeds.bbci.co.uk/news/world/europe/rss.xml' },
			{ source: 'Guardian Europe', lean: 'Left', url: 'https://www.theguardian.com/world/europe-news/rss' },
		],
	},
	{
		id: 'mena',
		label: 'Mena',
		feeds: [
			{ source: 'BBC Middle East', lean: 'Independent', url: 'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml' },
			{ source: 'Al Jazeera', lean: 'Left', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
		],
	},
	{
		id: 'asia',
		label: 'Asia',
		feeds: [
			{ source: 'BBC Asia', lean: 'Independent', url: 'https://feeds.bbci.co.uk/news/world/asia/rss.xml' },
			{ source: 'Guardian Asia', lean: 'Left', url: 'https://www.theguardian.com/world/asia/rss' },
		],
	},
];

const cache = {
	at: 0,
	payload: null,
	inflight: null,
};

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
	'Cache-Control': 'public, max-age=60',
};

const decodeEntities = (value = '') => value
	.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
	.replace(/<[^>]+>/g, ' ')
	.replace(/&amp;/gi, '&')
	.replace(/&lt;/gi, '<')
	.replace(/&gt;/gi, '>')
	.replace(/&quot;/gi, '"')
	.replace(/&apos;/gi, "'")
	.replace(/&#39;/g, "'")
	.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
	.replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
	.replace(/\s+/g, ' ')
	.trim();

const tagText = (block, tag) => {
	const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i'));
	return match ? decodeEntities(match[1]) : '';
};

const parseItems = (xml) => {
	const chunks = xml.split(/<item[\s>]/i).slice(1);
	return chunks.map((chunk) => {
		const body = chunk.split(/<\/item>/i)[0];
		const title = tagText(body, 'title');
		const link = tagText(body, 'link') || tagText(body, 'guid');
		const published = tagText(body, 'pubDate') || tagText(body, 'dc:date') || '';
		const at = published ? Date.parse(published) : NaN;
		return {
			title,
			link,
			published,
			at: Number.isNaN(at) ? 0 : at,
		};
	}).filter((item) => item.title);
};

const fetchText = async (url) => {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), FETCH_MS);
	try {
		const response = await fetch(url, {
			signal: controller.signal,
			headers: { 'User-Agent': USER_AGENT, Accept: 'application/rss+xml, application/xml, text/xml, */*' },
		});
		if (!response.ok) throw new Error(`${response.status} ${url}`);
		return await response.text();
	} finally {
		clearTimeout(timer);
	}
};

const uniqueItems = (items, limit) => {
	const seen = new Set();
	const out = [];
	items.sort((a, b) => b.at - a.at);
	items.forEach((item) => {
		const key = item.title.toLowerCase().replace(/\s+/g, ' ');
		if (seen.has(key)) return;
		seen.add(key);
		out.push(item);
	});
	return out.slice(0, limit);
};

export const getWirePayload = async ({ desk, fresh = false } = {}) => {
	const now = Date.now();
	if (!fresh && cache.payload && (now - cache.at) < CACHE_MS) {
		return filterDesk(cache.payload, desk);
	}
	if (!fresh && cache.inflight) {
		return filterDesk(await cache.inflight, desk);
	}

	cache.inflight = (async () => {
		const desks = {};
		await Promise.all(DESKS.map(async (entry) => {
			const lists = await Promise.all(entry.feeds.map(async (feed) => {
				try {
					const xml = await fetchText(feed.url);
					return parseItems(xml).map((item) => ({
						title: item.title,
						link: item.link,
						published: item.published,
						at: item.at,
						source: feed.source,
						lean: feed.lean,
					}));
				} catch (error) {
					console.error(`world-wire feed failed: ${feed.source}`, error.message || error);
					return [];
				}
			}));
			desks[entry.id] = uniqueItems(lists.flat(), 24);
		}));
		const payload = {
			updated: new Date().toISOString(),
			desks,
			labels: Object.fromEntries(DESKS.map((entry) => [entry.id, entry.label])),
		};
		cache.payload = payload;
		cache.at = Date.now();
		return payload;
	})();

	try {
		const payload = await cache.inflight;
		return filterDesk(payload, desk);
	} finally {
		cache.inflight = null;
	}
};

const filterDesk = (payload, desk) => {
	if (!desk || desk === 'all' || !payload?.desks?.[desk]) return payload;
	return {
		updated: payload.updated,
		labels: payload.labels,
		desks: { [desk]: payload.desks[desk] },
	};
};

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
	status,
	headers: {
		...corsHeaders,
		'Content-Type': 'application/json; charset=utf-8',
	},
});

export default {
	async fetch(request) {
		if (request.method === 'OPTIONS') {
			return new Response(null, { status: 204, headers: corsHeaders });
		}
		if (request.method !== 'GET') {
			return jsonResponse({ error: 'method not allowed' }, 405);
		}
		const url = new URL(request.url);
		const path = url.pathname.replace(/\/+$/, '') || '/';
		if (path !== '/api/wire' && path !== '/wire') {
			return jsonResponse({ error: 'not found' }, 404);
		}
		try {
			const payload = await getWirePayload({
				desk: url.searchParams.get('desk') || undefined,
				fresh: url.searchParams.get('fresh') === '1',
			});
			return jsonResponse(payload);
		} catch (error) {
			console.error('world-wire worker', error);
			return jsonResponse({ error: 'wire unavailable' }, 502);
		}
	},
};
