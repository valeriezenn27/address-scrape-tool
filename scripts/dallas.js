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
  log(`Scraping started for URL : ${config.url}`, 'y');
  const browser = await puppeteer.launch({
    headless: false
  });
  const page = await browser.newPage();

  let consolidatedData = [];
  for (let i = 0; i < config.addresses.length; i++) {
    let allData = [];
    await page.goto(config.url);
    const address = config.addresses[i];
    log(`Scraping for :`);
    if (address.addressNumber !== null) {
      log(`ADDRESS NUMBER : ${address.addressNumber}`, 'y');
    }
    if (address.direction !== null) {
      log(`DIRECTION : ${address.direction}`, 'y');
    }
    if (address.streetName !== null) {
      log(`STREET NAME : ${address.streetName}`, 'y');
    }

    if (address.addressNumber !== null) {
      await page.type('#txtAddrNum', address.addressNumber.toString(), {
        delay: 100
      }); // Input the address number
    }
    if (address.direction !== null) {
      await page.select('#listStDir', address.direction); // Input the year
    }
    await page.type('#txtStName', address.streetName); // Input the address number
    if (!address.isResidential) {
      const checkbox = await page.$('#AcctTypeCheckList1_chkAcctType_0'); // Residential checkbox
      await checkbox.click();
    }
    if (!address.isResidential) {
      const checkbox = await page.$('#AcctTypeCheckList1_chkAcctType_1'); // Commercial checkbox
      await checkbox.click();
    }
    if (!address.isResidential) {
      const checkbox = await page.$('#AcctTypeCheckList1_chkAcctType_2'); // BPP checkbox
      await checkbox.click();
    }
    await page.click('input#cmdSubmit'); // Click on the search button

    // Wait for the results table to load
    const resultsTable = await page.$('#SearchResults1_dgResults');
    if (!resultsTable) {
      log(`No data found.`, 'y');
    } else {
      let itemsCounter = 0;
      let links = [];
      while (true) {
        const rows = await page.$$('table#SearchResults1_dgResults tbody tr');
        // Extract data from table rows
        for (let index = 2; index < rows.length - 3; index++) {
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
        const firstRow = rows[0];
        const nextButton = await firstRow.$('a');
        if (nextButton) {
          await nextButton.click();
          await page.waitForNavigation({
            timeout: 60000
          });
        } else {
          break;
        }
      }

      const numBatches = Math.ceil(links.length / 20);
      for (let i = 0; i < numBatches; i++) {
        const startIdx = i * 20;
        const endIdx = Math.min(links.length, (i + 1) * 20);
        const batchLinks = links.slice(startIdx, endIdx);

        const promises = batchLinks.map(async (link) => {
          const tabPage = await browser.newPage();
          await tabPage.goto(link);

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
          itemsCounter++;
          allData.push(info);
          consolidatedData.push(info);
          logCounter(info, itemsCounter);

          await tabPage.close();
        });

        await Promise.all(promises);
      }


      if (itemsCounter == config.maxItems) {
        log(`Max item count (${config.maxItems}) reached.`, 'y');
      } else {
        log(`No more data found.`, 'y');
      }

      if (config.outputSeparateFiles) {
        // Save and export to CSV file
        let fileName = '';
        if (address.addressNumber !== null) {
          fileName += `${address.addressNumber}_`;
        }
        if (address.direction !== null) {
          fileName += `${address.direction}_`;
        }
        if (address.streetName !== null) {
          fileName += `${address.streetName}`;
        }
        fileName += '.csv';
        await exportCsv(config.outputPath, folder, fileName, allData);
      }
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

module.exports = scrapeDallas;