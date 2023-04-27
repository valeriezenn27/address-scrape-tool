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

async function scrapeDallas(county) {
  const config = getSettings(county);
  const date = getDateText();
  const chromiumPath = getChromiumPath();
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: chromiumPath,
  });
  log(`Scraping started for URL : ${config.url}`, 'y');
  const addresses = getAddresses(config.filePath);
  let allData = [];
  for (let i = 0; i < addresses.length; i++) {
    const page = await browser.newPage();
    await page.waitForTimeout(500); // wait for 1 second before continuing
    const address = addresses[i]['STREET ADDRESS'].replace('#', '');
    const city = addresses[i]['CITY STATE'];
    const zip = addresses[i]['ZIP'];
    log(`Scraping for :`);
    log(`ADDRESS : ${address}`, 'y');
    try {
      const pattern = isMatchPattern(address, city);
      if (pattern) {
        const streetNumber = pattern.streetNumber;
        const direction = pattern.direction;
        const streetName = pattern.streetName;
        const cityName = pattern.cityName;
        await page.goto(config.url, {
          timeout: 120000
        });
        // Input the address number
        await page.type('#txtAddrNum', streetNumber.toString(), {
          delay: 100
        });
        // Input direction
        if (direction !== undefined) {
          await page.select('#listStDir', direction.trim());
        }
        // Input the address name
        await page.type('#txtStName', streetName);
        // Input city name
        if (cityName !== undefined) {
          // Get the select element
          const selectElement = await page.$('select#listCity');
          // Get all the option elements
          const options = await selectElement.$$('option');
          // Iterate over the options to find the one with matching text
          let value;
          for (const option of options) {
            const text = await option.evaluate(el => el.textContent.trim());
            if (text === cityName.toUpperCase()) {
              value = await option.evaluate(el => el.value);
              break;
            }
          }
          const dropdownButton = await page.$('#listCity');
          await dropdownButton.select(value);
        }
        // Click on the search button
        await page.click('input#cmdSubmit');
        await page.waitForNetworkIdle();
        // Set up a loop that runs until there is no more data to scrape
        const searchResultsTableSelector = "table#SearchResults1_dgResults tbody";
        let possibleResults = [];
        while (true) {
          // Extract data from table rows
          const searchText = address;
          const tdElements = await page.$$(searchResultsTableSelector + " tr td");
          await Promise.all(tdElements.map(async (tdElement) => {
            const aElement = await tdElement.$('a#Hyperlink1');
            if (aElement) {
              const tdText = await aElement.getProperty("textContent").then((prop) => prop.jsonValue());
              const hrefValue = await aElement.getProperty("href").then((prop) => prop.jsonValue());
              const searchWords = searchText.split(" ");
              let isMatch = true;
              searchWords.forEach((word) => {
                if (!tdText.toUpperCase().includes(word.toUpperCase())) {
                  isMatch = false;
                }
              });
              if (isMatch) {
                possibleResults.push({
                  text: tdText,
                  href: hrefValue
                });
              }
            }
          }));

          // Check if there is a next button and click it
          const firstRow = await page.$('table#SearchResults1_dgResults tbody tr:first-child td');
          const textContents = await page.$$eval('table#SearchResults1_dgResults tbody tr:first-child td a', (links) => {
            return links.map(link => link.textContent);
          });
          const lastLinkText = textContents[textContents.length - 1];
          if (lastLinkText === 'NEXT >') {
            const nextButton = await firstRow.$('a:last-child');
            await nextButton.click();
            await page.waitForNavigation({
              timeout: 60000
            });
          } else {
            break;
          }
        }

        if (possibleResults) {
          await page.goto(possibleResults[0].href);
          await page.waitForSelector('#lblOwner');
        } else {
          console.log("No match found.");
        }
        // Scrape data from record
        const info = await page.evaluate(() => {
          const spanElement = document.querySelector('#lblOwner');
          const name = spanElement.nextSibling.textContent.replace(/&$/, '').trim();
          const element = document.querySelector('a[name="MultiOwner"]');
          const mailingAddress = `${element.previousElementSibling.previousElementSibling.previousSibling.textContent} ${element.previousElementSibling.previousSibling.textContent.replace(/\n/g, '').trim()}`;
          return {
            name,
            mailingAddress
          };
        });

        const name = toProperCase(info.name);
        const result = processAddress(info.mailingAddress);
        const mailingAddress = result.address;
        const mailingCityState = result.cityState;
        const mailingZip = result.zip;
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

        // Close new tab
        await page.close();
      } else {
        log('Result not found.', 'r');
      }
    } catch (error) {
      log(error.message, 'r');
      await page.waitForTimeout(10000); // wait for 10 second before continuing
      continue;
    }
  }

  if (allData.length > 0) {
    // Save and export to CSV file
    log(`Total number from input data : ${addresses.length}`, 'y');
    log(`Total number of scraped data : ${allData.length}`, 'y');
    const fileName = format(config.outputPath, county, date);
    await exportCsv(fileName, allData);
  }
  // Close the browser
  await browser.close();
}

module.exports = scrapeDallas;