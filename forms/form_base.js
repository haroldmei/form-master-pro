const { Key } = require('selenium-webdriver');
const { DateTime } = require('luxon');

class FormBase {
  constructor(_driver, _data, _mode) {
    this.driver = _driver;
    this.data = _data;
    this.collect_mode = _mode;
    this.entry_url = null;
  }

  async collectInfo() {
    console.log('Collecting page information.');
    const elems = await this.driver.findElements({ xpath: '//*[@id]' });
    
    for (const e of elems) {
      const eid = await e.getAttribute('id');
      console.log(eid);
      await this.setValue(`//*[@id="${eid}"]`, eid);
    }
  }

  async setValue(key, val) {
    try {
      const elem = await this.driver.findElement({ xpath: key });
      if (!elem) {
        console.log('WARNING: element is not found.');
        return;
      }
      
      await elem.clear();
      await elem.sendKeys(val);
    } catch (e) {
      console.log(key, val, e.toString());
      console.log('%% Failed, please input manually.');
    }
  }

  async setValueList(key, val) {
    try {
      const elem = await this.driver.findElement({ xpath: key });
      if (!elem) {
        console.log('WARNING: element is not found.');
        return;
      }
      
      await elem.sendKeys(val);
      await elem.sendKeys(Key.RETURN);
    } catch (e) {
      console.log(key, val, e.toString());
      console.log('%% Failed, please input manually.');
    }
  }

  async checkButton(key) {
    try {
      const elem = await this.driver.findElement({ xpath: key });
      if (!elem) {
        console.log('WARNING: element is not found.');
        return;
      }
      
      await elem.click();
    } catch (e) {
      console.log(key, e.toString());
      console.log('%% Failed, please input manually.');
    }
  }

  async clickButton(key) {
    const actions = this.driver.actions({ async: true });
    const element = await this.driver.findElement({ id: key });
    await actions.click(element).perform();
  }

  getCountryCode(country) {
    if (country === 'UK') {
      return 'England';
    } else {
      return country;
    }
  }

  // Find two dates from the string
  getDateRange(dates) {
    const formatDate = (date) => {
      if (/\d\d?\/\d\d?\/20\d\d/.test(date)) {
        return date;
      } else {
        return `1/${date}`;
      }
    };
    
    const matches = dates.match(/(?:\d\d?\/)+20\d\d/g) || [];
    const now = new Date();
    const nowFormatted = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
    
    if (matches.length >= 2) {
      return [formatDate(matches[0]), formatDate(matches[1])];
    } else if (matches.length === 1) {
      return [formatDate(matches[0]), nowFormatted];
    } else {
      return [nowFormatted, nowFormatted];
    }
  }
}

module.exports = FormBase;
