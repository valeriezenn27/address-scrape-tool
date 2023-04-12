Realt Address Scraper

This Node.js application allows you to scrape county details from a website based on the county name provided as a command-line argument.

Usage

1. Clone the repository to your local machine.
2. Install the required dependencies by running npm install.
3. Create a configuration file for your county in the config directory. The configuration file should be in JSON format and contain the following properties:
url: The base URL of the website to scrape.
search: The search URL path to perform the county search.
searchParam: The search parameter to pass to the website to search for the county.
maxResults: The maximum number of results to scrape.
selectors: An object containing CSS selectors for various elements on the website, such as search input, search button, table rows, ownership tab, etc.
outputFile: The file name to save the scraped results in CSV format.
Here's an example of a configuration file for an county named "tad":

{
	"url": "https://www.tad.org",
	"search": "/property/search",
	"searchParam": "arlington",
	"maxResults": 10,
	"selectors": {
		"searchInputSelector": "input[name='search_string']",
		"searchButtonSelector": "button.btn-square[type='submit']",
		"tableRowSelector": "table tr",
		"ownershipButtonSelector": "a[href='#tab4']",
		"nextButtonSelector": ".m-0 button.btn-link"
	},
	"outputFile": "tad_output.csv"
}

4. Run the application using the following command, providing the county name as a command-line argument: 
node app.js tad

Replace "tad" with the name of the county for which you want to scrape details.

5. The application will scrape the county details from the website and save the results in a CSV file as per the configuration provided. The scraped details will include the name and mailing address of the county.
6. Once the scraping is completed, you can find the results in the CSV file specified in the configuration.
Note: Make sure to comply with the website's terms of service and usage policies while using this scraper. Always respect the website's robots.txt file and ensure that your scraping activity is legal and ethical.