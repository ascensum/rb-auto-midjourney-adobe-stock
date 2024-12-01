const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config();

function delay(time) {
  return new Promise(function(resolve) { 
    setTimeout(resolve, time)
  });
}

puppeteer.use(StealthPlugin());

const timeout = 8000;

async function waitForSelectorWithRetry(page, selector, retries = 10, delay = 10000) {
  for (let i = 0; i < retries; i++) {
    try {
      await page.waitForSelector(selector, { visible: true, timeout: 120000 });
      return;
    } catch (error) {
      console.warn(`Retry ${i + 1}/${retries} failed for selector: ${selector}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error(`Failed to find selector: ${selector} after ${retries} retries`);
}

async function extractTableData(page, selector, baseUrl) {
  return await page.evaluate(({ selector, baseUrl }) => {
    const table = document.querySelector(selector);
    const rows = Array.from(table.querySelectorAll('tr'));

    // Extract headers
    const headers = Array.from(rows.shift().querySelectorAll('th, td')).map(header => header.innerText.trim());

    // Extract rows
    return rows.map(row => {
      const cells = Array.from(row.querySelectorAll('th, td'));
      const rowData = {};
      cells.forEach((cell, i) => {
        if (headers[i] === 'Actions') {
          const actionLinks = cell.querySelectorAll('a');
          actionLinks.forEach(link => {
            const title = link.title.trim();
            let href = link.href.trim();
            // Check if href is already a full URL
            if (!href.startsWith('http')) {
              href = baseUrl + href;
            }
            rowData[title] = href;
          });
        } else {
          rowData[headers[i]] = cell.innerText.trim();
        }
      });
      return rowData;
    });
  }, { selector, baseUrl });
}


async function clickWithRetry(page, selector, retries = 3, delayTime = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Attempt ${i + 1} to click ${selector}`);
      await waitForSelectorWithRetry(page, selector, 3, delayTime);
      const element = await page.$(selector);
      if (element) {
        await element.click();
        console.log(`Successfully clicked ${selector}`);
        return;
      }
    } catch (error) {
      console.warn(`Retry ${i + 1}/${retries} failed for selector: ${selector}`, error);
      await delay(delayTime);
    }
  }
  throw new Error(`Failed to click on selector: ${selector} after ${retries} retries`);
}

async function navigateWithRetry(page, url, retries = 3, delayTime = 5000) {
  for (let i = 0; i < retries; i++) {
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });
      return;
    } catch (error) {
      console.warn(`Retry ${i + 1}/${retries} failed for navigation to: ${url}`);
      await delay(delayTime);
    }
  }
  throw new Error(`Failed to navigate to: ${url} after ${retries} retries`);
}

