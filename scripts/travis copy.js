const puppeteer = require('puppeteer');
const {
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
  processAddress
} = require('../helpers');

async function scrapeTravis(county) {
  const config = getSettings(county);
  const date = getDateText();
  const url = `${config.url}${config.searhURl}`;
  let chromiumPath = '';
  if (process.platform === 'win32') {
    chromiumPath = 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
  } else if (process.platform === 'linux') {
    chromiumPath = '/usr/bin/google-chrome';
  } else if (process.platform === 'darwin') {
    chromiumPath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  }
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: chromiumPath,
  });
  const page = await browser.newPage();
  await page.goto(url, {
    timeout: 120000
  });
  log(`Scraping started for URL : ${url}`, 'y');
  const addresses = getAddresses(config.filePath);
  let allData = [];
  for (let i = 0; i < addresses.length; i++) {
    // await page.waitForTimeout(500);
    const address = addresses[i]['STREET ADDRESS'].replace('#', '');
    const city = addresses[i]['CITY STATE'];
    const zip = addresses[i]['ZIP'];
    log(`Scraping for :`);
    log(`ADDRESS : ${address}`, 'y');
    try {
      const searchInputSelector = 'input#searchInput';
      await page.waitForSelector(searchInputSelector);
      const searchInput = await page.$(searchInputSelector); // Get the element reference
      await searchInput.click({
        clickCount: 3
      }); // Select the existing text in the input
      await searchInput.press('Backspace'); // Delete the existing text
      await searchInput.type(address); // Type the new address
      // await page.waitForTimeout(500); // wait for .5 second
      const searchButton = 'button.MuiButtonBase-root.MuiIconButton-root';
      // Click on the search button
      await page.click(searchButton);
      await page.waitForNetworkIdle();
      const containerSelector = '.ag-center-cols-container';
      const rowSelector = containerSelector + ' div[role="row"]';
      const rows = await page.$$(rowSelector);
      let pidText = '';
      if (rows.length > 1) {
        for (const row of rows) {
          // Find all cells in the row
          const cells = await row.$$('.ag-cell');
          // Initialize variables for matching string and matching cell
          let matchingString = '';
          let matchingCell = null;
          const searchString = address.toUpperCase();
          // Iterate over each cell in the row
          for (const cell of cells) {
            // Get the text content of the cell
            const text = await cell.evaluate(node => node.textContent.trim());
            // Check if the text content matches the search string
            if (text.includes(searchString) && text.length > matchingString.length) {
              // Update the matching string and matching cell
              matchingString = text;
              matchingCell = cell;
              break;
            }
          }
          // If a matching cell was found, get the text content of the 'pid' column for that row
          if (matchingCell) {
            pidText = await row.$eval('div[col-id="pid"]', a => a.textContent);
          }
        }
      } else {
        pidText = await rows[0].$eval('div[col-id="pid"]', a => a.textContent);
      }

      if (pidText !== '') {
        const href = format(`${config.url}${config.detailsUrl}`, pidText);
        const tabPage = await browser.newPage();
        // Open in new tab
        await tabPage.goto(href, {
          timeout: 60000
        });
        await tabPage.waitForNetworkIdle();
        await tabPage.waitForFunction(() => {
          const selector = 'p.sc-cEvuZC.filVkB';
          const elements = document.querySelectorAll(selector);
          if (elements.length === 0) {
            return false;
          }
          const element = elements[0];
          return element.textContent.trim() !== '';
        }, {
          timeout: 60000
        });
        // Scrape data from record
        const info = await tabPage.evaluate(() => {
          const items = document.querySelectorAll('p.sc-cEvuZC.filVkB');
          const name = items[0].textContent.trim();
          const mailingAddress = items[2].textContent.trim();
          if (name === '' && mailingAddress === '') {
            return null;
          }
          return {
            name,
            mailingAddress
          };
        });

        if (info !== null) {
          const name = toProperCase(info.name);
          const result = processAddress(info.mailingAddress);
          const mailingAddress = result.address;
          const mailingCityState = result.cityState;
          const mailingZip = result.zip;
          const data = {
            address,
            city,
            zip,
            name,
            mailingAddress,
            mailingCityState,
            mailingZip
          };
          allData.push(data);
          log(data);
        }

        await tabPage.close();
      } else {
        log('Result not found.', 'r');
      }
    } catch (error) {
      console.error(error);
      // log(error.message, 'r');
      await page.waitForTimeout(10000); // wait for 10 second before continuing
      continue;
    }
  }

  if (allData.length > 0) {
    // Save and export to CSV file
    log(`Total number from input data : ${addresses.length}`, 'y');
    log(`Total number of scraped data : ${allData.length}`, 'y')
    const fileName = format(config.outputPath, county, date)
    await exportCsv(fileName, allData);
  }
  // Close the browser
  await browser.close();
}

module.exports = scrapeTravis;