from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By

from .form_base import form_base
from getpass import getpass

import sys
import re
import time

from forms.form_extract import extract_and_save_form_controls

class mod1(form_base):
    
    def __init__(self, _driver, _data, _mode):
        super(mod1, self).__init__(_driver, _data, _mode)
        self.manage_applications_url = None
        self.main_application_handle = None
        self.entry_url = 'https://sydneystudent.sydney.edu.au/sitsvision/wrd/siw_lgn'

    def create_profile(self):
        CreateProfileForm(self.driver, self.data).run()

    def login_session(self):
        """
        Logs in to the application and returns the main window handle
        """
        try:
            driver = self.driver
            
            # Set a max retry count
            max_retries = 3
            current_try = 0
            
            while current_try < max_retries:
                try:
                    driver.get(self.entry_url)
                    
                    # Ensure the browser is still open after navigation
                    if not driver.window_handles:
                        raise Exception("Browser window was closed")
                    
                    # Set explicit wait
                    wait = WebDriverWait(driver, 30)
                    
                    # Wait for page to load
                    wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
                    
                    # Store the main window handle
                    main_window = driver.current_window_handle
                    # LoginForm(driver, self.data).run()

                    if not self.collect_mode:
                        print('\n\n ================ personal info ================= \n', self.data[-1][3])
                        print('\n\n ================= edu info: ================= \n', self.data[-1][1])
                        print('\n\n ================= application info: ================= \n', self.data[-1][2])
                    return main_window
                    
                except Exception as e:
                    current_try += 1
                    print(f"Login attempt {current_try} failed: {str(e)}")
                    
                    if current_try >= max_retries:
                        raise
                    
                    # If browser was closed, reinitialize it
                    if "no such window" in str(e).lower() or not driver.window_handles:
                        print("Browser window was closed. Reinitializing...")
                        self.initialize_driver()
                        driver = self.driver
                    
                    # Wait before retrying
                    time.sleep(2)
        
        except Exception as e:
            print(f"Fatal error in login_session: {str(e)}")
            # Ensure the browser is closed on error
            try:
                driver.quit()
            except:
                pass
            raise

        self.manage_applications_url = driver.current_url
        self.main_application_handle = driver.current_window_handle
        
        if not self.collect_mode:
            print('\n\n ================ personal info ================= \n', self.data[-1][3])
            print('\n\n ================= edu info: ================= \n', self.data[-1][1])
            print('\n\n ================= application info: ================= \n', self.data[-1][2])

        return self.main_application_handle

    def fill_form(self):
        driver = self.driver
        
        return True

    def new_application(self):
        driver = self.driver
        students = self.data

        driver.close()
        driver.switch_to.window(self.main_application_handle)
        driver.get(self.manage_applications_url)
        students.pop()
        if not len(students):
            print('Congrats, you finished processing. ')
            return False

        print('Now processing: ', students[-1][0])
        return True

    def search_course(self):
        students = self.data

        df_application = students[-1][2]
        df_application = df_application[df_application['Proposed School'] == 'USYD']
        course_applied = df_application['Proposed Course with Corresponding Links'].tolist()[0]
        if df_application.shape[0] > 1:
            df_application = df_application.drop(index=[0])
            new_item = students[-1].copy()
            new_item[0]['Number'] += 1
            new_item[2] = df_application
            students.insert(0, new_item)
            
        course = '//*[contains(@id,"POP_UDEF") and contains(@id,"POP.MENSYS.1-1")]'
        self.set_value(course, course_applied)

        return

    def payment_email(self):
        email = '//*[@id="UDS_EMAIL"]'
        self.set_value(email, 'au.info@shinyway.com')

    def payment_method(self):
        #cardnumber = '//*[@id="UDS_CARDNUMBER"]'
        cardnumber = '/html/body/form/fieldset/ul/li[1]/div[2]/input'
        month = '/html/body/form/fieldset/ul/li[2]/div[2]/input[1]'
        year = '/html/body/form/fieldset/ul/li[2]/div[2]/input[2]'
        self.set_value(cardnumber, '123456789')
        self.set_value(month, '09')
        self.set_value(year, '25')

    def run(self):
        if self.collect_mode:
            print('collect page information.')
            return

        students = self.data
        if not len(students):
            print('no more studnets to process.')
            sys.exit()
        
        wait = WebDriverWait(self.driver, 10)
        wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
        url = self.driver.current_url

        if re.search('https://sydneystudent.sydney.edu.au/sitsvision/wrd/siw_ipp_cgi.start?', url):
            if not self.fill_form():
                sys.exit()

        elif re.search('https://sydneystudent.sydney.edu.au/sitsvision/wrd/SIW_POD.start_url?.+', url):
            self.search_course()

        # create profile
        elif re.search('https://sydneystudent.sydney.edu.au/sitsvision/wrd/SIW_YMHD.start_url?.+', url):
            self.create_profile()

        # email payment
        elif re.search('https://pay.sydney.edu.au/ePays/paymentemail\?UDS_ACTION=PMPBPN', url):
            self.payment_email()
            
        elif re.search('https://pay.sydney.edu.au/ePays/paymentemail$', url):
            self.payment_method()

        else:
            print('no actions for: ', url)
            pass

