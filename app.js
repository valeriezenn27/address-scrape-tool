const {
	log
} = require('./helpers');
const scrapeTarrant = require('./scripts/tarrant');
const scrapeHarris = require('./scripts/harris');

const county = process.argv[2];

async function startScraping() {
	console.clear();
	log(`Processing ${county} county...`);

	if (county.indexOf('tarrant') > -1) {
		await scrapeTarrant(county);
	}

	if (county.indexOf('harris') > -1) {
		await scrapeHarris(county);
	}
}

startScraping();