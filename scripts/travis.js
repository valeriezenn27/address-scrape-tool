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
  log(`Scraping started for URL : ${url}`, 'y');
  const browser = await puppeteer.launch({
    headless: false
  });
  const page = await browser.newPage();

  let consolidatedData = [];
  for (let i = 0; i < config.addresses.length; i++) {
    let allData = [];
    await page.goto(url);
    const address = config.addresses[i];
    log(`Scraping for :`);
    if (address.year !== null) {
      log(`YEAR : ${address.year}`, 'y');
    }
    if (address.streetName !== null) {
      log(`STREET NAME : ${address.streetName}`, 'y');
    }

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

    await page.waitForTimeout(1000); // wait for 1 second
    const searchButton = 'button.MuiButtonBase-root.MuiIconButton-root';
    await page.click(searchButton); // Click on the search button
    await page.waitForNetworkIdle();
    await page.waitForSelector('.ag-center-cols-container');

    // Wait for the results table to load
    const rowSelector = '.ag-center-cols-container div[role="row"]';
    const resultsTable = await page.$(rowSelector);
    if (!resultsTable) {
      log(`No data found.`, 'y');
    } else {
      let itemsCounter = 0;
      let links = [];
      while (true) {
        await page.waitForSelector(rowSelector);
        const rows = await page.$$(rowSelector);
        // Extract data from table rows
        for (let index = 0; index < rows.length; index++) {
          if (links.length === config.maxItems) {
            break;
          }
          const row = rows[index];
          const id = await row.$eval('div[col-id="pid"]', a => a.textContent); // Get the href in row
          const detailsUrl = format(`${config.url}${config.detailsUrl}`, id, address.year);
          links.push(detailsUrl); // Hold all links in a variable
        }

        if (links.length === config.maxItems) {
          break;
        }

        // Click the next button to go to the next page
        // Find the pagination component
        const pagination = await page.$('.MuiFlatPagination-root');
        // Check if the last button is disabled
        const lastButton = await pagination.$('button');
        const isDisabled = await lastButton.evaluate((el) => el.disabled);
        if (!isDisabled) {
          // Click the last button
          await lastButton.click();
          await page.waitForNavigation({
            timeout: 60000
          });
        } else {
          break;
        }
      }

      const numBatches = Math.ceil(links.length / 20);
      for (let i = 0; i < numBatches; i++) {
        const startIdx = i * 20;
        const endIdx = Math.min(links.length, (i + 1) * 20);
        const batchLinks = links.slice(startIdx, endIdx);

        const promises = batchLinks.map(async (link) => {
          const tabPage = await browser.newPage();
          await tabPage.goto(link);
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
            itemsCounter++;
            allData.push(info);
            consolidatedData.push(info);
            logCounter(info, itemsCounter);
          }

          await tabPage.close();
        });

        await Promise.all(promises);
      }


      if (itemsCounter == config.maxItems) {
        log(`Max item count (${config.maxItems}) reached.`, 'y');
      } else {
        log(`No more data found.`, 'y');
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