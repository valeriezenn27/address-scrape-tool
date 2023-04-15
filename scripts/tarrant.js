const puppeteer = require('puppeteer');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const config = require('../config/tarrant.json');

const currentDate = new Date();
const dateText = `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}-${currentDate.getDate()}_${currentDate.getHours()}-${currentDate.getMinutes()}-${currentDate.getSeconds()}`;
const path = `${config.outputPath}${dateText}.csv`;

// Create CSV writer to write the scraped data
const csvWriter = createCsvWriter({
  path: path,
  header: config.csvHeader
});

// Function to start the scraping process
const startScraping = async () => {
  console.clear();
  console.log(`Scraping started for URL : ${config.url}`);
  const browser = await puppeteer.launch(config.puppeteerOptions);
  const page = await browser.newPage();
  await page.goto(config.url);

  let allData = [];

  // Input search queries
  const searchInputSelector = 'input[name="search_string"]'
  for (let i = 0; i < config.addresses.length; i++) {
    console.log(`Scraping for address : ${config.addresses[i]}`);
    await page.type(searchInputSelector, config.addresses[i]);
    await page.click('button.btn-square[type="submit"]');
    await page.waitForSelector('table');

    while (true) {
      // Extract data from table rows
      const rows = await page.$$('tbody tr');

      if (rows.length === 0) {
        console.log('No more data found.');
        break;
      }

      let itemsCounter = 1;
      for (let j = 0; j < rows.length; j++) {
        if (itemsCounter >= config.maxItems - 1) {
          continue;
        }
        console.log(`-----ITEM COUNTER: ${itemsCounter}-----`);
        const row = rows[j];
        const href = await row.$eval('td a', a => a.href); // Get the href in column
        const detailsPage = await page.browser().newPage(); // Open a new page
        await detailsPage.goto(href); // Go to the new page

        // Click Ownership tab
        const ownershipTabSelector = 'a[href="#tab4"]';
        await detailsPage.waitForSelector(ownershipTabSelector);
        await detailsPage.click(ownershipTabSelector);

        // Scrape data from ownership table rows
        const info = await detailsPage.$$eval('table.table-primary tbody tr', (rows) => {
          return rows.map(row => {
            const cells = Array.from(row.querySelectorAll('td'));
            const name = cells[0].innerText.trim();
            const mailingAddress = cells.slice(1).map(cell => cell.innerText.trim()).join(' ');
            return {
              name,
              mailingAddress
            };
          });
        });

        // Store info in the data object
        info.forEach((item, index) => {
          allData.push(item);
          console.log(item);
        });

        itemsCounter++;
        // Close details page tab
        await detailsPage.close();
      }

      if (itemsCounter >= config.maxItems - 1) {
        console.log(`Max item count reached for address : ${config.addresses[i]}`);
        break;
      }

      // Click the next button to go to the next page
      const nextButton = await page.$('.m-0 button.btn-link');
      if (!nextButton) {
        console.log('No next button found.');
        break;
      }

      await nextButton.click();
      await page.waitForNavigation();
    }

    // Clear the search inputs for the next query
    await page.$eval(searchInputSelector, input => input.value = '');
  }

  // Write the scraped data to a CSV file
  await csvWriter.writeRecords(allData)
    .then(() => {
      console.log(`Scraping complete. Data has been written to ${path} file.`);
    })
    .catch(err => {
      console.error('Error writing data to CSV:', err);
    });

  await browser.close();
};

startScraping();