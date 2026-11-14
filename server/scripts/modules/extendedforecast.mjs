// display extended forecast graphically
// technically uses the same data as the local forecast, we'll let the browser do the caching of that

import STATUS from './status.mjs';
import { getWeatherIconFromIconLink } from './icons.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';
import { getConditionText } from './utils/weather.mjs';
import { bomIconToCondition } from './utils/bom.mjs';

import ConversionHelpers from './utils/conversionHelpers.mjs';

class ExtendedForecast extends WeatherDisplay {
	constructor(navId, elemId) {
		super(navId, elemId, 'Extended Forecast', true);

		// set timings
		this.timing.totalScreens = 2;
	}

	static dayConditionTextSanitizer(text) {
		// short labels that fit the day panels
		const labels = [
			[/thunderstorm/i, 'T-Storms'],
			[/freezing drizzle|freezing rain/i, 'Frz Rain'],
			[/violent rain showers|heavy rain/i, 'Heavy Rain'],
			[/rain showers/i, 'Showers'],
			[/rain/i, 'Rain'],
			[/drizzle/i, 'Drizzle'],
			[/snow/i, 'Snow'],
			[/fog/i, 'Fog'],
			[/overcast/i, 'Cloudy'],
			[/partly cloudy/i, 'Partly Cloudy'],
			[/mainly clear/i, 'Mostly Sunny'],
			[/clear sky/i, 'Sunny'],
		];
		const match = labels.find(([regex]) => regex.test(text));
		return match ? match[1] : text.split(' ').slice(0, 2).join(' ');
	}

	async getData(_weatherParameters) {
		if (!super.getData(_weatherParameters)) return;

		this.data = parse(_weatherParameters);
		this.screenIndex = 0;
		this.setStatus(STATUS.loaded);
	}

	async drawCanvas() {
		super.drawCanvas();

		// determine bounds
		// grab the first three or second set of three array elements
		const forecast = this.data.slice(0 + 3 * this.screenIndex, 3 + this.screenIndex * 3);

		// create each day template
		const days = forecast.map((Day) => {
			const fill = {
				icon: { type: 'img', src: Day.icon },
				condition: ExtendedForecast.dayConditionTextSanitizer(Day.text),
				date: Day.dayName,
			};

			const { low } = Day;
			if (low !== undefined) {
				fill['value-lo'] = Math.round(low);
			}
			const { high } = Day;
			fill['value-hi'] = Math.round(high);

			// return the filled template
			return this.fillTemplate('day', fill);
		});

		// empty and update the container
		const dayContainer = this.elem.querySelector('.day-container');
		dayContainer.innerHTML = '';
		dayContainer.append(...days);
		this.finishDraw();
	}
}

// one entry per day with high and low temperatures
const parse = (fullForecast) => {
	const forecast = [];

	Object.entries(fullForecast.forecast).forEach(([dateString, period]) => {
		if (!period.hours?.length) return;
		const text = getConditionText(parseInt(period.weather_code, 10));
		const date = new Date(`${dateString}T12:00:00`);

		forecast.push({
			dateString,
			text,
			icon: getWeatherIconFromIconLink(text, fullForecast.timeZone, true),
			date,
			dayName: date.toLocaleDateString('en-AU', { weekday: 'long' }),
			high: ConversionHelpers.convertTemperatureUnits(period.temperature_2m_max),
			low: ConversionHelpers.convertTemperatureUnits(period.temperature_2m_min),
		});
	});

	// overlay the BOM daily forecast when available (BOM data setting on)
	const bomDays = fullForecast.bom?.daily?.days ?? [];
	bomDays.forEach((day) => {
		// BOM dates are local midnight expressed in UTC, shift to midday to get the local date
		const local = new Date(new Date(day.date).getTime() + 12 * 3600 * 1000)
			.toLocaleDateString('en-CA', { timeZone: fullForecast.timeZone });
		const match = forecast.find((f) => f.dateString === local);
		if (!match) return;
		const text = bomIconToCondition(day.icon_descriptor);
		match.text = text;
		match.icon = getWeatherIconFromIconLink(text, fullForecast.timeZone, true);
		if (day.temp_max !== null && day.temp_max !== undefined) match.high = ConversionHelpers.convertTemperatureUnits(day.temp_max);
		if (day.temp_min !== null && day.temp_min !== undefined) match.low = ConversionHelpers.convertTemperatureUnits(day.temp_min);
	});

	return forecast;
};

// register display
registerDisplay(new ExtendedForecast(7, 'extended-forecast'));
