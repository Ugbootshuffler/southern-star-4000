// Backup forecast source: MET Norway Locationforecast 2.0 (https://api.met.no), CC BY 4.0.
// Only used when Open-Meteo can't be reached. The response is converted into the same shape
// as an Open-Meteo forecast so every display works unchanged.
import { json } from './fetch.mjs';
import { DateTime } from '../../vendor/auto/luxon.mjs';
import { closestTown, isInAustralia } from './au-config.mjs';

const STATE_TZ = {
	NSW: 'Australia/Sydney',
	ACT: 'Australia/Sydney',
	VIC: 'Australia/Melbourne',
	TAS: 'Australia/Hobart',
	QLD: 'Australia/Brisbane',
	SA: 'Australia/Adelaide',
	NT: 'Australia/Darwin',
	WA: 'Australia/Perth',
};

// time zone for an Australian location (from the nearest bundled town, else the device's zone)
const auTimeZone = (lat, lon) => {
	const town = closestTown(lat, lon);
	if (town && isInAustralia(lat, lon) && STATE_TZ[town.state]) {
		// Broken Hill area uses Adelaide time
		if (town.state === 'NSW' && lon < 142) return 'Australia/Broken_Hill';
		return STATE_TZ[town.state];
	}
	// outside Australia: the zone the place search found, else a fixed offset from the longitude
	if (window.placeTimeZoneHint) return window.placeTimeZoneHint;
	const offset = Math.round(Number(lon) / 15);
	if (offset === 0) return 'Etc/GMT';
	// Etc/GMT zones use inverted signs (Etc/GMT-10 is UTC+10)
	return `Etc/GMT${offset > 0 ? '-' : '+'}${Math.abs(offset)}`;
};

// MET Norway symbol codes to WMO weather codes (as used by Open-Meteo)
const symbolToWmo = (symbol) => {
	if (!symbol) return 2;
	const s = symbol.replace(/_(day|night|polartwilight)$/, '');
	if (s.includes('thunder')) return 95;
	const map = {
		clearsky: 0,
		fair: 1,
		partlycloudy: 2,
		cloudy: 3,
		fog: 45,
		lightrainshowers: 80,
		rainshowers: 81,
		heavyrainshowers: 82,
		lightrain: 61,
		rain: 63,
		heavyrain: 65,
		lightsleet: 66,
		sleet: 67,
		heavysleet: 67,
		lightsleetshowers: 66,
		sleetshowers: 67,
		heavysleetshowers: 67,
		lightsnow: 71,
		snow: 73,
		heavysnow: 75,
		lightsnowshowers: 85,
		snowshowers: 85,
		heavysnowshowers: 86,
	};
	return map[s] ?? 2;
};

const dewPoint = (t, rh) => {
	if (t === undefined || rh === undefined || rh <= 0) return null;
	const a = 17.27;
	const b = 237.7;
	const g = ((a * t) / (b + t)) + Math.log(rh / 100);
	return (b * g) / (a - g);
};

// rough "feels like" (Australian apparent temperature, Steadman) from temp, humidity and wind
const apparent = (t, rh, windMs) => {
	if (t === undefined || rh === undefined) return t ?? null;
	const e = (rh / 100) * 6.105 * Math.exp((17.27 * t) / (237.7 + t));
	return t + (0.33 * e) - (0.7 * (windMs ?? 0)) - 4;
};

const isDay = (date, lat, lon) => {
	if (typeof SunCalc === 'undefined') {
		const h = date.getHours();
		return h >= 6 && h < 19 ? 1 : 0;
	}
	// eslint-disable-next-line no-undef
	const times = SunCalc.getTimes(date, lat, lon);
	return date > times.sunrise && date < times.sunset ? 1 : 0;
};

const round1 = (v) => (v === null || v === undefined || Number.isNaN(v) ? null : Math.round(v * 10) / 10);

