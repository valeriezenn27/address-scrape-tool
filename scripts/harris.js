const puppeteer = require('puppeteer');
const {
  getSettings,
  exportCsv,
  log,
  logCounter,
  getDateText,
  format,
  getAddresses,
  isMatchPattern
} = require('../helpers');

async function scrapeHarris(county) {
  const config = getSettings(county);
  const date = getDateText();
  const browser = await puppeteer.launch({
    headless: true
  });
  log(`Scraping started for URL : ${config.url}`, 'y');
  const page = await browser.newPage();
  await page.waitForTimeout(1000); // wait for 1 second before continuing
  await page.goto(config.url, {
    timeout: 120000
  });
  // Wait for the iframe to load
  await page.waitForSelector('iframe');
  const iframes = await page.$$('iframe');
  const searchFormIframe = iframes[0];
  const searchFormIframeContent = await searchFormIframe.contentFrame();
  // Click on Search by Address button
  await searchFormIframeContent.$eval('input#s_addr', el => el.click());
  const formSelector = 'form[name="Real_addr"]';
  await searchFormIframeContent.waitForSelector(formSelector);

  const addresses = getAddresses(config.filePath);
  let allData = [];
  for (let i = 0; i < addresses.length; i++) {
    const address = addresses[i]['STREET ADDRESS'].replace('#', '');
    const city = addresses[i]['CITY STATE'];
    const zip = addresses[i]['ZIP'];
    log(`Scraping for :`);
    log(`ADDRESS : ${address}`, 'y');
    try {
      const pattern = isMatchPattern(address, city);
      if (pattern) {
        const streetNumber = pattern.streetNumber;
        let streetName = pattern.streetName;
        if (pattern.direction !== undefined) {
          streetName = `${pattern.direction} ${pattern.streetName}`;
        }
        // Input the address number
        await searchFormIframeContent.evaluate((selector) => {
          document.querySelector(selector).value = "";
        }, formSelector + ' input[name="stnum"]');
        await searchFormIframeContent.type(formSelector + ' input[name="stnum"]', streetNumber.toString(), {
          delay: 100
        });
        // Input the address
        await searchFormIframeContent.evaluate((selector) => {
          document.querySelector(selector).value = "";
        }, formSelector + ' input[name="stname"]');
        await searchFormIframeContent.type(formSelector + ' input[name="stname"]', streetName);
        // Click on the search button
        await searchFormIframeContent.$eval(formSelector + ' input[type="submit"]', el => el.click());

        // Wait for the results iframe to load
        const iframeSelector = 'iframe#quickframe';
        await searchFormIframeContent.waitForSelector(iframeSelector);
        const quickframeHandle = await searchFormIframeContent.$(iframeSelector);
        const quickframe = await quickframeHandle.contentFrame();

        await page.waitForNetworkIdle();
        await page.waitForTimeout(1000); // wait for 1 second before continuing
        // Scrape data from record
        const info = await quickframe.evaluate(() => {
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

        info['address'] = address;
        info['city'] = city;
        info['zip'] = zip;
        allData.push(info);
        log(info);
      } else {
        log('No results.')
      }
    } catch (error) {
      log(error.message, 'r');
      await page.waitForTimeout(10000); // wait for 10 second before continuing
      continue;
    }
  }

  if (allData.length > 0) {
    // Save and export to CSV file
    log(`Total number of scraped data : ${allData.length}`, 'y')
    const fileName = format(config.outputPath, county, date)
    await exportCsv(fileName, allData);
  }
  // Close the browser
  await browser.close();
}

module.exports = scrapeHarris;