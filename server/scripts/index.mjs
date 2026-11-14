import { json } from './modules/utils/fetch.mjs';
import { getGeocoding } from './modules/utils/weather.mjs';
import { countryHint, tidySuggestion } from './modules/utils/places.mjs';
import noSleep from './modules/utils/nosleep.mjs';
import { round2 } from './modules/utils/units.mjs';
import { parseQueryString } from './modules/share.mjs';
import { DEFAULT_LOCATION, closestTown } from './modules/utils/au-config.mjs';
import music from './modules/music.mjs';
import {
	message as navMessage, hideAllCanvases, isPlaying, resize, resetStatuses, latLonReceived, stopAutoRefreshTimer, registerRefreshData,
} from './modules/navigation.mjs';

document.addEventListener('DOMContentLoaded', () => {
	init();
});

const categories = [
	'Land Features',
	'Bay', 'Channel', 'Cove', 'Dam', 'Delta', 'Gulf', 'Lagoon', 'Lake', 'Ocean', 'Reef', 'Reservoir', 'Sea', 'Sound', 'Strait', 'Waterfall', 'Wharf', // Water Features
	'Amusement Park', 'Historical Monument', 'Landmark', 'Tourist Attraction', 'Zoo', // POI/Arts and Entertainment
	'College', // POI/Education
	'Beach', 'Campground', 'Golf Course', 'Harbor', 'Nature Reserve', 'Other Parks and Outdoors', 'Park', 'Racetrack',
	'Scenic Overlook', 'Ski Resort', 'Sports Center', 'Sports Field', 'Wildlife Reserve', // POI/Parks and Outdoors
	'Airport', 'Ferry', 'Marina', 'Pier', 'Port', 'Resort', // POI/Travel
	'Postal', 'Populated Place',
];
const category = categories.join(',');
const TXT_ADDRESS_SELECTOR = '#txtAddress';
const TOGGLE_FULL_SCREEN_SELECTOR = '#ToggleFullScreen';
const BNT_GET_GPS_SELECTOR = '#btnGetGps';

let isAudioPlaying = false;

