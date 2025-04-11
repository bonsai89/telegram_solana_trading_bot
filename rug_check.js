const puppeteer = require('puppeteer');

// Async function to check rug status
async function checkRugStatus(token_address) {
    const url = `https://rugcheck.xyz/tokens/${token_address}`;

    // Launch Puppeteer in headless mode
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    let result;

    try {
        // Navigate to the token URL
        await page.goto(url, { waitUntil: 'domcontentloaded' });

        // Wait for the status element to appear
        await page.waitForSelector('.risk', { timeout: 20000 });

        // Extract the status text
        const status = await page.$eval('.risk', el => el.textContent.trim());

        if (status === 'Danger') {
            // Check for "Freeze Authority still enabled"
            const freezeAuthorityExists = await page.evaluate(() => {
                const alertElements = document.querySelectorAll('.alert');
                return Array.from(alertElements).some(el => el.textContent.includes('Freeze Authority still enabled'));
            });

            result = freezeAuthorityExists ? 'Danger' : 'Warning';
        } else {
            result = status || 'Warning';
        }
    } catch (error) {
        console.error(`Error fetching status for token: ${token_address}`, error);
        // Return 'Good' if there's an error during loading or fetching
        result = 'Warning';
    } finally {
        // Close the browser
        await browser.close();
    }

    return result;
}

// Export the function for use in other modules
module.exports = checkRugStatus;