async function getTrendingKeywordsDataModule(filePath) {
  let browser;
  let page;
  try {
    if (!filePath) {
      throw new Error('File path is undefined');
    }
    console.log(`File path: ${filePath}`);

    browser = await puppeteer.launch({ headless: true, args: ['--start-maximized']});
    page = await browser.newPage();
    console.log('Page initialized');

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

    const url = process.env.REDBUBBLE_TRENDS_URL;
    const baseUrl = process.env.REDBUBBLE_TRENDS_URL_BASE_URL;

    if (!url || !baseUrl) {
      console.error("ERROR: URL or BASE_URL is not defined in the .env file");
      process.exit(1);
    }

    console.log("Navigating to " + url);
    await navigateWithRetry(page, url);

    // Add a delay to allow for any dynamic content to load
    await delay(5000);

    const cookieConsentSelector = '#ez-accept-all';
    
    // Check if the cookie consent button is present
    const isCookieConsentPresent = await page.evaluate((selector) => {
      return !!document.querySelector(selector);
    }, cookieConsentSelector);

    if (isCookieConsentPresent) {
      console.log("Cookie consent button found. Attempting to click...");
      await waitForSelectorWithRetry(page, cookieConsentSelector, 5, 2000);
      await clickWithRetry(page, cookieConsentSelector, 3, 2000);
    } else {
      console.log("Cookie consent button not found. Proceeding without clicking.");
    }

    await waitForSelectorWithRetry(page, '#myTable2 tbody tr', 5, 60000);

    const tableSelector = '#myTable2';
    let allTableData = [];

    // Extract data from the first page
    const firstPageData = await extractTableData(page, tableSelector, baseUrl);
    allTableData.push(...firstPageData);

    // Write the first page data to file
    fs.writeFileSync(filePath, JSON.stringify(allTableData, null, 2));
    console.log('Data from page 1 written to file');

    const paginationLinks = await page.evaluate(() => {
      const paginationBar = document.querySelector('#myTable2_paginate');
      const links = paginationBar.querySelectorAll('a.paginate_button:not(.disabled)');
      return Array.from(links).map(link => ({
        text: link.innerText.trim(),
        dataIdx: link.getAttribute('data-dt-idx')
      }));
    });

    let currentPage = 1;
    const maxPages = Math.max(...paginationLinks.map(link => parseInt(link.text)).filter(num => !isNaN(num)));

    let emptyPageCounter = 0;
    const MAX_EMPTY_PAGES = 3;
    
    while (currentPage < maxPages) {
      console.log(`Processing page ${currentPage + 1}`);
      
      try {
          // Check if the "Next" button is disabled
        const isNextButtonDisabled = await page.$eval('#myTable2_next', el => el.classList.contains('disabled'));
        if (isNextButtonDisabled) {
          console.log('Next button is disabled, reached the last page');
          break; // Exit the while loop
        }

        // Click the 'Next' button using clickWithRetry
        await clickWithRetry(page, '#myTable2_next', 3, 5000);

        await delay(2000);

        // Check for error overlay
        const errorOverlay = await page.$('.error-overlay');
        if (errorOverlay) {
          console.log('Error overlay detected');
          // Handle the error situation
          // For example, you might want to:
          // 1. Log more details about the error
          const errorText = await page.$eval('.error-overlay', el => el.textContent);
          console.log('Error message:', errorText);
          
          // 2. Take a screenshot
          await page.screenshot({ path: `error_page_${currentPage + 1}.png` });
          
          // 3. Decide whether to retry, skip this page, or stop the process
          // For now, let's throw an error to trigger the catch block
          throw new Error('Error overlay detected: ' + errorText);
        }
      
               
        // Wait for the table info to update using waitForSelectorWithRetry
        await waitForSelectorWithRetry(page, '#myTable2_info', 5, 30000);
        
        // Additional check: wait for table rows to be visible
        await waitForSelectorWithRetry(page, '#myTable2 tbody tr', 5, 30000);
        
        // Extract data from the new page
        const tableDataNextPage = await extractTableData(page, tableSelector, baseUrl);

        
        if (tableDataNextPage.length === 0) {
          console.warn(`Warning: No data extracted from page ${currentPage + 1}`);
          emptyPageCounter++;
          if (emptyPageCounter >= MAX_EMPTY_PAGES) {
            console.error(`Encountered ${MAX_EMPTY_PAGES} empty pages in a row. Stopping the process.`);
            break;
          }
        } else {
          emptyPageCounter = 0;  // Reset the counter when we successfully get data
          // Append data from the next page to the existing data
          allTableData.push(...tableDataNextPage);
          
          // Write the updated data to file
          fs.writeFileSync(filePath, JSON.stringify(allTableData, null, 2));
          console.log(`Data from page ${currentPage + 1} appended to file`);
          
          currentPage++;
        }

        // Add a small delay between pages
        await delay(2000);
      } catch (error) {
        console.error(`Error processing page ${currentPage + 1}:`, error);
        
        // Take a screenshot of the error state
        await page.screenshot({ path: `error_page_${currentPage + 1}.png` });
        
        // Log the HTML content of the page
        const htmlContent = await page.content();
        fs.writeFileSync(`error_page_${currentPage + 1}_content.html`, htmlContent);
        
        // Attempt to recover: reload the page and try again
        console.log("Attempting to recover...");
        await navigateWithRetry(page, page.url(), 3, 5000);
        
        // Wait for a short time before continuing
        await delay(5000);
        
        // If recovery fails multiple times, break the loop
        if (error.__recoveryAttempts && error.__recoveryAttempts > 3) {
          console.error("Multiple recovery attempts failed. Stopping the process.");
          break;
        }
        
        // Set a flag to indicate a recovery attempt
        error.__recoveryAttempts = (error.__recoveryAttempts || 0) + 1;
        
        // Continue the loop without incrementing currentPage to retry the same page
        continue;
      }
    }

    console.log('All data has been written to file');

  } catch (error) {
    console.error("ERROR: An error occurred while processing the page", error);
    if (page) {
      await page.screenshot({ path: 'error_screenshot.png' });
      const htmlContent = await page.content();
      fs.writeFileSync('error_page_content.html', htmlContent);
      console.log("Error page screenshot and HTML content saved.");
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function checkTrendingKeywordsAgeModule() {
  const currentDate = new Date().toISOString().split('T')[0].replace(/-/g, '.');
  const fileName = `trending_keywords_data_raw_${currentDate}.json`;
  const dirPath = path.join(__dirname, '..', process.env.FILE_PATH || 'src/keywords_data_raw');
  const filePath = path.join(dirPath, fileName);

  // Check if today's file exists
  if (fs.existsSync(filePath)) {
    console.log('Today\'s file already exists. No update needed.');
    return false;
  }

  // Find the most recent file
  const files = fs.readdirSync(dirPath);
  let mostRecentFile = '';
  let mostRecentDate = 0;

  files.forEach((file) => {
    const fileStat = fs.statSync(path.join(dirPath, file));
    if (fileStat.mtime > mostRecentDate) {
      mostRecentDate = fileStat.mtime;
      mostRecentFile = file;
    }
  });

  if (mostRecentFile) {
    const fileAge = (Date.now() - mostRecentDate) / (1000 * 60 * 60 * 24);
    if (fileAge <= 7) {
      console.log('Most recent file is not older than 7 days. No update needed.');
      return false;
    }
  }

  // If we reach here, we need to update
  console.log('Trending keywords data needs updating. Initiating data retrieval...');
  await getTrendingKeywordsDataModule(filePath);
  deleteOldFilesModule(dirPath);
  return true;
}

function deleteOldFilesModule(dirPath) {
  const files = fs.readdirSync(dirPath);
  if (files.length <= 1) {
    console.log('Skipping deletion as there is only one file in the directory.');
    return;
  }

  let mostRecentFile = '';
  let mostRecentDate = 0;
  const currentDate = new Date().toISOString().split('T')[0].replace(/-/g, '.');

  files.forEach((file) => {
    const currentFileStats = fs.statSync(path.join(dirPath, file));
    const currentFileAgeInDays = (Date.now() - currentFileStats.mtimeMs) / (1000 * 60 * 60 * 24);
    
    if (file.includes(currentDate)) {
      return; // Skip the file created on the current day
    }

    if (currentFileAgeInDays > mostRecentDate) {
      mostRecentDate = currentFileAgeInDays;
      mostRecentFile = file;
    }
  });

  files.forEach((file) => {
    if (file !== mostRecentFile && !file.includes(currentDate)) {
      fs.unlinkSync(path.join(dirPath, file));
      console.log(`Removed older file: ${file}`);
    }
  });
}

// Run the module directly if this file is executed
if (require.main === module) {
  checkAndRunModule().catch(error => {
    console.error("ERROR: An unhandled error occurred", error);
    process.exit(1);
  });
}

module.exports = { getTrendingKeywordsDataModule, 
                 checkTrendingKeywordsAgeModule,
                 deleteOldFilesModule };