const init = () => {
	document.querySelector(TXT_ADDRESS_SELECTOR).addEventListener('focus', (e) => {
		e.target.select();
	});

	registerRefreshData(loadData);

	document.querySelector('#NavigateMenu').addEventListener('click', btnNavigateMenuClick);
	document.querySelector('#NavigateRefresh').addEventListener('click', btnNavigateRefreshClick);
	document.querySelector('#NavigateNext').addEventListener('click', btnNavigateNextClick);
	document.querySelector('#NavigatePrevious').addEventListener('click', btnNavigatePreviousClick);
	document.querySelector('#NavigatePlay').addEventListener('click', btnNavigatePlayClick);
	document.querySelector('#ToggleMusic').addEventListener('click', btnAudioClick);
	document.querySelector(TOGGLE_FULL_SCREEN_SELECTOR).addEventListener('click', btnFullScreenClick);
	const btnGetGps = document.querySelector(BNT_GET_GPS_SELECTOR);
	btnGetGps.addEventListener('click', btnGetGpsClick);
	if (!navigator.geolocation) btnGetGps.style.display = 'none';

	document.querySelector('#divTwc').addEventListener('mousemove', () => {
		if (document.fullscreenElement) updateFullScreenNavigate();
	});
	// local change detection when exiting full screen via ESC key (or other non button click methods)
	window.addEventListener('resize', fullScreenResizeCheck);
	fullScreenResizeCheck.wasFull = false;

	// iOS soft keyboards often send an empty "code" for Enter/Go, so check key and keyCode too
	document.querySelector(TXT_ADDRESS_SELECTOR).addEventListener('keydown', (key) => {
		if (key.key === 'Enter' || key.code === 'Enter' || key.keyCode === 13) {
			key.preventDefault();
			formSubmit();
		}
	});
	document.querySelector('#btnGetLatLng').addEventListener('click', (e) => { e.preventDefault(); formSubmit(); });

	document.addEventListener('keydown', documentKeydown);
	document.addEventListener('touchmove', (e) => { if (document.fullscreenElement) e.preventDefault(); });

	$(TXT_ADDRESS_SELECTOR).devbridgeAutocomplete({
		serviceUrl: 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/suggest',
		deferRequestBy: 300,
		paramName: 'text',
		params: {
			f: 'json',
			category,
			maxSuggestions: 10,
		},
		dataType: 'json',
		transformResult: (response) => ({
			suggestions: response.suggestions.map((i) => ({
				value: tidySuggestion(i.text),
				data: i.magicKey,
			})),
		}),
		minChars: 3,
		showNoSuggestionNotice: true,
		noSuggestionNotice: 'No results found. Please try a different search string.',
		onSelect(suggestion) { autocompleteOnSelect(suggestion); },
		width: 'auto',
		triggerSelectOnValidInput: false,
	});

	// iOS Safari: the input's blur (keyboard closing) can swallow the "click" on a suggestion,
	// so select on pointerdown/touchend as well. preventDefault keeps focus so the list stays put.
	const ac = $(TXT_ADDRESS_SELECTOR).devbridgeAutocomplete();
	const pickSuggestion = (event) => {
		const item = event.target.closest?.('.autocomplete-suggestion');
		if (!item) return;
		const index = parseInt(item.dataset.index, 10);
		if (Number.isNaN(index) || !ac.suggestions[index]) return;
		event.preventDefault();
		ac.select(index);
	};
	ac.suggestionsContainer.addEventListener('pointerdown', pickSuggestion);
	ac.suggestionsContainer.addEventListener('touchend', pickSuggestion, { passive: false });

	// GO / Enter: geocode whatever is in the box (no need to have picked a suggestion)
	const formSubmit = () => {
		const text = document.querySelector(TXT_ADDRESS_SELECTOR).value.trim();
		// close the suggestion list and ignore late suggestion replies for a moment,
		// so the list can't pop up over the buttons after GO
		try {
			ac.hide();
			ac.disable();
			setTimeout(() => ac.enable(), 1500);
		} catch (e) { /* ignore */ }
		document.querySelector(TXT_ADDRESS_SELECTOR).blur();
		if (!text) return false;
		// if the text exactly matches a loaded suggestion, use it (exact Esri match)
		const exact = (ac.suggestions ?? []).find((sug) => sug.value.toLowerCase() === text.toLowerCase());
		if (exact) {
			autocompleteOnSelect(exact);
		} else {
			geocodeText(text);
		}
		return false;
	};

	// attempt to parse the url parameters
	const parsedParameters = parseQueryString();

	const loadFromParsed = parsedParameters.latLonQuery && parsedParameters.latLon;

	// Auto load the parsed parameters and fall back to the previous query
	const query = parsedParameters.latLonQuery ?? localStorage.getItem('latLonQuery');
	const latLon = parsedParameters.latLon ?? localStorage.getItem('latLon');
	const fromGPS = localStorage.getItem('latLonFromGPS') && !loadFromParsed;
	let savedLatLon = null;
	try {
		savedLatLon = typeof latLon === 'string' ? JSON.parse(latLon) : latLon;
		if (!(Number.isFinite(Number(savedLatLon?.lat)) && Number.isFinite(Number(savedLatLon?.lon)))) savedLatLon = null;
	} catch (e) {
		savedLatLon = null;
	}
	if (query && savedLatLon && !fromGPS) {
		const txtAddress = document.querySelector(TXT_ADDRESS_SELECTOR);
		txtAddress.value = query;
		loadData(savedLatLon);
	}
	if (fromGPS) {
		btnGetGpsClick();
	}
	// first visit: show the default location (Shell Cove, NSW)
	if (!(query && savedLatLon) && !fromGPS) {
		const txtAddress = document.querySelector(TXT_ADDRESS_SELECTOR);
		txtAddress.value = DEFAULT_LOCATION.query;
		localStorage.setItem('latLonQuery', DEFAULT_LOCATION.query);
		localStorage.setItem('latLon', JSON.stringify(DEFAULT_LOCATION.latLon));
		loadData(DEFAULT_LOCATION.latLon);
	}

	document.querySelector('#btnClearQuery').addEventListener('click', () => {
		// Stop display at current screen
		postMessage('navButton', 'stop');
		localStorage.removeItem('play');

		// remove data location from local storage
		localStorage.removeItem('latLonQuery');
		localStorage.removeItem('latLon');
		localStorage.removeItem('latLonFromGPS');
		localStorage.removeItem('nearbyCitiesFromLocality');

		// clear html elements
		document.querySelector('#spanCity').innerHTML = '';
		document.querySelector('#spanState').innerHTML = '';

		const searchBarInput = document.querySelector(TXT_ADDRESS_SELECTOR);
		searchBarInput.value = '';
		searchBarInput.blur();

		hideAllCanvases();
		const loadingId = document.querySelector('#loading');
		// display is set as style.display = 'none' in navigation.mjs
		// so we have to set it to '' to show it again;
		loadingId.style.display = '';
		showSearchMessage('Enter your location above to continue');

		// document.querySelector('#spanStationId').innerHTML = '';
		// document.querySelector('#spanRadarId').innerHTML = '';
		// document.querySelector('#spanZoneId').innerHTML = '';

		document.querySelector('#chkAutoRefresh').checked = true;
		localStorage.removeItem('autoRefresh');

		document.querySelector(BNT_GET_GPS_SELECTOR).classList.remove('active');
	});

	// swipe functionality
	document.querySelector('#container').addEventListener('swiped-left', () => swipeCallBack('left'));
	document.querySelector('#container').addEventListener('swiped-right', () => swipeCallBack('right'));
};

