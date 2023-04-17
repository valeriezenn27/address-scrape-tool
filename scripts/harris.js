const puppeteer = require('puppeteer');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const config = require('../config/harris.json');

const currentDate = new Date();
const dateText = `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}-${currentDate.getDate()}_${currentDate.getHours()}-${currentDate.getMinutes()}-${currentDate.getSeconds()}`;
const path = `${config.outputPath}${dateText}.csv`;

// Create CSV writer to write the scraped data
const csvWriter = createCsvWriter({
  path: path,
  header: config.csvHeader
});

(async () => {
  console.clear();
  console.log(`Scraping started for URL : ${config.url}`);
  const browser = await puppeteer.launch(config.puppeteerOptions);
  const page = await browser.newPage();

  let allData = [];
  for (let i = 0; i < config.queries.length; i++) {
    await page.goto(config.url);
    await page.waitForSelector('iframe'); // Wait for the iframe to load
    // Switch to the first iframe containing the search form
    const iframes = await page.$$('iframe');
    const searchFormIframe = iframes[0]; // Update the index based on the actual position of the iframe
    const searchFormIframeContent = await searchFormIframe.contentFrame();

    const query = config.queries[i];
    console.log(`Scraping for query : ${query.taxYear} - ${query.streetNumber} - ${query.streetName}`);
    await searchFormIframeContent.$eval('input#s_addr', el => el.click()); // Click on Search by Address button
    await searchFormIframeContent.waitForSelector('form[name="Real_addr"]');
    await searchFormIframeContent.select('form[name="Real_addr"] select[name="TaxYear"]', query.taxYear); // Input the year
    if (query.streetNumber !== null) {
      await searchFormIframeContent.type('form[name="Real_addr"] input[name="stnum"]', query.streetNumber.toString(), {
        delay: 100
      }); // Input the street number as string with delay
    }
    if (query.streetName !== null) {
      await searchFormIframeContent.type('form[name="Real_addr"] input[name="stname"]', query.streetName); // Input the address
    }
    await searchFormIframeContent.$eval('form[name="Real_addr"] input[type="submit"]', el => el.click()); // Click on the search button

    // Wait for the results iframe to load
    await searchFormIframeContent.waitForSelector('iframe#quickframe');
    const quickframeHandle = await searchFormIframeContent.$('iframe[name="quickframe"]');
    const quickframe = await quickframeHandle.contentFrame();

    //Click view all button if available
    try {
      const viewAllButtonSelector = 'form#form1 input#submit2';
      const viewAllButton = await page.$(viewAllButtonSelector);
      if (nextButton) {
        await quickframe.click(viewAllButton);
      } else {
        console.log('View All button not found.');
      }
    } catch {
      console.log('View All button not found.');
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
          // await link.click();
          const onclickValue = await link.evaluate((link) => {
            return link.getAttribute('onclick');
          });

          // Extract the link value after "="
          var startIndex = onclickValue.indexOf('=') + 1; // Add 1 to exclude the "=" sign
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
        await detailsPage.goto(`https://public.hcad.org/records/${link}`); // Go to the new page

        const data = await detailsPage.evaluate(() => {
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
        console.log(`-----ITEM COUNTER: ${itemsCounter}-----`);
        console.log(data);
        allData.push(data);

        await detailsPage.close();
      }

      if (itemsCounter == config.maxItems) {
        console.log(`Max item count reached for query : ${query.taxYear} - ${query.streetNumber} - ${query.streetName}`);
        break;
      }
    }
  }

  // Write the scraped data to a CSV file
  await csvWriter.writeRecords(allData)
    .then(() => {
      console.log(`Scraping complete. Data has been written to ${path} file.`);
    })
    .catch(err => {
      console.error('Error writing data to CSV:', err);
    });

  // Close the browser
  await browser.close();
})();