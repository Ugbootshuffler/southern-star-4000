// track state of nosleep locally to avoid a null case error
// when nosleep.disable is called without first calling .enable

let wakeLock = false;

const noSleep = (enable = false) => {
	// get a nosleep controller (keeping the screen awake is optional: never let it break the page)
	if (typeof NoSleep === 'undefined') return false;
	try {
		if (!noSleep.controller) noSleep.controller = new NoSleep();
	} catch (e) {
		return false;
	}
	// don't call anything if the states match
	if (wakeLock === enable) return false;
	// store the value
	wakeLock = enable;
	// call the function
	try {
		const result = enable ? noSleep.controller.enable() : noSleep.controller.disable();
		// Safari/iOS rejects the wake lock (NotAllowedError) until the user taps the page
		if (result && typeof result.catch === 'function') {
			return result.catch(() => { wakeLock = false; });
		}
		return result;
	} catch (e) {
		wakeLock = false;
		return false;
	}
};

export default noSleep;
