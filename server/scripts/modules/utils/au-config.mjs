// Australian adaptation settings and helpers
import { distance as calcDistance } from './calc.mjs';

// default location shown on first visit (no saved location, no permalink)
const DEFAULT_LOCATION = {
	query: 'Shell Cove, NSW',
	latLon: { lat: -34.5899, lon: 150.862 },
};

// cities shown on the travel forecast
const TRAVEL_CITIES = [
	['Sydney', -33.8679, 151.2073], ['Canberra', -35.2835, 149.1281], ['Melbourne', -37.814, 144.9633],
	['Hobart', -42.8794, 147.3294], ['Adelaide', -34.9287, 138.5986], ['Perth', -31.9522, 115.8614],
	['Darwin', -12.4611, 130.8418], ['Brisbane', -27.4679, 153.0281], ['Gold Coast', -28.0003, 153.4309],
	['Cairns', -16.9237, 145.7661], ['Townsville', -19.2664, 146.8057], ['Alice Springs', -23.698, 133.8807],
	['Newcastle', -32.9272, 151.7765], ['Wollongong', -34.424, 150.8935], ['Byron Bay', -28.6474, 153.602],
	['Broome', -17.9555, 122.2392],
];

// state name abbreviations for display
const STATE_ABBR = {
	'New South Wales': 'NSW',
	Victoria: 'VIC',
	Queensland: 'QLD',
	'South Australia': 'SA',
	'Western Australia': 'WA',
	Tasmania: 'TAS',
	'Northern Territory': 'NT',
	'Australian Capital Territory': 'ACT',
	'Jervis Bay Territory': 'JBT',
};

const abbreviateState = (state) => STATE_ABBR[state] ?? state;

// is a point in Australia? (inside the rough bounding box and within 150 km of a bundled town)
const isInAustralia = (lat, lon) => {
	const la = Number(lat);
	const lo = Number(lon);
	if (!(la < -9 && la > -45 && lo > 112 && lo < 155)) return false;
	// Papua New Guinea's south coast is inside the box: keep it out
	if (la > -10.7 && lo > 141) return false;
	const town = closestTown(la, lo);
	return !!town && town.distance < 150;
};

// geohash encoder (used by the BOM location API)
const GEOHASH_BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
const geohash = (lat, lon, precision = 6) => {
	const latR = [-90, 90];
	const lonR = [-180, 180];
	let hash = '';
	let bit = 0;
	let ch = 0;
	let even = true;
	while (hash.length < precision) {
		const range = even ? lonR : latR;
		const value = even ? lon : lat;
		const mid = (range[0] + range[1]) / 2;
		if (value > mid) {
			ch = ch * 2 + 1;
			range[0] = mid;
		} else {
			ch *= 2;
			range[1] = mid;
		}
		even = !even;
		bit += 1;
		if (bit === 5) {
			hash += GEOHASH_BASE32[ch];
			bit = 0;
			ch = 0;
		}
	}
	return hash;
};

// approximate distance in km between two lat/lon points
const km = (lat1, lon1, lat2, lon2) => {
	const toRad = (d) => (d * Math.PI) / 180;
	const dLat = toRad(lat2 - lat1);
	const dLon = toRad(lon2 - lon1);
	const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
	return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// towns near a point, spaced at least minSpacingKm from each other and from the point itself
const nearbyTowns = (lat, lon, { count = 7, minSpacingKm = 8, maxDistanceKm = 250, minPopulation = 1500 } = {}) => {
	const towns = (window.AuTowns ?? [])
		.filter((t) => t[4] >= minPopulation)
		.map(([name, tLat, tLon, state, population]) => ({
			name, lat: tLat, lon: tLon, state, population, distance: km(lat, lon, tLat, tLon),
		}))
		.filter((t) => t.distance <= maxDistanceKm)
		.sort((a, b) => a.distance - b.distance);
	const picked = [];
	towns.forEach((town) => {
		if (picked.length >= count) return;
		if (town.distance < minSpacingKm / 2) return;
		const tooClose = picked.some((p) => km(p.lat, p.lon, town.lat, town.lon) < minSpacingKm);
		if (!tooClose) picked.push(town);
	});
	return picked;
};

// closest town name to a point (used for GPS lookups)
const closestTown = (lat, lon) => {
	let best = null;
	(window.AuTowns ?? []).forEach(([name, tLat, tLon, state]) => {
		const d = km(lat, lon, tLat, tLon);
		if (!best || d < best.distance) best = { name, state, distance: d };
	});
	return best;
};

export {
	isInAustralia,
	DEFAULT_LOCATION,
	TRAVEL_CITIES,
	abbreviateState,
	geohash,
	km,
	nearbyTowns,
	closestTown,
	calcDistance,
};
