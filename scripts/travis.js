const puppeteer = require('puppeteer');
const {
  getSettings,
  exportCsv,
  log,
  logCounter,
  getDateText,
  format
} = require('../helpers');

async function scrapeTravis(county) {
  const config = getSettings(county);
  const folder = getDateText();
  const url = `${config.url}${config.searhURl}`;
  const browser = await puppeteer.launch({
    headless: true
  });
  const page = await browser.newPage();
  log(`Scraping started for URL : ${url}`, 'y');

  let consolidatedData = [];
  for (let i = 0; i < config.addresses.length; i++) {

    await page.goto(url);
    const address = config.addresses[i];
    const searchInput = 'input#searchInput';
    await page.waitForSelector(searchInput);
    await page.type(searchInput, address.streetName); // Input the address number
    if (address.year !== null) {
      const year = address.year.toString();
      // Find the dropdown button and click it
      const dropdownButton = await page.$('.sc-RefOD.iammZP > div:nth-child(3) .MuiSelect-root.MuiSelect-select.MuiSelect-selectMenu.MuiInputBase-input.MuiInput-input');
      await page.waitForTimeout(1000); // wait for 1 second
      await dropdownButton.click();
      // Find the dropdown items and click the desired item
      const dropdownItems = await page.$$('.MuiButtonBase-root.MuiListItem-root.MuiMenuItem-root.MuiMenuItem-gutters.MuiListItem-gutters.MuiListItem-button');
      for (const item of dropdownItems) {
        const text = await item.evaluate((el) => el.textContent.trim());
        if (text === year) {
          await page.waitForTimeout(1000); // wait for 1 second
          await item.click();
        }
      }
    }
    await page.waitForTimeout(500); // wait for .5 second
    const searchButton = 'button.MuiButtonBase-root.MuiIconButton-root';
    // Click on the search button
    await page.click(searchButton);
    log(`Scraping for :`);
    if (address.year !== null) {
      log(`YEAR : ${address.year}`, 'y');
    }
    if (address.streetName !== null) {
      log(`ADDRESS : ${address.streetName}`, 'y');
    }
    await page.waitForNetworkIdle();
    await page.waitForSelector('.ag-center-cols-container');

    // Wait for the results table to load
    const rowSelector = '.ag-center-cols-container div[role="row"]';
    const resultsTable = await page.$(rowSelector);
    if (resultsTable) {
      let allData = [];
      let itemsCounter = 0;
      const tabPromises = [];
      let stopLoop = false; // Initialize stopLoop flag
      while (true) {
        await page.waitForSelector(rowSelector);
        // Extract data from table rows
        const rows = await page.$$(rowSelector);
        for (let index = 0; index < rows.length && !stopLoop; index++) {
          if (allData.length === config.maxItems) {
            break;
          }
          const row = rows[index];
          const id = await row.$eval('div[col-id="pid"]', a => a.textContent); // Get the href in row
          const detailsUrl = format(`${config.url}${config.detailsUrl}`, id, address.year);
          const tabPagePromise = (async () => {
            try {
              const tabPage = await browser.newPage();
              // Open in new tab
              await tabPage.goto(detailsUrl);
              await tabPage.waitForNetworkIdle();
              // Scrape data from record
              const info = await tabPage.evaluate(() => {
                const items = document.querySelectorAll('p.sc-cEvuZC.filVkB');
                const name = items[0].textContent;
                const mailingAddress = items[2].textContent;
                if (name === '' && mailingAddress === '') {
                  return null;
                }
                return {
                  name,
                  mailingAddress
                };
              });
              // Push the scraped data from the current tab to the main array
              if (info !== null) {
                allData.push(info);
                consolidatedData.push(info);
                itemsCounter++;
                logCounter(info, itemsCounter);
              }
              // Close new tab
              await tabPage.close();
            } catch (error) {
              console.error(error.message);
              await page.waitForTimeout(10000); // wait for 10 second before continuing
            }
          })();
          tabPromises.push(tabPagePromise);
          if (tabPromises.length === config.maxItems) {
            stopLoop = true; // Set stopLoop flag to true
          }
          if (tabPromises.length >= rows.length) {
            await Promise.race(tabPromises); // Wait for the first tab to complete
            tabPromises.shift(); // Remove the completed promise from the array
          }
        }
        await Promise.all(tabPromises); // Wait for any remaining tabs to complete

        if (allData.length === config.maxItems) {
          log(`Max item count (${config.maxItems}) reached.`, 'y');
          break;
        }

        // Click the next button to go to the next page
        const pagination = await page.$('.MuiFlatPagination-root');
        // Check if the last button is disabled
        const lastButton = await pagination.$('button:last-child');
        const isDisabled = await lastButton.evaluate((el) => el.disabled);
        if (!isDisabled) {
          await lastButton.click();
          await page.waitForNetworkIdle();
        } else {
          break;
        }
      }

      if (config.outputSeparateFiles && allData.length > 0) {
        // Save and export to CSV file
        let fileName = '';
        if (address.year !== null) {
          fileName += `${address.year}_`;
        }
        if (address.streetName !== null) {
          fileName += `${address.streetName}`;
        }
        fileName += '.csv';
        await exportCsv(config.outputPath, folder, fileName, allData);
      }
    }
  }

  if (!config.outputSeparateFiles) {
    // Save and export to CSV file
    const fileName = `${folder}.csv`
    await exportCsv(config.outputPath, null, fileName, consolidatedData);
  }
  // Close the browser
  await browser.close();
}

module.exports = scrapeTravis;