// show a short message on the loading screen (eg place not found)
const showSearchMessage = (text) => {
	const instructions = document.querySelector('#loading .instructions');
	if (instructions) instructions.textContent = text;
};

const useLocation = (geometry) => {
	// time zone from the place search (used by the backup forecast outside Australia)
	window.placeTimeZoneHint = geometry.timezone ?? null;
	localStorage.removeItem('latLonFromGPS');
	document.querySelector(BNT_GET_GPS_SELECTOR).classList.remove('active');
	doRedirectToGeometry(geometry);
};

// Esri "find" for a suggestion (magicKey) or free text, worldwide (or one country). Capped at 4 seconds.
const esriFind = async (text, magicKey, iso2) => {
	const data = await json('https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/find', {
		data: {
			text,
			...(magicKey ? { magicKey } : {}),
			...(iso2 && iso2 !== 'XX' ? { sourceCountry: iso2 } : {}),
			maxLocations: 1,
			f: 'json',
		},
		retryCount: 0,
		timeout: 4000,
	});
	const loc = data?.locations?.[0];
	if (!loc?.feature?.geometry) return null;
	return loc.feature.geometry;
};

// Open-Meteo geocoder, searching on the place name before the first comma. Capped at 4 seconds.
// iso2: limit to one country. Otherwise the biggest match wins.
const openMeteoFind = async (text, iso2) => {
	const name = text.split(',')[0].trim();
	if (!name) return null;
	const result = await getGeocoding(name, { timeout: 4000 }, iso2 && iso2 !== 'XX' ? iso2 : null);
	let places = result?.results ?? [];
	if (places.length === 0) return null;
	const lower = text.toLowerCase();
	// prefer a match in the region/state named in the text
	const inRegion = places.filter((pl) => pl.admin1 && lower.includes(pl.admin1.toLowerCase()));
	if (inRegion.length > 0) places = inRegion;
	const best = [...places].sort((a, b) => (b.population ?? 0) - (a.population ?? 0))[0];
	return { x: best.longitude, y: best.latitude, timezone: best.timezone };
};

const STATE_NAMES = {
	NSW: ['new south wales', 'nsw'],
	VIC: ['victoria', 'vic'],
	QLD: ['queensland', 'qld'],
	SA: ['south australia', 'sa'],
	WA: ['western australia', 'wa'],
	TAS: ['tasmania', 'tas'],
	NT: ['northern territory', 'nt'],
	ACT: ['australian capital territory', 'act'],
};

// bundled Australian town list (instant, works offline). Matches "Town" or "Town, ..., State".
const townFind = (text) => {
	const parts = text.split(',').map((p) => p.trim().toLowerCase()).filter(Boolean);
	if (parts.length === 0) return null;
	const name = parts[0];
	const matches = (window.AuTowns ?? []).filter((t) => t[0].toLowerCase() === name);
	if (matches.length === 0) return null;
	const rest = parts.slice(1).filter((p) => p !== 'australia' && p !== 'aus');
	let town;
	if (rest.length > 0) {
		// "Town, ..., State": the state must match
		town = matches.find((t) => rest.some((p) => (STATE_NAMES[t[3]] ?? []).includes(p)));
	} else {
		// just "Town": the biggest Australian town of that name (eg Perth -> Perth WA)
		[town] = [...matches].sort((a, b) => b[4] - a[4]);
	}
	return town ? { x: town[2], y: town[1] } : null;
};

