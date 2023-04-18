const {
	log
} = require('./helpers');
const scrapeTarrant = require('./scripts/tarrant');
const scrapeHarris = require('./scripts/harris');
const scrapeDallas = require('./scripts/dallas');
const scrapeTravis = require('./scripts/travis');

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

	if (county.indexOf('dallas') > -1) {
		await scrapeDallas(county);
	}

	if (county.indexOf('travis') > -1) {
		await scrapeTravis(county);
	}
}

startScraping();