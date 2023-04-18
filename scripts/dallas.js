const puppeteer = require('puppeteer');
const {
  getSettings,
  exportCsv,
  log,
  logCounter,
  getDateText
} = require('../helpers');

async function scrapeDallas(county) {
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
    if (address.addressNumber !== null) {
      await page.type('#txtAddrNum', address.addressNumber.toString(), {
        delay: 100
      }); // Input the address number
    }
    await page.type('#txtStName', address.streetName); // Input the address number
    // Click on the search button
    await page.click('input#cmdSubmit');
    log(`Scraping for :`);
    if (address.addressNumber !== null) {
      log(`ADDRESS NUMBER : ${address.addressNumber}`, 'y');
    }
    if (address.streetName !== null) {
      log(`STREET NAME : ${address.streetName}`, 'y');
    }
    await page.waitForNetworkIdle();

    let allData = [];
    let itemsCounter = 0;
    const tabPromises = [];
    let stopLoop = false; // Initialize stopLoop flag
    while (true) {
      // Extract data from table rows
      const rows = await page.$$('table#SearchResults1_dgResults tbody tr');
      for (let index = 2; index < rows.length - 1 && !stopLoop; index++) {
        if (allData.length === config.maxItems) {
          break;
        }
        const row = rows[index];
        const href = await row.$eval('td a', a => a.href); // Get the href in row
        const tabPagePromise = (async () => {
          try {
            const tabPage = await browser.newPage();
            await page.waitForTimeout(500); // wait for .5 second before continuing
            // Open in new tab
            await tabPage.goto(href, {
              timeout: 60000
            });
            // Scrape data from record
            const info = await tabPage.evaluate(() => {
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
      await Promise.all(tabPromises); // Wait for any remaining tabs to complete

      if (allData.length === config.maxItems) {
        log(`Max item count (${config.maxItems}) reached.`, 'y');
        break;
      }
      // Click the next button to go to the next page
      const firstRow = rows[0];
      const nextButton = await firstRow.$('a');
      if (nextButton) {
        await nextButton.click();
        await page.waitForNetworkIdle();
      } else {
        break;
      }
    }

    if (config.outputSeparateFiles && allData.length > 0) {
      // Save and export to CSV file
      let fileName = '';
      if (address.addressNumber !== null) {
        fileName += `${address.addressNumber}_`;
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

module.exports = scrapeDallas;