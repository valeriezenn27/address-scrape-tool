const fs = require('fs');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const xlsx = require('xlsx');
const usStateCodes = require('us-state-codes');
const parseAddress = require('parse-address');

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
				},
				{
					"id": "mailingCityState",
					"title": "OWNER MAILING CITY STATE"
				},
				{
					"id": "mailingZip",
					"title": "OWNER MAILING ZIP"
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

function getZip(address) {
	const removeNumbersRegex = /^[0-9]+/;
	const stringWithoutNumbers = address.replace(removeNumbersRegex, "");
	const regex = /(\d{5})([-\s]*(\d{4}))?/;
	const match = regex.exec(stringWithoutNumbers);
	let zip = match[1] + (match[3] ? "-" + match[3] : "");

	// Check if the zip code already has the correct format
	if (zip.length === 10 && zip.charAt(5) === "-") {
		return zip;
	} else {
		return match[0];
	}
}

function toProperCase(str) {
	const words = str.split(/\s+/);
	const properCase = words.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
	return properCase;
}

function toTitleCase(str) {
	return str.replace(/\w\S*/g, function (txt) {
		return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
	});
}

function processAddress(input) {
	const parsed = parseAddress.parseLocation(input);

	if (parsed) {
		const address = `${parsed.sec_unit_type ? toTitleCase(parsed.sec_unit_type) : ''}${parsed.sec_unit_num ? ' ' + parsed.sec_unit_num : ''}${parsed.number && parsed.street && parsed.type ? ', ' + parsed.number + ' ' + toTitleCase(parsed.street) + ' ' + toTitleCase(parsed.type) : ''}`;
		const city = toTitleCase(parsed.city);
		const state = parsed.state;
		const zip = parsed.zip + (parsed.plus4 ? `-${parsed.plus4}` : '');
		const cityState = `${city}, ${state}`;

		return {
			address,
			cityState,
			zip,
		};
	} else {
		throw new Error('Invalid address format');
	}
}

function getChromiumPath() {
	switch (process.platform) {
		case 'win32':
			return 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
		case 'linux':
			return '/usr/bin/google-chrome';
		case 'darwin':
			return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
		default:
			throw new Error(`Unsupported platform: ${process.platform}`);
	}
}

module.exports = {
	getSettings,
	exportCsv,
	log,
	logCounter,
	getDateText,
	format,
	getAddresses,
	isMatchPattern,
	getZip,
	toProperCase,
	processAddress,
	getChromiumPath
};