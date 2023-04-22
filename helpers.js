const fs = require('fs');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const xlsx = require('xlsx');
// const postal = require('node-postal');

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
					"id": "address",
					"title": "STREET ADDRESS"
				}, {
					"id": "city",
					"title": "CITY STATE"
				}, {
					"id": "zip",
					"title": "ZIP"
				},
				{
					"id": "name",
					"title": "OWNER NAME"
				},
				{
					"id": "mailingAddress",
					"title": "OWNER MAILING ADDRESS"
				}
			]
		});

		await csvWriter.writeRecords(data)
			.then(() => {
				log(`Scraping completed. Exported CSV file path:`);
				log(`${path}`, 'y');
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

function log(text, color = null) {
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
	}
	if (color === null) {
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

function getAddresses(path) {
	// read the excel file
	const workbook = xlsx.readFile(path);

	// get the last sheet
	const lastSheetName = workbook.SheetNames[workbook.SheetNames.length - 1];
	const sheet = workbook.Sheets[lastSheetName];

	// convert the sheet to an array of objects
	const data = xlsx.utils.sheet_to_json(sheet);

	return data;
}

function isMatchPattern(address, city) {
	const suffixPattern = /\b(?: dr| ct| rd| sr| cir| ln| pkwy| ave| st| pl| way)\b/gi;
	const addressParts = address.split(suffixPattern);
	const cleanedAddress = addressParts[0];
	const pattern = /^(\d+)\s+(N |S |E |W |NE |NW |SE |SW )?\s*(\w.*)$/i;
	const matchResult = cleanedAddress.match(pattern);
	if (matchResult) {
		const [_, streetNumber, direction, streetName] = cleanedAddress.match(pattern);
		const cityParts = city.split(',');
		const cityName = cityParts[0].trim();
		return {
			streetNumber,
			direction,
			streetName,
			cityName
		}
	} else {
		return false;
	}
}

// function getZip(address) {
// 	const parsed = postal.parseAddress(address);
// 	const zip = parsed[0].postalCode;
// 	return zip;
// }

module.exports = {
	getSettings,
	exportCsv,
	log,
	logCounter,
	getDateText,
	format,
	getAddresses,
	isMatchPattern
};