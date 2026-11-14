// Upstream gated "nearby cities" features behind an experimental flag because they needed a
// private CORS proxy. This adaptation uses a bundled list of Australian towns instead, so the
// features are always on.
export default class ExperimentalFeatures {
	static getExperimentalFlag() {
		return true;
	}
}
