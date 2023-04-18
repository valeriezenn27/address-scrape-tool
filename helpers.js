const fs = require('fs');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

function getSettings(county) {
	try {
		return JSON.parse(fs.readFileSync(`./config/${county}.json`, 'utf8'));
	} catch (err) { // File does not exist
		return {};
	}
}

async function exportCsv(path, folder, fileName, data) {
	try {
		let outputPath = path;
		if (folder !== null) {
			outputPath += folder;
			// Check if the folder already exists
			if (!fs.existsSync(outputPath)) {
				// If the folder does not exist, create it
				fs.mkdirSync(outputPath);
				log(`Folder created successfully at ${outputPath}`);
			}
			outputPath += '/';
		}
		outputPath += fileName;

		const csvWriter = createCsvWriter({
			path: outputPath,
			header: [{
					"id": "name",
					"title": "Name"
				},
				{
					"id": "mailingAddress",
					"title": "Mailing Address"
				}
			]
		});

		await csvWriter.writeRecords(data)
			.then(() => {
				log(`Scraping completed. Data has been written to file path:`);
				log(`${outputPath}`, 'y');
				return true;
			})
			.catch((error) => {
				log(`Error writing data to CSV: ${error.message}`, 'r');
				return false;
			});
	} catch (error) {
		log(`Error writing data to CSV: ${error.message}`, 'r');
		return false;
	}
}

function log(text, color) {
	const RESET = '\x1b[0m';
	const RED = '\x1b[31m';
	const GREEN = '\x1b[32m';
	const YELLOW = '\x1b[33m';

	if (color === 'r') {
		console.log(RED, text, RESET);
	}
	if (color === 'g') {
		console.log(GREEN, text, RESET);
	}
	if (color === 'y') {
		console.log(YELLOW, text, RESET);
	} else {
		console.log(text);
	}

	return true;
}

function logCounter(data, counter) {
	log(`-----ITEM COUNTER: ${counter}-----`);
	log(data);

	return true;
}

function getDateText() {
	const currentDate = new Date();
	const dateText = `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}-${currentDate.getDate()}_${currentDate.getHours()}-${currentDate.getMinutes()}-${currentDate.getSeconds()}`;

	return dateText;
}

function format(str, ...args) {
	return str.replace(/{(\d+)}/g, (match, index) => {
		return args[index] !== undefined ? args[index] : match;
	});
}

module.exports = {
	getSettings,
	exportCsv,
	log,
	logCounter,
	getDateText,
	format
};