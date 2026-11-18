// WeatherStar-style scrolling headline crawl under the local-conditions bar.

import { startWireRefresh } from './utils/worldwire-api.mjs';

const SEPARATOR = '   \u00b7   ';

const shortSource = (source = '') => source
	.replace('BBC World', 'BBC')
	.replace('Guardian World', 'Guardian')
	.replace('Al Jazeera', 'Al Jazeera')
	.replace('NPR World', 'NPR')
	.replace('Fox News', 'Fox');

const formatItem = (item) => `${shortSource(item.source)}: ${item.title}`;

const buildText = (payload) => {
	const items = payload?.desks?.world ?? [];
	if (items.length === 0) return '';
	return items.slice(0, 16).map(formatItem).join(SEPARATOR);
};

const paint = (text) => {
	document.querySelectorAll('.weather-display .scroll .headline-crawl-track').forEach((track) => {
		track.innerHTML = '';
		if (!text) return;
		// Duplicate the run so the loop can wrap seamlessly.
		const run = `${text}${SEPARATOR}`;
		const first = document.createElement('span');
		first.className = 'headline-crawl-run';
		first.textContent = run;
		const second = first.cloneNode(true);
		track.append(first, second);
		const duration = Math.max(60, Math.round(run.length * 0.35));
		track.style.animationDuration = `${duration}s`;
	});
};

document.addEventListener('DOMContentLoaded', () => {
	startWireRefresh((payload) => paint(buildText(payload)));
});
