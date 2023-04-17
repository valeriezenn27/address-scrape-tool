const puppeteer = require('puppeteer');
const {
  getSettings,
  exportCsv,
  log,
  logCounter,
  getDateText
} = require('../helpers');

async function scrapeHarris(county) {
  const config = getSettings(county);
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
    await page.waitForSelector('iframe'); // Wait for the iframe to load
    // Switch to the first iframe containing the search form
    const iframes = await page.$$('iframe');
    const searchFormIframe = iframes[0]; // Update the index based on the actual position of the iframe
    const searchFormIframeContent = await searchFormIframe.contentFrame();

    log(`Scraping for :`);
    if (address.taxYear !== null) {
      log(`TAX YEAR : ${address.taxYear}`, 'y');
    }
    if (address.streetNumber !== null) {
      log(`STREET NUMBER : ${address.streetNumber}`, 'y');
    }
    if (address.streetName !== null) {
      log(`STREET NAME : ${address.streetName}`, 'y');
    }
    await searchFormIframeContent.$eval('input#s_addr', el => el.click()); // Click on Search by Address button
    await searchFormIframeContent.waitForSelector('form[name="Real_addr"]');
    await searchFormIframeContent.select('form[name="Real_addr"] select[name="TaxYear"]', address.taxYear); // Input the year
    if (address.streetNumber !== null) {
      await searchFormIframeContent.type('form[name="Real_addr"] input[name="stnum"]', address.streetNumber.toString(), {
        delay: 100
      });
    }
    if (address.streetName !== null) {
      await searchFormIframeContent.type('form[name="Real_addr"] input[name="stname"]', address.streetName); // Input the address
    }
    await searchFormIframeContent.$eval('form[name="Real_addr"] input[type="submit"]', el => el.click()); // Click on the search button

    // Wait for the results iframe to load
    await searchFormIframeContent.waitForSelector('iframe#quickframe');
    const quickframeHandle = await searchFormIframeContent.$('iframe[name="quickframe"]');
    const quickframe = await quickframeHandle.contentFrame();

    //Click view all button if available
    const viewAllButtonSelector = 'form#form1 input#submit2';
    const viewAllButton = await page.$(viewAllButtonSelector);
    if (viewAllButton) {
      await quickframe.click(viewAllButton);
    }
    await quickframe.waitForSelector('table table tr');

    while (true) {
      const rows = await quickframe.$$('table table tr');
      if (rows.length === 0) {
        log(`No data found.`, 'y');
        break;
      }

      let itemsCounter = 0;
      let links = [];
      // Extract data from table rows
      for (let index = 0; index < rows.length; index++) {
        if (link.length == config.maxItems) {
          break;
        }
        const row = rows[index];
        const link = await row.$('span.button');
        if (link) {
          const onclickValue = await link.evaluate((link) => {
            return link.getAttribute('onclick'); // Get the onclick attribute in row
          });
          var startIndex = onclickValue.indexOf('=') + 1;
          var endIndex = onclickValue.length;
          let value = '';
          value = onclickValue.slice(startIndex, endIndex).replace(/^'|'$/g, '');
          links.push(value); // Hold all links in a variable
        }
      }

      for (let l = 0; l < links.length; l++) {
        const link = links[l];
        const detailsPage = await page.browser().newPage(); // Open a new page
        await detailsPage.goto(`${config.recordLink}${link}`); // Go to the new page

        // Scrape data from record
        const info = await detailsPage.evaluate(() => {
          const outerTable = document.querySelector('table .data th');
          const tableData = outerTable.innerText.split('<br>');
          const items = tableData[0].split('\n');
          const name = items[0].trim();
          const mailingAddress = `${items[1]} ${items[2]}`;
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

      if (itemsCounter == config.maxItems) {
        log(`Max item count (${config.maxItems}) reached.`, 'y');
        break;
      }

      log(`No more data found.`, 'y');
      break;
    }

    if (config.outputSeparateFiles) {
      // Save and export to CSV file
      const folder = getDateText();
      let fileName = '';
      if (address.taxYear !== null) {
        fileName += `${address.taxYear}`;
      }
      if (address.streetNumber !== null) {
        fileName += `_${address.streetNumber}`;
      }
      if (address.streetName !== null) {
        fileName += `_${address.streetName}`;
      }
      fileName += '.csv';
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

module.exports = scrapeHarris;