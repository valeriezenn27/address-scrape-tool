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
  getZip
} = require('../helpers');

async function scrapeTravis(county) {
  const config = getSettings(county);
  const date = getDateText();
  const url = `${config.url}${config.searhURl}`;
  const browser = await puppeteer.launch({
    headless: true
  });
  const page = await browser.newPage();
  log(`Scraping started for URL : ${url}`, 'y');
  const addresses = getAddresses(config.filePath);
  let allData = [];
  for (let i = 0; i < addresses.length; i++) {
    await page.waitForTimeout(1000); // wait for 1 second before continuing
    const address = addresses[i]['STREET ADDRESS'].replace('#', '');
    const city = addresses[i]['CITY STATE'];
    const zip = addresses[i]['ZIP'];
    log(`Scraping for :`);
    log(`ADDRESS : ${address}`, 'y');
    try {
      await page.goto(url, {
        timeout: 120000
      });
      const searchInput = 'input#searchInput';
      await page.waitForSelector(searchInput);
      await page.type(searchInput, address); // Input the address number
      await page.waitForTimeout(500); // wait for .5 second
      const searchButton = 'button.MuiButtonBase-root.MuiIconButton-root';
      // Click on the search button
      await page.click(searchButton);
      await page.waitForNetworkIdle();
      const containerSelector = '.ag-center-cols-container';
      await page.waitForSelector(containerSelector);
      const rowSelector = containerSelector + ' div[role="row"]';
      const resultsTable = await page.$(rowSelector);
      if (resultsTable) {
        await resultsTable.click();
        await page.waitForSelector('p.sc-cEvuZC.filVkB');
        const info = await page.$$eval('p.sc-cEvuZC.filVkB', (elements) => {
          const nameElement = elements[0];
          const mailingAddressElement = elements[2];
          const name = nameElement?.textContent || '';
          const mailingAddress = mailingAddressElement?.textContent || '';
          return {
            name,
            mailingAddress
          };
        });

        const mailingAddressZip = getZip(info.mailingAddress);
        info['mailingAddress'] = info.mailingAddress.replace(mailingAddressZip, '');
        info['mailingAddressZip'] = mailingAddressZip
        info['address'] = address;
        info['city'] = city;
        info['zip'] = zip;
        allData.push(info);
        log(info);
      }

    } catch (error) {
      log(error.message, 'r');
      await page.waitForTimeout(10000); // wait for 10 second before continuing
      continue;
    }
  }

  if (allData.length > 0) {
    // Save and export to CSV file
    log(`Total number of scraped data : ${allData.length}`, 'y')
    const fileName = format(config.outputPath, county, date)
    await exportCsv(fileName, allData);
  }
  // Close the browser
  await browser.close();
}

module.exports = scrapeTravis;