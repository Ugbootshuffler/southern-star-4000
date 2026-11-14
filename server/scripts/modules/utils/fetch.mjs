import { rewriteUrl } from './cors.mjs';

const json = (url, params) => fetchAsync(url, 'json', params);
const text = (url, params) => fetchAsync(url, 'text', params);
const blob = (url, params) => fetchAsync(url, 'blob', params);

const DEFAULT_TIMEOUT_MS = 20_000;

const fetchAsync = async (_url, responseType, _params = {}) => {
	// combine default and provided parameters
	const params = {
		method: 'GET',
		retryCount: 0,
		timeout: DEFAULT_TIMEOUT_MS,
		..._params,
	};
	// store original number of retries
	params.originalRetries = params.retryCount;

	// build a url, including the rewrite for cors if necessary
	let corsUrl = _url;
	if (params.cors === true) corsUrl = rewriteUrl(_url);
	const url = new URL(corsUrl, window.location.href);
	// add parameters if necessary
	if (params.data) {
		Object.keys(params.data).forEach((key) => {
			url.searchParams.append(key, params.data[key]);
		});
	}

	// make the request
	const response = await doFetch(url, params);

	// check for ok response
	if (!response.ok) throw new Error(`Fetch error ${response.status} ${response.statusText} while fetching ${response.url}`);
	// return the requested response
	switch (responseType) {
		case 'json':
			return response.json();
		case 'text':
			return response.text();
		case 'blob':
			return response.blob();
		default:
			return response;
	}
};

// only pass standard options to fetch(); a plain GET with no custom headers or credentials
// stays a "simple" CORS request (no preflight) and doesn't send cookies or a referrer, which
// keeps privacy browsers such as Brave (Shields) happy
const fetchInit = (params) => ({
	method: params.method,
	mode: 'cors',
	credentials: 'omit',
	referrerPolicy: 'no-referrer',
	cache: params.cacheMode ?? 'default',
});

const singleFetch = async (url, params) => {
	const controller = typeof AbortController === 'function' ? new AbortController() : null;
	const timer = controller && params.timeout ? setTimeout(() => controller.abort(), params.timeout) : null;
	try {
		return await fetch(url, { ...fetchInit(params), signal: controller?.signal });
	} finally {
		if (timer) clearTimeout(timer);
	}
};

// fetch with retry and back-off
// retries on network errors, timeouts, 429 and 5xx responses
const doFetch = async (url, params) => {
	const retriesLeft = params.retryCount ?? 0;
	let response;
	try {
		response = await singleFetch(url, params);
	} catch (error) {
		if (retriesLeft <= 0) throw error;
		console.warn(`Request failed (${error?.name ?? error}), retrying: ${url}`);
		return delay(retryDelay(params.originalRetries - retriesLeft + 1), doFetch, url, { ...params, retryCount: retriesLeft - 1 });
	}
	const retryable = response.status === 429 || (response.status >= 500 && response.status <= 599);
	if (retryable && retriesLeft > 0) {
		// call the "still waiting" function
		if (typeof params.stillWaiting === 'function' && retriesLeft === params.originalRetries) params.stillWaiting();
		return delay(retryDelay(params.originalRetries - retriesLeft + 1), doFetch, url, { ...params, retryCount: retriesLeft - 1 });
	}
	return response;
};

const delay = (time, func, ...args) => new Promise((resolve, reject) => {
	setTimeout(() => {
		Promise.resolve().then(() => func(...args)).then(resolve, reject);
	}, time);
});

const retryDelay = (retryNumber) => {
	switch (retryNumber) {
		case 1: return 1000;
		case 2: return 2000;
		case 3: return 5000;
		case 4: return 10_000;
		default: return 30_000;
	}
};

export {
	json,
	text,
	blob,
};
