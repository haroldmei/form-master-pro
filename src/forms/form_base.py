from selenium.webdriver.common.keys import Keys
from datetime import datetime
from selenium import webdriver

import re

class form_base:
    def __init__(self, _driver, _data, _mode):
        self.driver = _driver
        self.data = _data
        self.collect_mode = _mode
        self.entry_url = None

    def collect_info(self):
        print('collect page information.')
        elems = self.driver.find_elements("xpath", '//*[@id]')
        for e in elems:
            print(e.get_attribute('id'))
            eid = e.get_attribute('id')
            self.set_value(f'//*[@id="{eid}"]', eid)

    def set_value(self, key, val):
        try:
            elem = self.driver.find_element("xpath", key)
            if not elem:
                print('WARNING: element is not found.')
                return
            elem.clear()
            elem.send_keys(val)
        except Exception as e:
            print(key, val, str(e))
            print('%% Failed, please input manually.')

    def set_value_list(self, key, val):
        try:
            elem = self.driver.find_element("xpath", key)
            if not elem:
                print('WARNING: element is not found.')
                return
            elem.send_keys(val)
            elem.send_keys(Keys.RETURN)
        except Exception as e:
            print(key, val, str(e))
            print('%% Failed, please input manually.')

    def check_button(self, key):
        try:
            elem = self.driver.find_element("xpath", key)
            if not elem:
                print('WARNING: element is not found.')
                return
            elem.click()
        except Exception as e:
            print(key, str(e))
            print('%% Failed, please input manually.')

    def click_button(self, key):
        action = webdriver.ActionChains(self.driver)
        element = self.driver.find_element_by_id(key)
        #action.move_to_element(element)
        action.click(element)
        action.perform()

    def get_country_code(self, country):
        if country == 'UK':
            return 'England'
        else:
            return country
        
    # find two dates form the string
    def get_date_range(self, dates):
        def format_date(date):
            if re.search('\d\d?/\d\d?/20\d\d', date):
                return date
            else:
                return f"1/{date}"
            
        ss = re.findall('(?:\d\d?/)+20\d\d', dates)
        now = datetime.now()
        if len(ss) >= 2:
            return format_date(ss[0]), format_date(ss[1])
        elif len(ss) == 1:
            return format_date(ss[0]), now.strftime("%d/%m/%Y")
        elif len(ss) == 0:
            return now.strftime("%d/%m/%Y"), now.strftime("%d/%m/%Y")