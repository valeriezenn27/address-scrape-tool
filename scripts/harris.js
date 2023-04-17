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
      }); // Input the street number as string with delay
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

    let itemsCounter = 0;
    let links = [];
    while (true) {
      await quickframe.waitForSelector('table table tr');

      const rows = await quickframe.$$('table table tr');
      for (let j = 0; j < rows.length; j++) {
        if (itemsCounter == config.maxItems) {
          continue;
        }
        const row = rows[j];
        // Click on the link within the row to open details page
        const link = await row.$('span.button');
        if (link) {
          const onclickValue = await link.evaluate((link) => {
            return link.getAttribute('onclick');
          });
          var startIndex = onclickValue.indexOf('=') + 1;
          var endIndex = onclickValue.length;
          let value = '';
          value = onclickValue.slice(startIndex, endIndex).replace(/^'|'$/g, '');
          links.push(value);
        }
      }

      for (let l = 0; l < links.length; l++) {
        const link = links[l];
        if (itemsCounter == config.maxItems) {
          continue;
        }
        const detailsPage = await page.browser().newPage(); // Open a new page
        await detailsPage.goto(`${config.recordLink}${link}`); // Go to the new page

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
        logCounter(info, itemsCounter);

        // Close details page tab
        await detailsPage.close();
      }

      if (itemsCounter == config.maxItems) {
        log(`Max item count (${config.maxItems}) reached.`, 'y');
        break;
      }
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
      break;
    }
  }

  if (!config.outputSeparateFiles) {
    // Save and export to CSV file
    const fileName = `${getDateText()}.csv`
    await exportCsv(config.outputPath, null, fileName, allData);
  }
  // Close the browser
  await browser.close();
}

module.exports = scrapeHarris;