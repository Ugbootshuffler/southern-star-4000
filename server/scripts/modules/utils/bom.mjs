// Optional Bureau of Meteorology (BOM) data, used only when the "BOM data" setting is on.
// The BOM API (api.weather.bom.gov.au) is unofficial and its terms say it is owned by the
// Bureau and must not be used, copied or shared, so this is OFF by default and intended for
// personal use only. Everything falls back to Open-Meteo if BOM is off or unavailable.
import { json } from './fetch.mjs';
import { geohash } from './au-config.mjs';

const BOM_API = 'https://api.weather.bom.gov.au/v1';

const isBomEnabled = () => {
	try {
		const stored = JSON.parse(localStorage.getItem('Settings') ?? '{}');
		const url = new URLSearchParams(window.location.search).get('settings-bomData-checkbox');
		if (url !== null) return url === 'true';
		return stored.bomData === true;
	} catch (e) {
		return false;
	}
};

const safe = async (promise) => {
	try {
		return await promise;
	} catch (error) {
		console.warn('BOM request failed', error?.message ?? error);
		return null;
	}
};

const getObservations = async (lat, lon) => {
	const result = await safe(json(`${BOM_API}/locations/${geohash(lat, lon, 6)}/observations`));
	return result?.data ?? null;
};

const getDailyForecast = async (lat, lon) => {
	const result = await safe(json(`${BOM_API}/locations/${geohash(lat, lon, 6)}/forecasts/daily`));
	if (!result?.data) return null;
	return { days: result.data, issued: result.metadata?.issue_time };
};

const getWarnings = async (lat, lon) => {
	const result = await safe(json(`${BOM_API}/locations/${geohash(lat, lon, 6)}/warnings`));
	const list = result?.data ?? [];
	// fetch the full text of each warning (limit 5)
	const detailed = await Promise.all(list.slice(0, 5).map(async (warning) => {
		const detail = await safe(json(`${BOM_API}/warnings/${warning.id}`));
		return { ...warning, message: detail?.data?.message ?? '' };
	}));
	return detailed;
};

// fetch everything BOM offers for the location in parallel
const getBomData = async (lat, lon) => {
	if (!isBomEnabled()) return null;
	const [observations, daily, warnings] = await Promise.all([
		getObservations(lat, lon),
		getDailyForecast(lat, lon),
		getWarnings(lat, lon),
	]);
	if (!observations && !daily) return null;
	return { observations, daily, warnings };
};

// map BOM icon descriptors to the condition text used by the icon lookup
const BOM_ICON_TO_CONDITION = {
	sunny: 'Clear sky',
	clear: 'Clear sky',
	mostly_sunny: 'Mainly clear',
	partly_cloudy: 'Partly cloudy',
	cloudy: 'Overcast',
	hazy: 'Fog',
	haze: 'Fog',
	fog: 'Fog',
	light_rain: 'Slight Rain',
	rain: 'Moderate Rain',
	heavy_rain: 'Heavy Rain',
	light_shower: 'Slight Rain showers',
	shower: 'Moderate Rain showers',
	showers: 'Moderate Rain showers',
	heavy_shower: 'Violent Rain showers',
	heavy_showers: 'Violent Rain showers',
	storm: 'Thunderstorm',
	storms: 'Thunderstorm',
	snow: 'Moderate Snow fall',
	frost: 'Clear sky',
	dust: 'Fog',
	wind: 'Partly cloudy',
	windy: 'Partly cloudy',
	tropical_cyclone: 'Thunderstorm',
	cyclone: 'Thunderstorm',
};

const bomIconToCondition = (descriptor) => BOM_ICON_TO_CONDITION[descriptor] ?? 'Partly cloudy';

export {
	isBomEnabled,
	getBomData,
	getObservations,
	bomIconToCondition,
	BOM_API,
};
