// simple shuffle music player for the bundled royalty-free tracks (see credits.html)
const PLAYLIST_URL = 'music/playlist.json';

let audio;
let playlist = [];
let order = [];
let position = 0;

const shuffle = (array) => {
	const result = [...array];
	for (let i = result.length - 1; i > 0; i -= 1) {
		const j = Math.floor(Math.random() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
};

const updateNowPlaying = () => {
	const elem = document.querySelector('#nowPlaying');
	if (!elem) return;
	const track = playlist[order[position]];
	elem.textContent = track ? `"${track.title}" by ${track.artist} (${track.licence})` : '';
};

const load = async () => {
	if (playlist.length) return;
	const response = await fetch(PLAYLIST_URL);
	playlist = await response.json();
	order = shuffle(playlist.map((_, i) => i));
	position = 0;
	audio = new Audio();
	audio.volume = 0.6;
	audio.addEventListener('ended', () => {
		position = (position + 1) % order.length;
		if (position === 0) order = shuffle(order);
		audio.src = playlist[order[position]].file;
		audio.play();
		updateNowPlaying();
	});
	audio.src = playlist[order[position]].file;
};

// returns the new playing state
const toggle = async () => {
	await load();
	if (audio.paused) {
		try {
			await audio.play();
		} catch (error) {
			console.error('Unable to play music', error);
			return false;
		}
		updateNowPlaying();
		return true;
	}
	audio.pause();
	return false;
};

const next = async () => {
	await load();
	position = (position + 1) % order.length;
	audio.src = playlist[order[position]].file;
	await audio.play();
	updateNowPlaying();
};

export default { toggle, next };