// resolved places saved on this device, so a return visit starts instantly
const GEO_CACHE_KEY = 'placeCache';
const cacheKey = (text) => text.trim().toLowerCase().replace(/\s+/g, ' ');
const readPlaceCache = (text) => {
	try {
		const hit = JSON.parse(localStorage.getItem(GEO_CACHE_KEY) ?? '{}')[cacheKey(text)];
		return hit && Number.isFinite(hit.x) && Number.isFinite(hit.y) ? hit : null;
	} catch (e) {
		return null;
	}
};
const writePlaceCache = (text, geometry) => {
	try {
		const cache = JSON.parse(localStorage.getItem(GEO_CACHE_KEY) ?? '{}');
		cache[cacheKey(text)] = { x: Number(geometry.x), y: Number(geometry.y), at: Date.now() };
		// keep the 50 most recent
		const trimmed = Object.fromEntries(Object.entries(cache).sort((a, b) => b[1].at - a[1].at).slice(0, 50));
		localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(trimmed));
	} catch (e) { /* storage full or blocked */ }
};

const validGeometry = (g) => g && Number.isFinite(Number(g.x)) && Number.isFinite(Number(g.y))
	&& Math.abs(Number(g.y)) <= 90 && Math.abs(Number(g.x)) <= 180;

// Esri ranks places by importance, so prefer its answer; Open-Meteo is the backup.
// Both run at the same time; whichever is usable first (Esri preferred) wins, all within 5 seconds.
const bestOf = (esriPromise, openMeteoPromise) => new Promise((resolve) => {
	let esriDone = false;
	let omResult = null;
	let omDone = false;
	const finish = (g) => resolve(validGeometry(g) ? g : null);
	esriPromise.then((g) => {
		esriDone = true;
		if (validGeometry(g)) finish(g);
		else if (omDone) finish(omResult);
	}).catch((error) => {
		esriDone = true;
		console.warn(`Esri place search failed: ${error?.message ?? error}`);
		if (omDone) finish(omResult);
	});
	openMeteoPromise.then((g) => { omResult = g; }).catch((error) => {
		console.warn(`Open-Meteo place search failed: ${error?.message ?? error}`);
	}).finally(() => {
		omDone = true;
		if (esriDone) finish(omResult);
	});
	// Esri slow or blocked: take Open-Meteo's answer after 2.5 s
	setTimeout(() => { if (omDone && validGeometry(omResult)) finish(omResult); }, 2500);
	// hard stop, in case a blocked request never settles
	setTimeout(() => finish(omResult), 5000);
});

const findPlace = async (text, magicKey) => {
	// 1. saved on this device
	const cached = readPlaceCache(text);
	if (cached) return cached;
	const hint = countryHint(text);
	// 2. built-in Australian town list (unless another country is named)
	if (hint === null || hint === 'AU') {
		const town = townFind(text);
		if (validGeometry(town)) {
			writePlaceCache(text, town);
			return town;
		}
	}
	// 3. remote geocoders in parallel (worldwide, or limited to the named country)
	const geometry = await bestOf(esriFind(text, magicKey, hint), openMeteoFind(text, hint));
	if (geometry) writePlaceCache(text, geometry);
	return geometry;
};

let lastSelect = { value: '', at: 0 };

const geocodeText = async (text, magicKey) => {
	showSearchMessage(`Finding ${text}...`);
	const geometry = await findPlace(text, magicKey);
	if (geometry) {
		useLocation(geometry);
	} else {
		showSearchMessage(`Couldn't find "${text}". Try a town name or postcode.`);
		document.querySelector('#loading').style.display = '';
	}
};

const autocompleteOnSelect = async (suggestion) => {
	// pointerdown, touchend and click can all fire for one tap: only act once
	const now = Date.now();
	if (lastSelect.value === suggestion.value && now - lastSelect.at < 2000) return;
	lastSelect = { value: suggestion.value, at: now };
	document.querySelector(TXT_ADDRESS_SELECTOR).value = suggestion.value;
	await geocodeText(suggestion.value, suggestion.data);
};

