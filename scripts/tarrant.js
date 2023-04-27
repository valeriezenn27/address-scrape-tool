const puppeteer = require('puppeteer');
const {
  getSettings,
  exportCsv,
  log,
  logCounter,
  getDateText,
  format,
  getAddresses,
  isMatchPattern,
  getZip,
  toProperCase,
  processAddress,
  getChromiumPath
} = require('../helpers');

async function scrapeTarrant(county) {
  const config = getSettings(county);
  const date = getDateText();
  const chromiumPath = getChromiumPath();
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: chromiumPath,
  });
  const page = await browser.newPage();
  await page.goto(config.url, {
    timeout: 120000
  });
  log(`Scraping started for URL : ${config.url}`, 'y');
  const addresses = getAddresses(config.filePath);
  let allData = [];
  for (let i = 0; i < addresses.length; i++) {
    const address = addresses[i]['STREET ADDRESS'];
    const addressParts = address.split('#');
    const cleanedAddress = addressParts[0].trim();
    const city = addresses[i]['CITY STATE'];
    const zip = addresses[i]['ZIP'];
    log(`Scraping for :`);
    log(`ADDRESS : ${address}`, 'y');

    let success = false;
    let attempts = 0;
    const maxAttempts = 3; // Set the maximum number of attempts here
    while (!success && attempts < maxAttempts) {
      try {
        attempts++;
        await page.select('select[name="search_string_type"]', 'property_address');
        // Input the address
        const inputSelector = 'input[name="search_string"]';
        await page.evaluate((selector) => {
          document.querySelector(selector).value = "";
        }, inputSelector);
        await page.type(inputSelector, cleanedAddress);
        // Click on the search button
        await page.evaluate(() => {
          const buttons = document.querySelectorAll('button.btn-primary[type="submit"]');
          buttons[buttons.length - 1].click();
        });
        // Wait for the results table to load
        await page.waitForSelector('table', {
          timeout: 120000
        });
        await page.waitForTimeout(500);
        await page.evaluate(async (address) => {
          const tds = document.querySelectorAll('tbody tr td');
          const tdWithAddress = Array.from(tds).find(td => td.textContent.trim().includes(address.toUpperCase()));
          if (tdWithAddress) {
            const tr = tdWithAddress.closest('tr'); // navigate to the parent tr element
            const link = tr.querySelector('td:first-child a'); // select the link in the first td element
            if (link) {
              link.click();
            } else {
              console.log(`No link found in row for address: ${address}`);
            }
          } else {
            console.log(`No cell found for address: ${address}`);
          }
        }, address);
        await page.waitForSelector('table', {
          timeout: 120000
        });
        const ownershipTabSelector = 'a[href="#tab4"]';
        if (ownershipTabSelector) {
          // Click ownership section
          await page.click(ownershipTabSelector);
          await page.waitForTimeout(1000);
          // Scrape data from ownership table rows
          const info = await page.$$eval('table.table-primary tbody tr', (rows) => {
            const [firstRow] = rows;
            const cells = Array.from(firstRow.querySelectorAll('td')).slice(0, -1);
            const mailingAddressZip = Array.from(firstRow.querySelectorAll('td')).pop().innerText.trim();
            const [name, ...mailingAddress] = cells.map(cell => cell.innerText.trim());
            return {
              name,
              mailingAddress: mailingAddress.join(' '),
              mailingAddressZip
            };
          });

          const name = toProperCase(info.name);
          const result = processAddress(info.mailingAddress);
          const mailingAddress = result.address;
          const mailingCityState = result.cityState;
          const mailingZip = info.mailingAddressZip;
          const data = {
            address,
            city,
            zip,
            name,
            mailingAddress,
            mailingCityState,
            mailingZip
          };
          allData.push(data);
          log(data);
        } else {
          log('Result not found.', 'r');
        }

        success = true;
      } catch (error) {
        log(error.message);
        if (attempts < maxAttempts) {
          const RETRY_TIMEOUT = 5000; // retry timeout in 5s
          log(`retrying in ${RETRY_TIMEOUT / 1000} seconds...`);
          await page.waitForTimeout(RETRY_TIMEOUT);
        } else {
          log(error.message, 'r');
        }
      }
    }
  }

  if (allData.length > 0) {
    // Save and export to CSV file
    log(`Total number from input data : ${addresses.length}`, 'y');
    log(`Total number of scraped data : ${allData.length}`, 'y')
    const fileName = format(config.outputPath, county, date)
    await exportCsv(fileName, allData);
  }
  // Close the browser
  await browser.close();
}

module.exports = scrapeTarrant;