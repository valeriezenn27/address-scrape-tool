const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs');
const csvWriter = require('fast-csv');

// Get county name from command line argument
const county = process.argv[2];

if (!county) {
  console.error('Error: county name not provided. Please provide the county name as a command-line argument.');
  process.exit(1);
}

// Load county configuration from config.json
const config = require(`./config/${county}.json`);

const selectors = config.selectors;

(async () => {
  const browser = await puppeteer.launch({
    headless: false
  });
  const page = await browser.newPage();
  let results = [];

  try {
    await page.goto(config.url + config.search);

    for (let i = 0; i < config.maxResults; i += 10) {
      // Type the street address and click search
      await page.type(selectors.searchInputSelector, config.searchParam);
      await page.click(selectors.searchButtonSelector);
      await page.waitForNavigation();

      // Parse table content
      const content = await page.content();
      const $ = cheerio.load(content);

      // Wait for 2 seconds
      await new Promise(resolve => setTimeout(resolve, 2000));

      const tableRows = $(selectors.tableRowSelector);
      for (let j = 1; j < tableRows.length; j++) {
        // Click the link and open in a new tab
        const link = $(tableRows[j]).find('a').attr('href');
        const fullLink = config.url + link;
        const detailPage = await browser.newPage();
        await detailPage.goto(fullLink);

        // Click on Ownership tab
        await detailPage.waitForSelector(selectors.ownershipButtonSelector);
        await detailPage.click(selectors.ownershipButtonSelector);

        await detailPage.waitForSelector('table.table-primary');

        // Scrape for the name and mailing address
        const name = await detailPage.$eval('table.table-primary tbody tr td', el => el.textContent);
        const mailingAddress = await detailPage.$$eval('table.table-primary tbody tr td', tds => {
          // Combine the other tds for mailing address
          let address = '';
          for (let i = 1; i < tds.length; i++) {
            address += tds[i].textContent + ' ';
          }
          return address.trim();
        });

        // Save the result
        results.push({
          name,
          mailingAddress
        });

        // Close the detail tab
        await detailPage.close();

        // Stop if max result have been scraped
        if (results.length >= config.maxResults) {
          break;
        }
      }

      // Click the next button
      if (results.length < config.maxResults) {
        await page.click(selectors.nextButtonSelector);
        await page.waitForNavigation();
      } else {
        break;
      }
    }
  } catch (error) {
    console.error('Error while scraping:', error);
  } finally {
    // Save results to a CSV file
    const csvStream = csvWriter.format({
      headers: true
    });
    const fileName = `./output/${county}${config.outputFile}`;
    csvStream.pipe(fs.createWriteStream(fileName));
    results.forEach(result => csvStream.write(result));
    csvStream.end();

    // Close the browser
    await browser.close();
    console.log(`Scraping completed successfully. Results are saved in "${fileName}".`);
  }
})();