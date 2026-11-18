// World Wire: retro headline board in the Southern Star rotation.

import STATUS from './status.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';
import { fetchWire } from './utils/worldwire-api.mjs';

const WORLD_PER_PAGE = 3;
const WORLD_PAGES = 3;

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

// Wrap a headline onto at most two lines; ellipsis only at a word boundary
// if the full title still overflows that box. Width is measured with a
// like-for-like nowrap probe so Star4000's tall glyphs do not fool scrollHeight.
const headlineProbe = document.createElement('span');
headlineProbe.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;white-space:nowrap;';

const measureHeadlineWidth = (text, ref) => {
	const cs = window.getComputedStyle(ref);
	headlineProbe.style.font = cs.font;
	headlineProbe.style.fontSize = cs.fontSize;
	headlineProbe.style.fontFamily = cs.fontFamily;
	headlineProbe.style.fontWeight = cs.fontWeight;
	headlineProbe.style.letterSpacing = cs.letterSpacing;
	if (!headlineProbe.parentNode) document.body.appendChild(headlineProbe);
	headlineProbe.textContent = text;
	return headlineProbe.offsetWidth;
};

const wordsFit = (words, maxWidth, ref) => measureHeadlineWidth(words.join(' '), ref) <= maxWidth;

const packLine = (words, maxWidth, ref, reserveEllipsis) => {
	if (words.length === 0) return { text: '', count: 0 };
	let count = 0;
	while (count < words.length) {
		const trial = words.slice(0, count + 1);
		const label = reserveEllipsis && count + 1 < words.length
			? `${trial.join(' ')}...`
			: trial.join(' ');
		if (count > 0 && measureHeadlineWidth(label, ref) > maxWidth) break;
		count += 1;
	}
	return { text: words.slice(0, count).join(' '), count };
};

const fitHeadline = (el, text) => {
	const title = (text || '').trim();
	el.textContent = title;
	if (!title) return;

	const maxWidth = el.clientWidth || el.offsetWidth;
	if (!maxWidth) return;

	const words = title.split(/\s+/);
	if (wordsFit(words, maxWidth, el)) return;

	const first = packLine(words, maxWidth, el, false);
	const rest = words.slice(first.count);
	if (rest.length === 0) {
		el.textContent = title;
		return;
	}
	if (wordsFit(rest, maxWidth, el)) {
		el.textContent = title;
		return;
	}
	const second = packLine(rest, maxWidth, el, true);
	const used = first.count + second.count;
	if (used < words.length) {
		el.textContent = `${first.text} ${second.text}...`;
		return;
	}
	el.textContent = title;
};

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
				bottom: i === 0 ? 'Wire' : `Wire ${i + 1}`,
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

		// Two region pages so each headline can wrap to two lines without clipping.
		const regionPageSize = 2;
		regionRows.forEach((_, i) => {
			if (i % regionPageSize !== 0) return;
			const slice = regionRows.slice(i, i + regionPageSize);
			const pageNo = Math.floor(i / regionPageSize);
			pages.push({
				top: 'World',
				bottom: pageNo === 0 ? 'Regions' : 'Regions 2',
				headers: {
					region: 'Region', source: 'Source', lean: 'Lean', headline: 'Headline',
				},
				rows: slice,
			});
		});

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
				headline: '',
			});
			const leanElem = node.querySelector('.lean');
			if (leanElem && row.leanClass) leanElem.classList.add(row.leanClass);
			return { node, headline: row.headline };
		});

		const lines = this.elem.querySelector('.wire-lines');
		lines.innerHTML = '';
		lines.append(...rows.map((row) => row.node));
		// Fit after layout so scrollHeight uses the real two-line box.
		rows.forEach((row) => {
			const headline = row.node.querySelector('.headline');
			if (headline) fitHeadline(headline, row.headline);
		});

		this.finishDraw();
	}
}

registerDisplay(new WorldWire(12, 'world-wire'));
