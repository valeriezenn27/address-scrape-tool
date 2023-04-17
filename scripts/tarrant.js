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
  log(`Scraping started for URL : ${config.url}`, 'y');
  const browser = await puppeteer.launch({
    headless: true
  });
  const page = await browser.newPage();

  let consolidatedData = [];
  for (let i = 0; i < config.addresses.length; i++) {
    let allData = [];
    await page.goto(config.url);
    const address = config.addresses[i];
    log(`Scraping for :`);
    if (address !== null) {
      log(`STREET NAME : ${address}`, 'y');
    }
    await page.type('input[name="search_string"]', address); // Input the addtress
    await page.click('button.btn-square[type="submit"]'); // Click on the search button
    // Wait for the results table to load
    await page.waitForSelector('table');

    while (true) {
      const rows = await page.$$('tbody tr');
      if (rows.length === 0) {
        log(`No data found.`, 'y');
        break;
      }

      let itemsCounter = 0;
      // Extract data from table rows
      for (let index = 0; index < rows.length; index++) {
        if (itemsCounter === config.maxItems) {
          break;
        }
        const row = rows[index];
        const href = await row.$eval('td a', a => a.href); // Get the href in row
        const detailsPage = await page.browser().newPage(); // Open a new page
        await detailsPage.goto(href); // Go to the new page

        // Click Ownership tab
        const ownershipTabSelector = 'a[href="#tab4"]';
        await detailsPage.waitForSelector(ownershipTabSelector);
        await detailsPage.click(ownershipTabSelector);

        // Scrape data from ownership table rows
        let info = await detailsPage.$$eval('table.table-primary tbody tr', (rows) => {
          const [firstRow] = rows; // Destructuring to get the first row
          const cells = Array.from(firstRow.querySelectorAll('td'));
          const name = cells[0].innerText.trim();
          const mailingAddress = cells.slice(1).map(cell => cell.innerText.trim()).join(' ');
          return {
            name,
            mailingAddress
          };
        });

        itemsCounter++;
        allData.push(info);
        consolidatedData.push(info);
        logCounter(info, itemsCounter);

        // Close details page tab
        await detailsPage.close();
      }

      if (itemsCounter === config.maxItems) {
        log(`Max item count (${config.maxItems}) reached.`, 'y');
        break;
      }

      // Click the next button to go to the next page
      const nextButton = await page.$('.m-0 button.btn-link');
      if (nextButton) {
        await nextButton.click();
      }
      await page.waitForNavigation();
    }

    if (config.outputSeparateFiles) {
      // Save and export to CSV file
      const fileName = `${address}.csv`
      await exportCsv(config.outputPath, folder, fileName, allData);
    }
  }

  if (!config.outputSeparateFiles) {
    // Save and export to CSV file
    const fileName = `${getDateText()}.csv`
    await exportCsv(config.outputPath, null, fileName, consolidatedData);
  }

  // Close the browser
  await browser.close();
}

module.exports = scrapeTarrant;