const doRedirectToGeometry = (geom, haveDataCallback) => {
	const latLon = { lat: round2(geom.y, 4), lon: round2(geom.x, 4) };
	// Save the query
	localStorage.setItem('latLonQuery', document.querySelector(TXT_ADDRESS_SELECTOR).value);
	localStorage.setItem('latLon', JSON.stringify(latLon));

	// get the data
	loadData(latLon, haveDataCallback);
};

const btnFullScreenClick = () => {
	if (document.fullscreenElement) {
		exitFullscreen();
	} else {
		enterFullScreen();
	}

	if (isPlaying()) {
		noSleep(true);
	} else {
		noSleep(false);
	}

	updateFullScreenNavigate();

	return false;
};

const enterFullScreen = () => {
	const element = document.querySelector('#divTwc');

	// Supports most browsers and their versions.
	const requestMethod = element.requestFullScreen || element.webkitRequestFullScreen
		|| element.mozRequestFullScreen || element.msRequestFullscreen;

	if (requestMethod) {
		// Native full screen.
		requestMethod.call(element, { navigationUI: 'hide' });
	} else {
		// iOS doesn't support FullScreen API.
		window.scrollTo(0, 0);
	}
	resize();
	updateFullScreenNavigate();

	// change hover text and image
	const img = document.querySelector(TOGGLE_FULL_SCREEN_SELECTOR);
	img.src = 'images/nav/ic_fullscreen_exit_white_24dp_2x.png';
	img.title = 'Exit fullscreen';
};

const exitFullscreen = () => {
	// exit full-screen

	if (document.exitFullscreen) {
		// Chrome 71 broke this if the user pressed F11 to enter full screen mode.
		document.exitFullscreen();
	} else if (document.webkitExitFullscreen) {
		document.webkitExitFullscreen();
	} else if (document.mozCancelFullScreen) {
		document.mozCancelFullScreen();
	} else if (document.msExitFullscreen) {
		document.msExitFullscreen();
	}
	resize();
	exitFullScreenVisibilityChanges();
};

const exitFullScreenVisibilityChanges = () => {
	// change hover text and image
	const img = document.querySelector(TOGGLE_FULL_SCREEN_SELECTOR);
	img.src = 'images/nav/ic_fullscreen_white_24dp_2x.png';
	img.title = 'Enter fullscreen';
	document.querySelector('#divTwc').classList.remove('no-cursor');
	const divTwcBottom = document.querySelector('#divTwcBottom');
	divTwcBottom.classList.remove('hidden');
	divTwcBottom.classList.add('visible');
};

const btnNavigateMenuClick = () => {
	postMessage('navButton', 'menu');
	return false;
};

const updateAudioButton = () => {
	const btnAudio = document.querySelector('#ToggleMusic');
	if (isAudioPlaying) {
		btnAudio.src = 'images/nav/ic_volume_up_white_24dp_2x.png';
		btnAudio.title = 'Pause Music';
	} else {
		btnAudio.src = 'images/nav/ic_volume_off_white_24dp_2x.png';
		btnAudio.title = 'Play Music';
	}
};

const btnAudioClick = async () => {
	isAudioPlaying = await music.toggle();
	updateAudioButton();
};

const loadData = (_latLon, haveDataCallback) => {
	// if latlon is provided store it locally
	if (_latLon) loadData.latLon = _latLon;
	// get the data
	const { latLon } = loadData;
	// if there's no data stop
	if (!latLon) return;

	document.querySelector(TXT_ADDRESS_SELECTOR).blur();
	stopAutoRefreshTimer();
	latLonReceived(latLon, haveDataCallback);
};

const swipeCallBack = (direction) => {
	switch (direction) {
		case 'left':
			btnNavigateNextClick();
			break;

		case 'right':
		default:
			btnNavigatePreviousClick();
			break;
	}
};

// Pushes user back to "Progress" display and re-loads data
const btnNavigateRefreshClick = () => {
	resetStatuses();
	loadData();

	return false;
};

const btnNavigateNextClick = () => {
	postMessage('navButton', 'next');

	return false;
};

const btnNavigatePreviousClick = () => {
	postMessage('navButton', 'previous');

	return false;
};

let navigateFadeIntervalId = null;

