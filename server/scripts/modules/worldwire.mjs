// World Wire: retro headline board in the Southern Star rotation.

import STATUS from './status.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';
import { fetchWire } from './utils/worldwire-api.mjs';

const WORLD_PER_PAGE = 5;
const WORLD_PAGES = 2;

const shortSource = (source = '') => source
	.replace('BBC World', 'BBC')
	.replace('BBC US & Canada', 'BBC US')
	.replace('BBC Latin America', 'BBC LatAm')
	.replace('BBC Middle East', 'BBC ME')
	.replace('BBC Europe', 'BBC')
	.replace('BBC Asia', 'BBC')
	.replace('Guardian World', 'Guardian')
	.replace('Guardian Europe', 'Guardian')
	.replace('Guardian Asia', 'Guardian')
	.replace('Al Jazeera', 'Al Jazeera')
	.replace('NPR World', 'NPR')
	.replace('NPR News', 'NPR')
	.replace('Fox News', 'Fox');

// Round-robin by source so one outlet does not fill the first page.
const interleaveBySource = (items) => {
	const queues = [];
	const index = new Map();
	items.forEach((item) => {
		if (!index.has(item.source)) {
			index.set(item.source, queues.length);
			queues.push([]);
		}
		queues[index.get(item.source)].push(item);
	});
	const out = [];
	let remaining = queues.reduce((sum, queue) => sum + queue.length, 0);
	while (remaining > 0) {
		for (let i = 0; i < queues.length; i += 1) {
			if (queues[i].length > 0) {
				out.push(queues[i].shift());
				remaining -= 1;
			}
		}
	}
	return out;
};

const shortLean = (lean = '') => {
	if (lean === 'Independent') return 'Indep';
	return lean;
};

const leanClass = (lean = '') => lean.toLowerCase();

class WorldWire extends WeatherDisplay {
	constructor(navId, elemId) {
		super(navId, elemId, 'World Wire', true);
		this.timing.baseDelay = 10000;
		this.pages = [];
	}

	async getData(_weatherParameters) {
		if (!this.elem) this.loadTemplates();
		if (!super.getData(_weatherParameters)) return;

		try {
			const payload = await fetchWire();
			this.data = payload;
			this.buildPages(payload);
		} catch (error) {
			console.error('World Wire failed', error);
			this.pages = [];
			this.data = undefined;
		}

		if (this.pages.length === 0) {
			this.setStatus(STATUS.noData);
			return;
		}

		this.timing.totalScreens = this.pages.length;
		this.calcNavTiming();
		this.setStatus(STATUS.loaded);
	}

	buildPages(payload) {
		const world = interleaveBySource(payload?.desks?.world ?? []);
		const pages = [];

		for (let i = 0; i < WORLD_PAGES; i += 1) {
			const slice = world.slice(i * WORLD_PER_PAGE, (i + 1) * WORLD_PER_PAGE);
			if (slice.length === 0) break;
			pages.push({
				top: 'World',
				bottom: i === 0 ? 'Wire' : 'Wire 2',
				headers: {
					region: '', source: 'Source', lean: 'Lean', headline: 'Headline',
				},
				rows: slice.map((item) => ({
					region: '',
					source: shortSource(item.source),
					lean: shortLean(item.lean),
					leanClass: leanClass(item.lean),
					headline: item.title,
				})),
			});
		}

		const regionIds = ['americas', 'europe', 'mena', 'asia'];
		const regionRows = regionIds.map((id) => {
			const item = payload?.desks?.[id]?.[0];
			if (!item) return null;
			return {
				region: payload.labels?.[id] || id,
				source: shortSource(item.source),
				lean: shortLean(item.lean),
				leanClass: leanClass(item.lean),
				headline: item.title,
			};
		}).filter(Boolean);

		if (regionRows.length > 0) {
			pages.push({
				top: 'World',
				bottom: 'Regions',
				headers: {
					region: 'Region', source: 'Source', lean: 'Lean', headline: 'Headline',
				},
				rows: regionRows,
			});
		}

		this.pages = pages;
	}

	async drawCanvas() {
		if (!this.elem) this.loadTemplates();
		super.drawCanvas();

		const page = this.pages[this.screenIndex] ?? this.pages[0];
		if (!page) {
			this.finishDraw();
			return;
		}

		const top = this.elem.querySelector('.header .title.dual .top');
		const bottom = this.elem.querySelector('.header .title.dual .bottom');
		if (top) top.innerHTML = page.top;
		if (bottom) bottom.innerHTML = page.bottom;

		this.elem.querySelector('.world-wire')?.classList.toggle('has-region', Boolean(page.headers.region));
		const headers = this.elem.querySelector('.column-headers');
		if (headers) {
			headers.querySelector('.region').textContent = page.headers.region;
			headers.querySelector('.source').textContent = page.headers.source;
			headers.querySelector('.lean').textContent = page.headers.lean;
			headers.querySelector('.headline').textContent = page.headers.headline;
		}

		const rows = page.rows.map((row) => {
			const node = this.fillTemplate('wire-row', {
				region: row.region,
				source: row.source,
				lean: row.lean,
				headline: row.headline,
			});
			const leanElem = node.querySelector('.lean');
			if (leanElem && row.leanClass) leanElem.classList.add(row.leanClass);
			return node;
		});

		const lines = this.elem.querySelector('.wire-lines');
		lines.innerHTML = '';
		lines.append(...rows);

		this.finishDraw();
	}
}

registerDisplay(new WorldWire(12, 'world-wire'));
