// Country hints in a place search ("Dublin, Ireland", "Lae, PNG", "Limerick, IRL").
// Used to decide whether to prefer Australian results.

const COUNTRIES = {
	// name or code (lower case) -> ISO 3166 alpha-2
	australia: 'AU', aus: 'AU', au: 'AU',
	ireland: 'IE', 'republic of ireland': 'IE', eire: 'IE', irl: 'IE', ie: 'IE',
	'papua new guinea': 'PG', png: 'PG', pg: 'PG',
	'new zealand': 'NZ', nzl: 'NZ', nz: 'NZ', aotearoa: 'NZ',
	'united kingdom': 'GB', uk: 'GB', gbr: 'GB', gb: 'GB', england: 'GB', scotland: 'GB', 'northern ireland': 'GB', britain: 'GB', 'great britain': 'GB',
	'united states': 'US', usa: 'US', us: 'US', america: 'US',
	canada: 'CA', can: 'CA',
	fiji: 'FJ', fji: 'FJ',
	indonesia: 'ID', idn: 'ID',
	singapore: 'SG', sgp: 'SG',
	philippines: 'PH', phl: 'PH',
	japan: 'JP', jpn: 'JP',
	china: 'CN', chn: 'CN',
	india: 'IN', ind: 'IN',
	france: 'FR', fra: 'FR',
	germany: 'DE', deu: 'DE',
	spain: 'ES', esp: 'ES',
	italy: 'IT', ita: 'IT',
	greece: 'GR', grc: 'GR',
	netherlands: 'NL', nld: 'NL',
	'south africa': 'ZA', zaf: 'ZA',
	'solomon islands': 'SB', slb: 'SB',
	vanuatu: 'VU', vut: 'VU',
	samoa: 'WS', tonga: 'TO', 'new caledonia': 'NC', thailand: 'TH', tha: 'TH', vietnam: 'VN', vnm: 'VN', malaysia: 'MY', mys: 'MY',
};

// ISO3 codes Esri puts on the end of suggestions -> readable names
const ISO3_NAMES = {
	IRL: 'Ireland', PNG: 'Papua New Guinea', GBR: 'United Kingdom', USA: 'USA', NZL: 'New Zealand', CAN: 'Canada', FJI: 'Fiji', IDN: 'Indonesia', SGP: 'Singapore',
};

const AU_STATES = ['new south wales', 'nsw', 'victoria', 'vic', 'queensland', 'qld', 'south australia', 'sa', 'western australia', 'wa',
	'tasmania', 'tas', 'northern territory', 'nt', 'australian capital territory', 'act', 'jervis bay territory'];

// the country named in the text (ISO2), 'AU' for an Australian state, or null when not stated
const countryHint = (text) => {
	const parts = text.split(',').map((p) => p.trim().toLowerCase()).filter(Boolean);
	if (parts.length === 0) return null;
	const whole = text.trim().toLowerCase();
	if (COUNTRIES[whole] && whole.length > 3) return COUNTRIES[whole]; // eg just "Papua New Guinea"
	const rest = parts.slice(1);
	// "new south wales" must not be read as Wales: parts are matched whole
	// eslint-disable-next-line no-restricted-syntax
	for (const part of rest.reverse()) {
		if (AU_STATES.includes(part)) return 'AU';
		if (COUNTRIES[part]) return COUNTRIES[part];
		if (/^[a-z]{3}$/.test(part) && part !== 'aus') return 'XX'; // some other Esri ISO3 code
	}
	return null;
};

// tidy an Esri suggestion for display: drop ", AUS", spell out a few country codes
const tidySuggestion = (text) => text
	.replace(/, AUS$/, '')
	.replace(/, ([A-Z]{3})$/, (m, code) => (ISO3_NAMES[code] ? `, ${ISO3_NAMES[code]}` : m));

export { countryHint, tidySuggestion, COUNTRIES };
