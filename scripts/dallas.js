const puppeteer = require('puppeteer');
const {
  getSettings,
  exportCsv,
  log,
  logCounter,
  getDateText,
  format,
  getAddressess
} = require('../helpers');

async function scrapeDallas(county) {
  const config = getSettings(county);
  const date = getDateText();
  const browser = await puppeteer.launch({
    headless: false
  });
  log(`Scraping started for URL : ${config.url}`, 'y');
  // TO DO: Get address from CSV
  const addressess = getAddressess(config.filePath);
  let allData = [];
  for (let i = 1; i < addressess.length; i++) {
    const address = addressess[i];
    const pattern = /^(\d+)\s+(N|S|E|W|NE|NW|SE|SW)?\s*(\w.*)$/i;
    const [_, streetNumber, direction, streetName] = address.match(pattern);
    const suffixPattern = /\b(?: dr| ct| rd| sr| cir| ln| pkwy| ave| st)\b/gi;
    const formattedStreetName = streetName.replace(suffixPattern, '');
    const page = await browser.newPage();
    await page.goto(config.url, {
      timeout: 60000
    });
    try {
      // Input the address number
      await page.type('#txtAddrNum', streetNumber.toString(), {
        delay: 100
      });
      // Input direction
      if (direction !== undefined) {
        await page.select('#listStDir', direction); // Input the year
      }
      // Input the address name
      await page.type('#txtStName', formattedStreetName);
      // Click on the search button
      await page.click('input#cmdSubmit');
      log(`Scraping for :`);
      log(`ADDRESS : ${address}`, 'y');
      await page.waitForNetworkIdle();
      // Extract data from table rows
      const rows = await page.$$('table#SearchResults1_dgResults tbody tr');
      for (let index = 2; index < rows.length - 1; index++) {
        const row = rows[index];
        await row.$eval('td a', a => a.click());
        await page.waitForNetworkIdle();
        await page.waitForSelector('#lblOwner');
        // Scrape data from record
        const info = await page.evaluate(() => {
          const spanElement = document.querySelector('#lblOwner');
          const name = spanElement.nextSibling.textContent;
          const element = document.querySelector('a[name="MultiOwner"]');
          const mailingAddress = `${element.previousElementSibling.previousElementSibling.previousSibling.textContent} ${element.previousElementSibling.previousSibling.textContent.replace(/\n/g, '').trim()}`;
          return {
            name,
            mailingAddress
          };
        });
        // Push the scraped data from the current tab to the main array
        allData.push(info);
        log(info, 'g');
        // Close new tab
        await page.close();
      }
    } catch (error) {
      console.error(error);
      await page.waitForTimeout(10000); // wait for 10 second before continuing
    }
  }

  if (!config.outputSeparateFiles && allData.length > 0) {
    // Save and export to CSV file
    const fileName = format(config.outputPath, county, date)
    await exportCsv(config.outputPath, allData);
  }
  // Close the browser
  await browser.close();
}

module.exports = scrapeDallas;