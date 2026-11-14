// Times for the selected location (which may be outside Australia).
// Open-Meteo returns times as local wall-clock strings for the location (timezone=auto),
// eg "2026-11-14T10:00". `new Date(thatString)` reads it as device-local wall clock, so to
// compare against "now" we need "now" as the location's wall clock, read the same way.
import { DateTime } from '../../vendor/auto/luxon.mjs';

const locationTimeZone = () => window.locationTimeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;

// luxon DateTime "now" in the location's time zone
const locationDateTime = () => DateTime.now().setZone(locationTimeZone());

// a JS Date whose local fields equal the location's current wall clock
const locationNow = () => {
	const d = locationDateTime();
	return new Date(d.year, d.month - 1, d.day, d.hour, d.minute, d.second);
};

export { locationTimeZone, locationDateTime, locationNow };