const updateFullScreenNavigate = () => {
	document.activeElement.blur();
	const divTwcBottom = document.querySelector('#divTwcBottom');
	divTwcBottom.classList.remove('hidden');
	divTwcBottom.classList.add('visible');
	document.querySelector('#divTwc').classList.remove('no-cursor');

	if (navigateFadeIntervalId) {
		clearTimeout(navigateFadeIntervalId);
		navigateFadeIntervalId = null;
	}

	navigateFadeIntervalId = setTimeout(() => {
		if (document.fullscreenElement) {
			divTwcBottom.classList.remove('visible');
			divTwcBottom.classList.add('hidden');
			document.querySelector('#divTwc').classList.add('no-cursor');
		}
	}, 2000);
};

const documentKeydown = (e) => {
	const { key } = e;

	if (document.fullscreenElement || document.activeElement === document.body) {
		switch (key) {
			case ' ': // Space
				// don't scroll
				e.preventDefault();
				btnNavigatePlayClick();
				return false;

			case 'ArrowRight':
			case 'PageDown':
				// don't scroll
				e.preventDefault();
				btnNavigateNextClick();
				return false;

			case 'ArrowLeft':
			case 'PageUp':
				// don't scroll
				e.preventDefault();
				btnNavigatePreviousClick();
				return false;

			case 'ArrowUp': // Home
				e.preventDefault();
				btnNavigateMenuClick();
				return false;

			case '0': // "O" Restart
				btnNavigateRefreshClick();
				return false;

			case 'F':
			case 'f':
				btnFullScreenClick();
				return false;

			default:
		}
	}
	return false;
};

const btnNavigatePlayClick = () => {
	postMessage('navButton', 'playToggle');

	return false;
};

// post a message to the iframe
const postMessage = (type, myMessage = {}) => {
	navMessage({ type, message: myMessage });
};

// resolves with a position, or null if location is denied, unavailable or too slow
const getPosition = async () => new Promise((resolve) => {
	const timer = setTimeout(() => resolve(null), 20_000);
	try {
		navigator.geolocation.getCurrentPosition(
			(position) => { clearTimeout(timer); resolve(position); },
			(error) => { clearTimeout(timer); console.warn(`Location unavailable: ${error?.message ?? error}`); resolve(null); },
			{ enableHighAccuracy: false, timeout: 15_000, maximumAge: 10 * 60 * 1000 },
		);
	} catch (e) {
		clearTimeout(timer);
		resolve(null);
	}
});

const btnGetGpsClick = async () => {
	if (!navigator.geolocation) return;
	const btn = document.querySelector(BNT_GET_GPS_SELECTOR);

	// toggle first
	if (btn.classList.contains('active')) {
		btn.classList.remove('active');
		localStorage.removeItem('latLonFromGPS');
		return;
	}

	// set gps active
	btn.classList.add('active');

	// get position
	const position = await getPosition();
	if (!position) {
		// location denied or unavailable: fall back to the last searched place or the default
		btn.classList.remove('active');
		localStorage.removeItem('latLonFromGPS');
		const saved = (() => { try { return JSON.parse(localStorage.getItem('latLon')); } catch (e) { return null; } })();
		const txt = document.querySelector(TXT_ADDRESS_SELECTOR);
		if (saved?.lat !== undefined) {
			txt.value = localStorage.getItem('latLonQuery') ?? DEFAULT_LOCATION.query;
			loadData(saved);
		} else {
			txt.value = DEFAULT_LOCATION.query;
			loadData(DEFAULT_LOCATION.latLon);
		}
		return;
	}
	const { latitude, longitude } = position.coords;

	const txtAddress = document.querySelector(TXT_ADDRESS_SELECTOR);
	txtAddress.value = `${round2(latitude, 4)}, ${round2(longitude, 4)}`;

	const town = closestTown(latitude, longitude);
	const query = town ? `${town.name}, ${town.state}` : txtAddress.value;
	txtAddress.value = query;
	doRedirectToGeometry({ y: latitude, x: longitude });
	localStorage.setItem('latLonFromGPS', true);
};

// check for change in full screen triggered by browser and run local functions
const fullScreenResizeCheck = () => {
	if (fullScreenResizeCheck.wasFull && !document.fullscreenElement) {
		// leaving full screen
		exitFullScreenVisibilityChanges();
	}
	if (!fullScreenResizeCheck.wasFull && document.fullscreenElement) {
		// entering full screen
		// can't do much here because a UI interaction is required to change the full screen div element
	}

	// store state of fullscreen element for next change detection
	fullScreenResizeCheck.wasFull = !!document.fullscreenElement;
};

// Required for Experimental features
export default btnNavigateRefreshClick;
export { loadData };
