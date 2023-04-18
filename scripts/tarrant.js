const puppeteer = require('puppeteer');
const {
  getSettings,
  exportCsv,
  log,
  logCounter,
  getDateText
} = require('../helpers');

async function scrapeTarrant(county) {
  const config = getSettings(county);
  const folder = getDateText();
  const browser = await puppeteer.launch({
    headless: true
  });
  const page = await browser.newPage();
  log(`Scraping started for URL : ${config.url}`, 'y');

  let consolidatedData = [];
  for (let i = 0; i < config.addresses.length; i++) {
    await page.goto(config.url);
    const address = config.addresses[i];
    await page.type('input[name="search_string"]', address); // Input the address
    await page.click('button.btn-square[type="submit"]'); // Click on the search button
    log(`Scraping for :`);
    if (address !== null) {
      log(`ADDRESS : ${address}`, 'y');
    }
    // Wait for the results table to load
    await page.waitForSelector('table');

    let allData = [];
    let itemsCounter = 0;
    while (true) {
      const rows = await page.$$('tbody tr');
      if (row.length === 0) {
        break;
      }
      // Extract data from table rows
      for (let index = 0; index < rows.length; index++) {
        try {
          const row = rows[index];
          const href = await row.$eval('td a', a => a.href); // Get the href in row
          const tabPage = await browser.newPage();
          // Open in new tab
          await tabPage.goto(href);
          // Click ownership section
          const ownershipTabSelector = 'a[href="#tab4"]';
          await tabPage.waitForSelector(ownershipTabSelector);
          await tabPage.click(ownershipTabSelector);
          // Scrape data from ownership table rows
          const info = await tabPage.$$eval('table.table-primary tbody tr', (rows) => {
            const [firstRow] = rows;
            const cells = Array.from(firstRow.querySelectorAll('td'));
            const name = cells[0].innerText.trim();
            const mailingAddress = cells.slice(1).map(cell => cell.innerText.trim()).join(' ');
            return {
              name,
              mailingAddress
            };
          });
          // Push the scraped data from the current tab to the main array
          allData.push(info);
          consolidatedData.push(info);
          itemsCounter++;
          logCounter(info, itemsCounter);
          //Close the tab
          await tabPage.close();

          if (allData.length === config.maxItems) {
            break;
          }
        } catch (error) {
          console.error(error.message);
          await page.waitForTimeout(10000); // wait for 10 second before continuing
        }
      }

      if (allData.length === config.maxItems) {
        log(`Max item count (${config.maxItems}) reached.`, 'y');
        break;
      }
      // Click the next button to go to the next page
      const nextButton = await page.$('.m-0 button.btn-link');
      if (nextButton) {
        await nextButton.click();
        await page.waitForNavigation();
      }
    }

    log(`Item count (${itemsCounter}).`, 'y');
    if (config.outputSeparateFiles && allData.length > 0) {
      // Save and export to CSV file
      const fileName = `${address}.csv`
      await exportCsv(config.outputPath, folder, fileName, allData);
    }
  }

  if (!config.outputSeparateFiles && consolidatedData.length > 0) {
    // Save and export to CSV file
    const fileName = `${folder}.csv`
    await exportCsv(config.outputPath, null, fileName, consolidatedData);
  }

  // Close the browser
  await browser.close();
}

module.exports = scrapeTarrant;