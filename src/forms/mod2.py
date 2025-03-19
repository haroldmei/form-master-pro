from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By

from .base import form_base
from getpass import getpass

import os
import re
import time
import winreg

class mod2(form_base):
    
    def __init__(self, _driver, _data, _mode):
        super(mod2, self).__init__(_driver, _data, _mode)
        self.manage_applications_url = None
        self.main_application_handle = None
        self.entry_url = 'https://applyonline.unsw.edu.au/agent-login'

    def create_profile(self):
        pass

    def login_session(self):
        students = self.data
        driver = self.driver
        
        if not re.search('https://applyonline.unsw.edu.au/agent/homepage', driver.current_url):
            # Define environment variable names for credentials
            username_var = "FORMMASTER_UNSW_USERNAME"
            password_var = "FORMMASTER_UNSW_PASSWORD"
            
            # First try to get credentials from current process environment
            username = os.environ.get(username_var)
            password = os.environ.get(password_var)
            
            # If not found in current environment, try reading from registry
            if not username or not password:
                try:
                    key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Environment")
                    try:
                        username = winreg.QueryValueEx(key, username_var)[0]
                        password = winreg.QueryValueEx(key, password_var)[0]
                        
                        # Set in current process environment for future use
                        if username and password:
                            os.environ[username_var] = username
                            os.environ[password_var] = password
                    except WindowsError:
                        pass
                    winreg.CloseKey(key)
                except WindowsError:
                    pass
            
            # If still not found, prompt user and store
            if not username or not password:
                print("First-time login: Credentials will be stored in user environment variables")
                username = input('Username: ')
                password = getpass()
                
                # Store in current process environment
                os.environ[username_var] = username
                os.environ[password_var] = password
                
                # Store in Windows registry under current user (User Variables)
                try:
                    key = winreg.CreateKeyEx(
                        winreg.HKEY_CURRENT_USER, 
                        r"Environment", 
                        0, 
                        winreg.KEY_WRITE
                    )
                    winreg.SetValueEx(key, username_var, 0, winreg.REG_SZ, username)
                    winreg.SetValueEx(key, password_var, 0, winreg.REG_SZ, password)
                    winreg.CloseKey(key)
                    print("Credentials stored successfully in user environment variables")
                    
                    # Broadcast WM_SETTINGCHANGE to notify all windows of environment change
                    print("Note: You may need to restart the application for the changes to take effect")
                except Exception as e:
                    print(f"Could not store credentials permanently: {e}")
                    print("Credentials will be available only for this session.")
            
            # Use the credentials for login
            driver.get(self.entry_url)

            wait = WebDriverWait(driver, 100)
            wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))

            self.check_button('//*[@id="login"]/div/form/div[1]/span/span[1]/span/span[2]')
            self.set_value_list('/html/body/span/span/span[1]/input', 'Shinyway Sydney')
            self.set_value('//*[@id="_email"]', username)
            self.set_value('//*[@id="_password"]', password)
            self.check_button('//*[@id="login"]/div/form/p[1]/input')
            self.check_button('//*[@id="loginButtonAgent"]')

        print('\n\n ================ personal info ================= \n', students[-1][3])
        print('\n\n ================= edu info: ================= \n', students[-1][1])
        print('\n\n ================= application info: ================= \n', students[-1][2])
        return self.main_application_handle
    
    def fill_personal_info(self):
        personal_info = self.data[-1][0]
        self.check_button('//*[@id="collapse1"]/div[1]/div[3]/div/div[2]/span/span[1]/span/span[2]/b')
        self.set_value_list('/html/body/span/span/span[1]/input', 'Mr' if personal_info['Gender'] == 'Male' else 'Miss')
        time.sleep(0.5)

        self.set_value('//*[@id="form_firstname"]', personal_info['Given Name'])
        self.set_value('//*[@id="form_familyname"]', personal_info['Family Name'])
        self.check_button('//*[@id="form_changedname_1"]')
        
        # Identity
        self.check_button('/html/body/div[1]/div[2]/div[1]/div/form/div[1]/div[2]/div[1]/h4/a/i')
        time.sleep(1)
        
        dd,mm,yyyy = personal_info['DOB (dd/mm/yyyy)'].split('/')
        self.check_button('//*[@id="collapse2"]/div[1]/div[3]/div/div[2]/div/span/span[1]/span/span[2]/b')
        self.set_value_list('/html/body/span/span/span[1]/input', dd)
        time.sleep(0.5)

        months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        self.check_button('//*[@id="collapse2"]/div[1]/div[3]/div/div[3]/div/span/span[1]/span/span[2]/b')
        self.set_value_list('/html/body/span/span/span[1]/input', months[int(mm) - 1])
        time.sleep(0.5)

        self.check_button('//*[@id="collapse2"]/div[1]/div[3]/div/div[4]/div/span/span[1]/span/span[2]/b')
        self.set_value_list('/html/body/span/span/span[1]/input', yyyy)
        time.sleep(0.5)

        self.check_button('//*[@id="form_iamcitizen_3"]')
        
        # country of citizenship
        self.check_button('//*[@id="collapse2"]/div[3]/div[1]/div/div[2]/span/span[1]/span/span[2]/b')
        self.set_value_list('/html/body/span/span/span[1]/input', 'China')

        self.check_button('/html/body/div[1]/div[2]/div[1]/div/form/div[1]/div[2]/div[2]/div[6]/div[1]/div/div[2]/span/span[1]/span/span[2]/b')
        self.set_value_list('/html/body/span/span/span[1]/input', personal_info['Gender'])

        self.check_button('//*[@id="form_visawillyou_0"]')
        self.check_button('//*[@id="form_visadoyou_0"]')

        # type of visa
        # Australian visa you currently hold which allows you to study at UNSW? *
        self.check_button('/html/body/div[1]/div[2]/div[1]/div/form/div[1]/div[2]/div[2]/div[7]/div[3]/div[3]/div[1]/div/div[2]/span/span[1]/span/span[2]/b')
        self.set_value_list('/html/body/span/span/span[1]/input', 'Student')

        time.sleep(0.5)

        # contact details
        self.check_button('/html/body/div[1]/div[2]/div[1]/div/form/div[1]/div[3]/div[1]/h4/a/i')
        time.sleep(0.5)
        
        self.set_value('//*[@id="form_email_applicant"]', personal_info["Student's Email"])
        self.set_value('//*[@id="form_mobilephone"]', personal_info["Student's Tel."])
        #self.check_button('/html/body/div[1]/div[2]/div[1]/div/form/div[1]/div[3]/div[1]/h4/a/i')
        time.sleep(0.5)

        # home details
        self.check_button('/html/body/div[1]/div[2]/div[1]/div/form/div[1]/div[4]/div[1]/h4/a/i')
        time.sleep(0.5)
        self.check_button('/html/body/div[1]/div[2]/div[1]/div/form/div[1]/div[4]/div[2]/div[1]/div[1]/div[4]/div/div[2]/span/span[1]/span/span[2]/b')
        self.set_value_list('/html/body/span/span/span[1]/input', 'China')

        self.set_value('//*[@id="form_residentialaddressstreetaddress1"]', f"{personal_info['line1']} {personal_info['line2']}")
        self.set_value('//*[@id="form_residentialaddressstreetaddress2"]', personal_info['line3'])
        self.set_value('//*[@id="form_residentialaddressstreetaddress3"]', personal_info['province'])
        self.set_value('//*[@id="form_residentialaddressintlstate"]', personal_info['city'])
        self.check_button('//*[@id="form_sameaddress_0"]')

        self.check_button('/html/body/div[1]/div[2]/div[1]/div/form/div[1]/div[5]/div[1]/h4/a/i')
        time.sleep(0.5)
        self.check_button('//*[@id="form_previousrecordquestion_1"]')

    def fill_scholarships(self):
        pass
    
    def fill_your_qualifications(self):
        self.check_button('/html/body/div[1]/div[2]/div[1]/div/form/div[1]/div[2]/div[1]/div/div[2]/div[1]/div[2]/label')
        self.check_button('/html/body/div[1]/div[2]/div[1]/div/form/div[1]/div[3]/div[1]/div/div[2]/div[1]/div[2]/label')
        self.check_button('/html/body/div[1]/div[2]/div[1]/div/form/div[1]/div[4]/div[1]/div/div[2]/div[1]/div[2]/label')
        self.check_button('/html/body/div[1]/div[2]/div[1]/div/form/div[1]/div[5]/div[1]/div/div[2]/div[1]/div[2]/label')
        self.check_button('/html/body/div[1]/div[2]/div[1]/div/form/div[1]/div[6]/div[1]/div/div[2]/div[1]/div[2]/label')
    
    def other_qualifications(self):
        self.check_button('/html/body/div[1]/div[2]/div[1]/div/form/div[1]/div[2]/div[1]/h4/a')
        time.sleep(0.5)
        
        self.check_button('/html/body/div[1]/div[2]/div[1]/div/form/div[1]/div[2]/div[2]/div/div[1]/div[3]/div/div[2]/div[1]/div[2]/label')
        self.check_button('/html/body/div[1]/div[2]/div[1]/div/form/div[1]/div[2]/div[2]/div/div[2]/div[1]/div/div[2]/div[1]/div[2]/label')
        self.check_button('/html/body/div[1]/div[2]/div[1]/div/form/div[1]/div[2]/div[2]/div/div[3]/div[1]/div/div[2]/div[1]/div[2]/label')

    def fill_further_references(self):
        pass

    def fill_form(self):        
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
        course_applied = df_application[df_application['Proposed School'] == 'UNSW']['Proposed Course with Corresponding Links'].tolist()[0]
        course = '//*[@id="form_programcode"]'
        self.set_value(course, course_applied)
        #view_report = '/html/body/div[1]/form/div[3]/div/div/div[2]/div[3]/div/input[2]'
        #driver.find_element("xpath", view_report).click()
        return

    def start_application(self, df_application):
        print('start application: \n', df_application)
        if 'Bachelor' in df_application['Proposed Course with Corresponding Links']:
            self.click_button('//*[@id="startApplicationUGRD"]')
        elif 'Rearch' in df_application['Proposed Course with Corresponding Links']:
            self.click_button('//*[@id="startApplicationRSCH"]')
        elif 'Master' in df_application['Proposed Course with Corresponding Links']:
            self.click_button('//*[@id="startApplicationPGRD"]')
        else:
            pass

    def run(self):
        if self.collect_mode:
            self.collect_info()
            return
        
        students = self.data
        if not len(students):
            print('no more studnets to process.')
            return

        wait = WebDriverWait(self.driver, 10)
        wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
        url = self.driver.current_url
    
        df_application = students[-1][2]
        df_application = df_application[df_application['Proposed School'] == 'UNSW']
        if re.search('https://applyonline.unsw.edu.au/agent/homepage$', url):
            if df_application.shape[0] == 0:
                print(f'NSW is not supported for {students[-1][0]["Given Name"]}')
                return
            else:
                self.start_application(df_application)
        elif re.search('https://applyonline.unsw.edu.au/personal$', url):
            self.fill_personal_info()

        elif re.search('https://applyonline.unsw.edu.au/application$', url):
            self.search_course()
        
        elif re.search('https://applyonline.unsw.edu.au/sponsorship$', url):
            pass

        elif re.search('https://applyonline.unsw.edu.au/qualification/$', url):
            self.fill_your_qualifications()

        elif re.search('https://applyonline.unsw.edu.au/otherqualifications', url):
            self.other_qualifications()

        else:
            print('url has no action: ', url)
            pass