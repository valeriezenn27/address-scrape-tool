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
  processAddress,
  getChromiumPath
} = require('../helpers');

async function scrapeTravis(county) {
  const config = getSettings(county);
  const date = getDateText();
  const url = `${config.url}${config.searhURl}`;
  const chromiumPath = getChromiumPath();
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: chromiumPath
  });
  const page = await browser.newPage();
  await page.goto(url, {
    timeout: 120000
  });
  log(`Scraping started for URL : ${url}`, 'y');
  const addresses = getAddresses(config.filePath);
  let allData = [];
  for (let i = 0; i < addresses.length; i++) {
    const address = addresses[i]['STREET ADDRESS'].replace('#', '');
    const city = addresses[i]['CITY STATE'];
    const zip = addresses[i]['ZIP'];
    log(`Scraping for :`);
    log(`ADDRESS : ${address}`, 'y');
    let success = false;
    let attempts = 0;
    const maxAttempts = 3; // Set the maximum number of attempts here
    while (!success && attempts < maxAttempts) {
      try {
        attempts++;
        const searchInputSelector = 'input#searchInput';
        await page.waitForSelector(searchInputSelector);
        const searchInput = await page.$(searchInputSelector); // Get the element reference
        await searchInput.click({
          clickCount: 3
        });
        await searchInput.press('Backspace'); // Delete the existing text
        await searchInput.type(address); // Type the new address
        // Find the dropdown button and click it
        const dropdownButton = await page.$('.sc-RefOD.iammZP > div:nth-child(3) .MuiSelect-root.MuiSelect-select.MuiSelect-selectMenu.MuiInputBase-input.MuiInput-input');
        await page.waitForTimeout(500); // wait for 1 second
        await dropdownButton.click();
        // Find the dropdown items and click the desired item
        const dropdownItems = await page.$$('.MuiButtonBase-root.MuiListItem-root.MuiMenuItem-root.MuiMenuItem-gutters.MuiListItem-gutters.MuiListItem-button');
        for (const item of dropdownItems) {
          const text = await item.evaluate((el) => el.textContent.trim());
          if (text === config.year) {
            await page.waitForTimeout(100); // wait for 1 second
            await item.click();
          }
        }
        await page.waitForTimeout(500);
        const searchButton = 'button.MuiButtonBase-root.MuiIconButton-root';
        // Click on the search button
        await page.click(searchButton);
        await page.waitForFunction(() => {
          const elements = document.querySelectorAll('[style]');
          for (const element of elements) {
            if (element.getAttribute('style').includes('MuiCircularProgress')) {
              return false;
            }
          }
          return true;
        });
        await page.waitForNetworkIdle();
        await page.waitForTimeout(100);
        await page.waitForSelector('div[col-id="pid"]');

        const containerSelector = '.ag-center-cols-container';
        const rowSelector = containerSelector + ' div[role="row"]';
        const rows = await page.$$(rowSelector);
        if (rows.length === 1) {
          await rows[0].click();
          await page.waitForNetworkIdle();
          const selector = '.sc-iybRtq.fTmVpm p.sc-cEvuZC.filVkB';
          await page.waitForSelector(selector);
          // Scrape data from record
          const info = await page.evaluate((selector) => {
            const items = document.querySelectorAll(selector);
            const name = items[0].textContent.trim();
            const mailingAddress = items[2].textContent.trim();
            if (name === '' && mailingAddress === '') {
              return null;
            }
            return {
              name,
              mailingAddress
            };
          }, selector);

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

            await page.waitForTimeout(200);
            const element = await page.$('.MuiBreadcrumbs-li');
            if (element) {
              await element.click();
            } else {
              console.log('Element with class ".MuiBreadcrumbs-li" not found.');
            }
          }
        } else {
          log('Multiple/no results found.', 'r');
        }
        success = true;
      } catch (error) {
        log(error.message);
        if (attempts < maxAttempts) {
          const RETRY_TIMEOUT = 5000; // retry timeout in 5s
          log(`retrying in ${RETRY_TIMEOUT / 1000} seconds...`);
          await page.waitForTimeout(RETRY_TIMEOUT);
          await page.goto(url, {
            timeout: 120000
          });
        } else {
          log(error.message, 'r');
        }
      }
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