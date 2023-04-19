const fs = require('fs');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const xlsx = require('xlsx');

function getSettings(county) {
	try {
		return JSON.parse(fs.readFileSync(`./config/${county}.json`, 'utf8'));
	} catch (err) { // File does not exist
		return {};
	}
}

async function exportCsv(path, data) {
	try {
		const csvWriter = createCsvWriter({
			path: path,
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
				log(`Scraping completed. Exported CSV file path:`);
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

function getAddressess(path) {
	// Load the workbook
	const workbook = xlsx.readFile(path);
	// Get the last sheet name
	const lastSheetName = workbook.SheetNames[workbook.SheetNames.length - 1];
	// Get the last sheet
	const lastSheet = workbook.Sheets[lastSheetName];
	// Define the column you want to retrieve values from
	const column = 'B';
	// Get all cell addresses in the column
	const columnAddresses = Object.keys(lastSheet)
		.filter((cellAddress) => cellAddress.startsWith(column))
		.sort();
	// Extract the values from the column
	const columnValues = columnAddresses.map((cellAddress) => lastSheet[cellAddress].v);
	return columnValues;
}

module.exports = {
	getSettings,
	exportCsv,
	log,
	logCounter,
	getDateText,
	format,
	getAddressess
};