// Towns to label on the radar map.
// Uses the bundled GeoNames list of Australian towns (scripts/data/au-towns.js) instead of the
// Wikidata/proxy lookup used upstream, so no third-party proxy is needed.
export default class RadarBoundsCities {
	static async getBoundingBoxCities(westLng, southLat, eastLng, northLat, limit = 7) {
		// skip council/region names that are not single towns
		const regions = ['Blue Mountains', 'Central Coast', 'Lake Macquarie', 'Sutherland Shire', 'Hills District'];
		const towns = (window.AuTowns ?? [])
			.filter(([city]) => !regions.includes(city))
			.filter(([, lat, lon]) => lat > southLat && lat < northLat && lon > westLng && lon < eastLng)
			.sort((a, b) => b[4] - a[4])
			.slice(0, limit * 3);
		return towns.map(([city, lat, lon]) => ({ city, lat: String(lat), lon: String(lon) }));
	}

	static async getWeatherForCity(lat, lon) {
		const params = '&hourly=temperature_2m,weather_code&forecast_days=1&timezone=auto';
		return fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}${params}`)
			.then((res) => res.json())
			.then((response) => response.hourly);
	}
}
