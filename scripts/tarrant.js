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
    headless: false,
    timeout: 60000
  });
  const page = await browser.newPage({
    timeout: 60000
  });

  let consolidatedData = [];
  for (let i = 0; i < config.addresses.length; i++) {
    let allData = [];
    await page.goto(config.url);
    const address = config.addresses[i];
    log(`Scraping for :`);
    if (address !== null) {
      log(`STREET NAME : ${address}`, 'y');
    }
    await page.type('input[name="search_string"]', address); // Input the address
    await page.click('button.btn-square[type="submit"]'); // Click on the search button
    // Wait for the results table to load
    await page.waitForSelector('table');

    let itemsCounter = 0;
    let links = [];
    while (true) {
      const rows = await page.$$('tbody tr');
      if (rows.length === 0) {
        log(`No data found.`, 'y');
      }
      // Extract data from table rows
      for (let index = 0; index < rows.length; index++) {
        if (links.length === config.maxItems) {
          break;
        }
        const row = rows[index];
        const href = await row.$eval('td a', a => a.href); // Get the href in row
        links.push(href); // Hold all links in a variable
      }

      if (links.length === config.maxItems) {
        break;
      }

      // Click the next button to go to the next page
      const nextButton = await page.$('.m-0 button.btn-link');
      if (nextButton) {
        await nextButton.click();
        await page.waitForNavigation({
          timeout: 60000
        });
      }
    }

    const numBatches = Math.ceil(links.length / 20);
    for (let i = 0; i < numBatches; i++) {
      const startIdx = i * 20;
      const endIdx = Math.min(links.length, (i + 1) * 20);
      const batchLinks = links.slice(startIdx, endIdx);

      try {
        const promises = batchLinks.map(async (link) => {
          const tabPage = await browser.newPage();
          await tabPage.goto(link);

          const ownershipTabSelector = 'a[href="#tab4"]';
          await tabPage.waitForSelector(ownershipTabSelector);
          await tabPage.click(ownershipTabSelector);

          // Scrape data from ownership table rows
          const info = await tabPage.$$eval('table.table-primary tbody tr', (rows) => {
            const [firstRow] = rows; // Destructuring to get the first row
            const cells = Array.from(firstRow.querySelectorAll('td'));
            const name = cells[0].innerText.trim();
            const mailingAddress = cells.slice(1).map(cell => cell.innerText.trim()).join(' ');
            return {
              name,
              mailingAddress
            };
          });

          // Push the scraped data from the current tab to the main array
          itemsCounter++;
          allData.push(info);
          consolidatedData.push(info);
          logCounter(info, itemsCounter);

          await tabPage.close();
        });
      } catch (error) {
        log(error.message, 'r');
      };

      await Promise.all(promises);
    }

    if (itemsCounter === config.maxItems) {
      log(`Max item count (${config.maxItems}) reached.`, 'y');
    } else {
      log(`No more data found.`, 'y');
      log(`Item count (${itemsCounter}).`, 'y');
    }

    if (config.outputSeparateFiles) {
      // Save and export to CSV file
      const fileName = `${address}.csv`
      await exportCsv(config.outputPath, folder, fileName, allData);
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

module.exports = scrapeTarrant;