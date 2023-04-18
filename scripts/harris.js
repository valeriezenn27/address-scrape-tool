const puppeteer = require('puppeteer');
const {
  getSettings,
  exportCsv,
  log,
  logCounter,
  getDateText,
  format
} = require('../helpers');

async function scrapeHarris(county) {
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
    // Wait for the iframe to load
    await page.waitForSelector('iframe');
    const iframes = await page.$$('iframe');
    const searchFormIframe = iframes[0];
    const searchFormIframeContent = await searchFormIframe.contentFrame();
    // Click on Search by Address button
    await searchFormIframeContent.$eval('input#s_addr', el => el.click());
    await searchFormIframeContent.waitForSelector('form[name="Real_addr"]');
    await searchFormIframeContent.select('form[name="Real_addr"] select[name="TaxYear"]', address.taxYear); // Input the year
    if (address.streetNumber !== null) {
      await searchFormIframeContent.type('form[name="Real_addr"] input[name="stnum"]', address.streetNumber.toString(), {
        delay: 100
      }); // Input the address number
    }
    if (address.streetName !== null) {
      await searchFormIframeContent.type('form[name="Real_addr"] input[name="stname"]', address.streetName); // Input the address
    }
    // Click on the search button
    await searchFormIframeContent.$eval('form[name="Real_addr"] input[type="submit"]', el => el.click());
    log(`Scraping for :`);
    if (address.taxYear !== null) {
      log(`TAX YEAR : ${address.taxYear}`, 'y');
    }
    if (address.streetNumber !== null) {
      log(`STREET NUMBER : ${address.streetNumber}`, 'y');
    }
    if (address.streetName !== null) {
      log(`ADDRESS : ${address.streetName}`, 'y');
    }

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

    let allData = [];
    let itemsCounter = 0;
    const tabPromises = [];
    let stopLoop = false; // Initialize stopLoop flag
    // Extract data from table rows
    const rows = await quickframe.$$('table table tr');
    for (let index = 0; index < rows.length && !stopLoop; index++) {
      if (allData.length === config.maxItems) {
        break;
      }
      const row = rows[index];
      const link = await row.$('span.button');
      if (link) {
        // Get the onclick attribute in row
        const onclickValue = await link.evaluate((link) => {
          return link.getAttribute('onclick');
        });
        var startIndex = onclickValue.indexOf('=') + 1;
        var endIndex = onclickValue.length;
        let value = '';
        value = onclickValue.slice(startIndex, endIndex).replace(/^'|'$/g, '');
        const href = format(config.detailsUrl, value);
        const tabPagePromise = (async () => {
          try {
            // Open in new tab
            const tabPage = await browser.newPage();
            await page.waitForTimeout(500); // wait for .5 second before continuing
            // Open in new tab
            await tabPage.goto(href, {
              timeout: 60000
            });
            // Scrape data from record
            const info = await tabPage.evaluate(() => {
              const outerTable = document.querySelector('table .data th');
              const tableData = outerTable.innerText.split('<br>');
              const items = tableData[0].split('\n');
              const name = items[0].trim();
              const lastTwoNonEmpty = items.filter(str => str.trim() !== "").slice(-2);
              const mailingAddress = `${lastTwoNonEmpty[0]} ${lastTwoNonEmpty[1]}`;
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
            // Close new tab
            await tabPage.close();
          } catch (error) {
            console.error(error);
            await page.waitForTimeout(10000); // wait for 10 second before continuing
          }
        })();
        tabPromises.push(tabPagePromise);
        if (tabPromises.length === config.maxItems) {
          stopLoop = true; // Set stopLoop flag to true
        }
        if (tabPromises.length >= rows.length - 1) {
          await Promise.race(tabPromises); // Wait for the first tab to complete
          tabPromises.shift(); // Remove the completed promise from the array
        }
      }
    }
    await Promise.all(tabPromises); // Wait for any remaining tabs to complete


    if (config.outputSeparateFiles && allData.length > 0) {
      // Save and export to CSV file
      let fileName = '';
      if (address.taxYear !== null) {
        fileName += `${address.taxYear}_`;
      }
      if (address.streetNumber !== null) {
        fileName += `${address.streetNumber}_`;
      }
      if (address.streetName !== null) {
        fileName += `${address.streetName}`;
      }
      fileName += '.csv';
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

module.exports = scrapeHarris;