const getMetNoPoint = async (lat, lon) => {
	const data = await json(`https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${Number(lat).toFixed(4)}&lon=${Number(lon).toFixed(4)}`, { retryCount: 0, timeout: 8000 });
	const series = data?.properties?.timeseries;
	if (!Array.isArray(series) || series.length === 0) throw new Error('MET Norway returned no forecast');

	const timezone = auTimeZone(lat, lon);
	const hourly = {
		time: [],
		temperature_2m: [],
		relative_humidity_2m: [],
		dew_point_2m: [],
		apparent_temperature: [],
		precipitation_probability: [],
		precipitation: [],
		weather_code: [],
		pressure_msl: [],
		cloud_cover: [],
		visibility: [],
		uv_index: [],
		is_day: [],
		wind_speed_10m: [],
		wind_direction_10m: [],
		wind_gusts_10m: [],
	};
	const days = {};

	series.forEach((entry) => {
		const when = DateTime.fromISO(entry.time, { zone: 'utc' }).setZone(timezone);
		const d = entry.data?.instant?.details ?? {};
		const next = entry.data?.next_1_hours ?? entry.data?.next_6_hours ?? {};
		const t = d.air_temperature;
		const date = when.toFormat('yyyy-MM-dd');
		const code = symbolToWmo(next.summary?.symbol_code);
		const precip = next.details?.precipitation_amount ?? 0;
		const prob = next.details?.probability_of_precipitation ?? null;

		hourly.time.push(when.toFormat("yyyy-MM-dd'T'HH:mm"));
		hourly.temperature_2m.push(round1(t));
		hourly.relative_humidity_2m.push(round1(d.relative_humidity));
		hourly.dew_point_2m.push(round1(d.dew_point_temperature ?? dewPoint(t, d.relative_humidity)));
		hourly.apparent_temperature.push(round1(apparent(t, d.relative_humidity, d.wind_speed)));
		hourly.precipitation_probability.push(prob);
		hourly.precipitation.push(precip);
		hourly.weather_code.push(code);
		hourly.pressure_msl.push(round1(d.air_pressure_at_sea_level));
		hourly.cloud_cover.push(round1(d.cloud_area_fraction));
		hourly.visibility.push(d.fog_area_fraction > 50 ? 1000 : 24000);
		hourly.uv_index.push(round1(d.ultraviolet_index_clear_sky ?? 0));
		hourly.is_day.push(isDay(when.toJSDate(), lat, lon));
		hourly.wind_speed_10m.push(round1((d.wind_speed ?? 0) * 3.6));
		hourly.wind_direction_10m.push(round1(d.wind_from_direction));
		hourly.wind_gusts_10m.push(round1((d.wind_speed_of_gust ?? d.wind_speed ?? 0) * 3.6));

		if (!days[date]) {
			days[date] = {
				max: -Infinity, min: Infinity, codes: {}, precip: 0, prob: 0, uv: 0,
			};
		}
		const day = days[date];
		if (t !== undefined) { day.max = Math.max(day.max, t); day.min = Math.min(day.min, t); }
		day.codes[code] = (day.codes[code] ?? 0) + 1;
		day.precip += precip;
		day.prob = Math.max(day.prob, prob ?? 0);
		day.uv = Math.max(day.uv, d.ultraviolet_index_clear_sky ?? 0);
	});

	const dates = Object.keys(days).slice(0, 8);
	const sun = (date, key) => {
		if (typeof SunCalc === 'undefined') return null;
		const noon = DateTime.fromISO(`${date}T12:00`, { zone: timezone }).toJSDate();
		// eslint-disable-next-line no-undef
		const time = SunCalc.getTimes(noon, lat, lon)[key];
		return DateTime.fromJSDate(time).setZone(timezone).toFormat("yyyy-MM-dd'T'HH:mm");
	};
	// most significant code for the day: thunder/rain beats cloud beats clear
	const dayCode = (codes) => Object.keys(codes).map(Number).sort((a, b) => b - a)[0] ?? 2;
	const daily = {
		time: dates,
		temperature_2m_max: dates.map((k) => round1(days[k].max)),
		temperature_2m_min: dates.map((k) => round1(days[k].min)),
		weather_code: dates.map((k) => dayCode(days[k].codes)),
		sunrise: dates.map((k) => sun(k, 'sunrise')),
		sunset: dates.map((k) => sun(k, 'sunset')),
		precipitation_probability_max: dates.map((k) => days[k].prob),
		precipitation_sum: dates.map((k) => round1(days[k].precip)),
		uv_index_max: dates.map((k) => round1(days[k].uv)),
	};

	const c = 0;
	const current = {
		time: hourly.time[c],
		temperature_2m: hourly.temperature_2m[c],
		relative_humidity_2m: hourly.relative_humidity_2m[c],
		apparent_temperature: hourly.apparent_temperature[c],
		is_day: hourly.is_day[c],
		precipitation: hourly.precipitation[c],
		weather_code: hourly.weather_code[c],
		cloud_cover: hourly.cloud_cover[c],
		pressure_msl: hourly.pressure_msl[c],
		wind_speed_10m: hourly.wind_speed_10m[c],
		wind_direction_10m: hourly.wind_direction_10m[c],
		wind_gusts_10m: hourly.wind_gusts_10m[c],
		dew_point_2m: hourly.dew_point_2m[c],
		visibility: hourly.visibility[c],
		uv_index: hourly.uv_index[c],
	};

	return {
		latitude: lat,
		longitude: lon,
		timezone,
		utc_offset_seconds: DateTime.now().setZone(timezone).offset * 60,
		current,
		hourly,
		daily,
		source: 'MET Norway',
	};
};

// eslint-disable-next-line import/prefer-default-export
export { getMetNoPoint, auTimeZone };
