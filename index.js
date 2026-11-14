// Local development server for Southern Star 4000.
// The production site is fully static (see `npm run build`, output in ./docs).
//   npm start            -> renders views/index.ejs on the fly from ./server (development)
//   DIST=1 npm start     -> serves the built static site from ./docs
const fs = require('fs');
const path = require('path');
const express = require('express');

const app = express();
const port = process.env.PORT ?? process.env.WS4KP_PORT ?? 8080;
const { version } = JSON.parse(fs.readFileSync('package.json'));

app.set('view engine', 'ejs');

if (process.env?.DIST === '1') {
	app.use('/', express.static(path.join(__dirname, './docs')));
} else {
	const index = (req, res) => res.render(path.join(__dirname, 'views/index'), { production: false, version });
	app.get('/index.html', index);
	app.get('/', index);
	app.get('/credits.html', (req, res) => res.sendFile(path.join(__dirname, 'views/credits.html')));
	app.get('/LICENSE', (req, res) => res.sendFile(path.join(__dirname, 'LICENSE')));
	app.use('/', express.static(path.join(__dirname, './server')));
}

const server = app.listen(port, () => {
	console.log(`Southern Star 4000 listening on http://localhost:${port}`);
});

const shutdown = () => server.close(() => console.log('Server closed'));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
