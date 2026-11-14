// latest observations for nearby towns
// Default: Open-Meteo current conditions for the nearest towns (model estimates).
// With the "BOM data" setting on: real BOM automatic weather station observations near those towns.
import { directionToNSEW } from './utils/calc.mjs';
import STATUS from './status.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';
import { getConditionText, getMultiPoint } from './utils/weather.mjs';
import { isBomEnabled, getObservations } from './utils/bom.mjs';
import { nearbyTowns } from './utils/au-config.mjs';
import ConversionHelpers from './utils/conversionHelpers.mjs';

const MAX_ROWS = 7;

class LatestObservations extends WeatherDisplay {
	constructor(navId, elemId) {
		super(navId, elemId, 'Latest Observations', true);
		this.showOnProgress = false;
	}

	async getData(_weatherParameters) {
		if (!super.getData(_weatherParameters)) return;
		const weatherParameters = _weatherParameters ?? this.weatherParameters;
		const { latitude, longitude } = weatherParameters;

		try {
			const bom = isBomEnabled();
			// more candidate towns when using BOM because several towns share a station
			const towns = nearbyTowns(latitude, longitude, { count: bom ? 16 : MAX_ROWS, minSpacingKm: 8, minPopulation: 1500 });
			const models = await getMultiPoint(towns);

			let rows = towns.map((town, i) => {
				const current = models[i]?.current ?? {};
				return {
					name: town.name,
					distance: town.distance,
					temp: current.temperature_2m,
					weather: getConditionText(current.weather_code),
					windSpeed: current.wind_speed_10m,
					windDirection: directionToNSEW(current.wind_direction_10m),
				};
			});

			if (bom) {
				const observations = await Promise.all(towns.map((town) => getObservations(town.lat, town.lon)));
				const seen = new Set();
				const bomRows = [];
				observations.forEach((obs, i) => {
					if (!obs?.station || obs.temp === null || obs.temp === undefined) return;
					if (seen.has(obs.station.bom_id)) return;
					seen.add(obs.station.bom_id);
					bomRows.push({
						name: obs.station.name,
						distance: towns[i].distance,
						temp: obs.temp,
						weather: rows[i].weather,
						windSpeed: obs.wind?.speed_kilometre ?? 0,
						windDirection: obs.wind?.direction === 'CALM' ? '' : (obs.wind?.direction ?? ''),
					});
				});
				if (bomRows.length > 0) {
					rows = bomRows;
					this.source = 'BOM';
				}
			} else {
				this.source = 'Open-Meteo';
			}

			this.data = rows.filter((r) => r.temp !== undefined && r.temp !== null).slice(0, MAX_ROWS);
		} catch (error) {
			console.error('Latest observations failed', error);
			this.data = [];
		}

		if (this.data.length === 0) {
			this.setStatus(STATUS.noData);
			return;
		}
		this.setStatus(STATUS.loaded);
	}

	async drawCanvas() {
		super.drawCanvas();

		// model estimates are labelled "Nearby Conditions", real BOM station data "Latest Observations"
		const top = this.elem.querySelector('.header .title.dual .top');
		const bottom = this.elem.querySelector('.header .title.dual .bottom');
		if (top && bottom) {
			top.innerHTML = this.source === 'BOM' ? 'Latest' : 'Nearby';
			bottom.innerHTML = this.source === 'BOM' ? 'Observations' : 'Conditions';
		}

		this.elem.querySelector('.column-headers .temp.metric')?.classList.add('show');
		const unit = ConversionHelpers.getTemperatureUnitText();
		const tempHeader = this.elem.querySelector('.column-headers .temp.metric');
		if (tempHeader) tempHeader.innerHTML = `&deg;${unit}`;

		const lines = this.data.map((condition) => {
			const temp = Math.round(ConversionHelpers.convertTemperatureUnits(condition.temp));
			const windSpeed = Math.round(ConversionHelpers.convertWindUnits(condition.windSpeed));
			const fill = {
				location: shortenName(condition.name).substr(0, 13),
				temp,
				weather: shortenCurrentConditions(condition.weather).substr(0, 9),
			};
			if (windSpeed > 0) {
				const dir = condition.windDirection ?? '';
				fill.wind = dir + ' '.repeat(Math.max(0, 5 - dir.length - windSpeed.toString().length)) + windSpeed.toString();
			} else {
				fill.wind = 'Calm';
			}
			return this.fillTemplate('observation-row', fill);
		});

		const linesContainer = this.elem.querySelector('.observation-lines');
		linesContainer.innerHTML = '';
		linesContainer.append(...lines);

		this.finishDraw();
	}
}

const shortenName = (name) => name
	.replace(/ - /g, ' ')
	.replace(/^(Point|Port) /, 'Pt ')
	.replace('Observatory Hill', 'Obs Hill')
	.replace(' Airport', ' AP')
	.replace(' Harbour', ' Hbr')
	.replace('Mount ', 'Mt ');

const shortenCurrentConditions = (_condition = '') => {
	let condition = _condition;
	condition = condition.replace(/Slight /, 'L ');
	condition = condition.replace(/Light /, 'L ');
	condition = condition.replace(/Moderate /, '');
	condition = condition.replace(/Heavy/, 'H');
	condition = condition.replace(/Violent /, 'H ');
	condition = condition.replace(/Partly cloudy/, 'P Cloudy');
	condition = condition.replace(/Mainly clear/, 'M Clear');
	condition = condition.replace(/Clear sky/, 'Clear');
	condition = condition.replace(/Rain showers/, 'Showers');
	condition = condition.replace(/Thunderstorm.*/, 'T\'storm');
	condition = condition.replace(/Drizzle/, 'Drzl');
	return condition;
};

// register display
registerDisplay(new LatestObservations(2, 'latest-observations'));
