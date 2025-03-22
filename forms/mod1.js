const { Key, By, until } = require('selenium-webdriver');
const FormBase = require('./form_base');
const { extractAndSaveFormControls } = require('./form_extract');
const readline = require('readline');

class Mod1 extends FormBase {
  constructor(_driver, _data, _mode) {
    super(_driver, _data, _mode);
    this.manageApplicationsUrl = null;
    this.mainApplicationHandle = null;
    this.entryUrl = 'https://sydneystudent.sydney.edu.au/sitsvision/wrd/siw_lgn';
  }

  async createProfile() {
    // Implementation for CreateProfileForm would go here
    // This is a placeholder - we would need the actual CreateProfileForm class
    console.log("Creating profile...");
  }

  async loginSession() {
    /**
     * Logs in to the application and returns the main window handle
     */
    try {
      const driver = this.driver;
      
      // Set a max retry count
      const maxRetries = 3;
      let currentTry = 0;
      
      while (currentTry < maxRetries) {
        try {
          await driver.get(this.entryUrl);
          
          // Ensure the browser is still open after navigation
          const handles = await driver.getAllWindowHandles();
          if (handles.length === 0) {
            throw new Error("Browser window was closed");
          }
          
          // Set explicit wait
          const wait = driver.wait(until.elementLocated(By.tagName("body")), 30000);
          
          // Wait for page to load
          await wait;
          
          // Store the main window handle
          const mainWindow = await driver.getWindowHandle();
          // LoginForm would be implemented here if needed
          
          if (!this.collectMode) {
            console.log('\n\n ================ personal info ================= \n', this.data[this.data.length - 1][3]);
            console.log('\n\n ================= edu info: ================= \n', this.data[this.data.length - 1][1]);
            console.log('\n\n ================= application info: ================= \n', this.data[this.data.length - 1][2]);
          }
          return mainWindow;
          
        } catch (e) {
          currentTry++;
          console.log(`Login attempt ${currentTry} failed: ${e.toString()}`);
          
          if (currentTry >= maxRetries) {
            throw e;
          }
          
          // If browser was closed, reinitialize it
          if (e.toString().toLowerCase().includes("no such window") || !(await driver.getAllWindowHandles()).length) {
            console.log("Browser window was closed. Reinitializing...");
            // Reinitialize driver would happen here
            // this.initializeDriver();
            driver = this.driver;
          }
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    } catch (e) {
      console.log(`Fatal error in login_session: ${e.toString()}`);
      // Ensure the browser is closed on error
      try {
        await this.driver.quit();
      } catch {
        // Ignore errors during quit
      }
      throw e;
    }

    this.manageApplicationsUrl = await this.driver.getCurrentUrl();
    this.mainApplicationHandle = await this.driver.getWindowHandle();
    
    if (!this.collectMode) {
      console.log('\n\n ================ personal info ================= \n', this.data[this.data.length - 1][3]);
      console.log('\n\n ================= edu info: ================= \n', this.data[this.data.length - 1][1]);
      console.log('\n\n ================= application info: ================= \n', this.data[this.data.length - 1][2]);
    }

    return this.mainApplicationHandle;
  }

  async fillForm() {
    const driver = this.driver;
    
    return true;
  }

  async newApplication() {
    const driver = this.driver;
    const students = this.data;

    await driver.close();
    await driver.switchTo().window(this.mainApplicationHandle);
    await driver.get(this.manageApplicationsUrl);
    students.pop();
    if (students.length === 0) {
      console.log('Congrats, you finished processing.');
      return false;
    }

    console.log('Now processing: ', students[students.length - 1][0]);
    return true;
  }

  async searchCourse() {
    const students = this.data;

    const dfApplication = students[students.length - 1][2];
    const filteredDf = dfApplication.filter(row => row['Proposed School'] === 'USYD');
    const courseApplied = filteredDf[0]['Proposed Course with Corresponding Links'];
    if (filteredDf.length > 1) {
      const newDf = filteredDf.slice(1);
      const newItem = [...students[students.length - 1]];
      newItem[0]['Number'] += 1;
      newItem[2] = newDf;
      students.unshift(newItem);
    }
            
    const course = '//*[contains(@id,"POP_UDEF") and contains(@id,"POP.MENSYS.1-1")]';
    await this.setValue(course, courseApplied);
  }

  async paymentEmail() {
    const email = '//*[@id="UDS_EMAIL"]';
    await this.setValue(email, 'au.info@shinyway.com');
  }

  async paymentMethod() {
    const cardnumber = '/html/body/form/fieldset/ul/li[1]/div[2]/input';
    const month = '/html/body/form/fieldset/ul/li[2]/div[2]/input[1]';
    const year = '/html/body/form/fieldset/ul/li[2]/div[2]/input[2]';
    
    await this.setValue(cardnumber, '123456789');
    await this.setValue(month, '09');
    await this.setValue(year, '25');
  }

  async run() {
    if (this.collectMode) {
      console.log('collect page information.');
      return;
    }

    const students = this.data;
    if (students.length === 0) {
      console.log('no more students to process.');
      process.exit();
    }
    
    const wait = this.driver.wait(until.elementLocated(By.tagName("body")), 10000);
    await wait;
    const url = await this.driver.getCurrentUrl();

    if (url.match('https://sydneystudent.sydney.edu.au/sitsvision/wrd/siw_ipp_cgi.start?')) {
      if (!await this.fillForm()) {
        process.exit();
      }
    } else if (url.match('https://sydneystudent.sydney.edu.au/sitsvision/wrd/SIW_POD.start_url?.+')) {
      await this.searchCourse();
    } else if (url.match('https://sydneystudent.sydney.edu.au/sitsvision/wrd/SIW_YMHD.start_url?.+')) {
      await this.createProfile();
    } else if (url.match('https://pay.sydney.edu.au/ePays/paymentemail\\?UDS_ACTION=PMPBPN')) {
      await this.paymentEmail();
    } else if (url.match('https://pay.sydney.edu.au/ePays/paymentemail$')) {
      await this.paymentMethod();
    } else {
      console.log('no actions for: ', url);
    }
  }
}

module.exports = Mod1;
