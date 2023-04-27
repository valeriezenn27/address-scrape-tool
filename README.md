# Web Scraping with Puppeteer

This is a Node.js script that uses Puppeteer, a powerful web scraping library, to scrape data from a website and save it to a CSV file.

## Prerequisites

Before using this script, you need to have the following software installed on your machine:

- Node.js (https://nodejs.org/)
- npm (Node.js package manager, usually installed along with Node.js)

## Installation

1. Clone this repository to your local machine.
2. Install the required dependencies by running the following command in the project directory:
`npm install`


## Usage

1. Modify the `config\{county}.json` file to configure the scraping process. You can specify the URL to scrape, addresses to search, max number of items to scrape, output path for CSV file, CSV header, and Puppeteer options.
2. Run the script by running the following command in the project directory:
`npm run {county}`
3. The script will start scraping data from the specified website and save it to a CSV file in the output path specified in the `config\{county}.json` file.
4. Once the scraping is completed, the CSV file will be generated in the specified output path, and a success message will be displayed in the console.

Note: Please make sure to update the file paths and other configuration values in the `config\{county}.json` file according to your specific use case.

## Contributing

If you encounter any issues or have suggestions for improvements, feel free to open an issue or submit a pull request.

## License

This project is licensed under the [MIT License](LICENSE).