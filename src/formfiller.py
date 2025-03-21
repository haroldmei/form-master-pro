"""
FormMaster - Automated form filling for university applications
"""
import os
import argparse
import subprocess
import socket
import time
import sys
from threading import Lock
from pathlib import Path

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import WebDriverException, NoSuchWindowException
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver import Firefox, FirefoxOptions
from pynput.mouse import Listener as MouseListener

from files.docxv1 import load
from forms.mod1 import mod1
from utils.logger import get_logger

# Global variables
lock = Lock()
IS_WINDOWS = os.name == 'nt'
driver = None
module = None
run_mode = 0
logger = get_logger('formfiller')

def setup_browser():
    """Initialize and setup the browser"""
    global driver
    
    if IS_WINDOWS:
        # Try to connect to an existing Chrome instance or start a new one
        if not connect_to_chrome_instance():
            start_chrome_instance()
        
        # Setup Chrome with debugging options
        chrome_options = Options()
        chrome_options.add_experimental_option("debuggerAddress", "127.0.0.1:9222")
        
        # Try to use local ChromeDriver if available
        user_profile = os.environ.get('USERPROFILE', '')
        local_driver_path = os.path.join(user_profile, '.formmaster', 'chromedriver.exe')
        
        if os.path.exists(local_driver_path):
            logger.info(f"Using local ChromeDriver at {local_driver_path}")
            service = Service(executable_path=local_driver_path)
            driver = webdriver.Chrome(service=service, options=chrome_options)
        else:
            logger.info("Using ChromeDriverManager")
            driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), 
                                     options=chrome_options)
    else:
        # Firefox setup for non-Windows platforms
        options = FirefoxOptions()
        options.set_preference("network.protocol-handler.external-default", False)
        options.set_preference("network.protocol-handler.expose-all", True)
        options.set_preference("network.protocol-handler.warn-external-default", False)
        driver = Firefox(options=options)

def connect_to_chrome_instance():
    """Try to connect to an existing Chrome instance on port 9222"""
    server_address = ('127.0.0.1', 9222)
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        sock.connect(server_address)
        logger.info("Connected to existing Chrome instance")
        return True
    except:
        return False
    finally:
        sock.close()

def start_chrome_instance():
    """Start a new Chrome instance with remote debugging enabled"""
    logger.info('Starting new Chrome browser instance...')
    
    # Find Chrome executable
    chrome_paths = []
    
    if IS_WINDOWS:
        for basedir in ['ProgramFiles', 'ProgramFiles(x86)', 'LocalAppData']:
            if basedir in os.environ:
                path = f"{os.environ[basedir]}\\Google\\Chrome\\Application\\chrome.exe"
                chrome_paths.append(path)
    else:
        chrome_paths.append('/opt/google/chrome/chrome')
    
    # Try each path until we find a valid Chrome executable
    for chrome in chrome_paths:
        if os.path.isfile(chrome):
            profile_dir = os.path.join(
                os.environ['LocalAppData'] if IS_WINDOWS else os.environ['HOME'],
                'selenium', 'ChromeProfile'
            )
            
            # Ensure profile directory exists
            Path(profile_dir).mkdir(parents=True, exist_ok=True)
            
            cmd = [chrome, '--remote-debugging-port=9222', f'--user-data-dir={profile_dir}']
            logger.info(f'Starting browser: {cmd}')
            subprocess.Popen(cmd)
            
            # Give browser time to start
            time.sleep(2)
            return
    
    logger.error("Could not find Chrome browser executable")
    sys.exit(1)

def is_browser_alive():
    """Check if browser is still open and responsive"""
    if not driver:
        return False
        
    try:
        # Attempt to access a property that requires the browser to be open
        driver.current_window_handle
        return True
    except (NoSuchWindowException, WebDriverException):
        try:
            driver.window_handles
            if len(driver.window_handles) > 0:
                driver.switch_to.window(driver.window_handles[-1])
                logger.info('Switching to latest window/tab')
                return True
            else:
                logger.info("Browser was closed by user or crashed")
                return False
        except:
            logger.info("Browser was closed by user or crashed")
            return False

def on_click(x, y, button, pressed):
    """Handle mouse click events"""
    global driver, module
    
    # Only process release events
    if pressed:
        return
    
    # Check if browser is still alive
    if not is_browser_alive():
        logger.warning("Browser closed, exiting application")
        os._exit(0)  # Force exit since we're in a threaded context
    
    try:
        with lock:
            if button.name == 'middle':
                # Middle click triggers module run
                module.run()
                return
            elif button.name == 'left':
                # Left click ensures we're on the most recent window/tab
                try:
                    wait = WebDriverWait(driver, 3)
                    wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
                    
                    if driver.window_handles[-1] != driver.current_window_handle:
                        logger.info('Switching to latest window/tab')
                        driver.switch_to.window(driver.window_handles[-1])
                except Exception as e:
                    logger.debug(f"Window switching error (non-critical): {e}")
                return
    except Exception as e:
        logger.error(f"Error in on_click: {str(e)}")
        
        # Try to recover by switching to last window handle
        try:
            if len(driver.window_handles) > 0:
                driver.switch_to.window(driver.window_handles[-1])
            else:
                logger.critical("No browser windows available, exiting")
                os._exit(1)
        except:
            logger.critical("Fatal error in mouse handler, exiting")
            os._exit(1)

def run(data_dir, mode=0):
    """Main execution function"""
    global module, driver, run_mode
    
    run_mode = mode
    
    # Set up the browser
    setup_browser()
    
    # Load student data if in normal mode
    students = []
    if not run_mode:
        logger.info(f"Loading student data from {data_dir}")
        students = load(data_dir)
        logger.info(f"Loaded {len(students)} student records")

    # Initialize the appropriate module
    logger.info("Initializing Sydney University module")
    module = mod1(driver, students, run_mode)

    # Login and initiate the session
    main_application_handle = module.login_session()

    try:
        # Start mouse listener
        logger.info("Starting mouse listener")
        mouse_listener = MouseListener(on_click=on_click)
        mouse_listener.start()

        # Main event loop
        logger.info("Running main loop - waiting for events")
        while is_browser_alive():
            time.sleep(5)
            
        logger.info("Browser closed, exiting application")
        
    except KeyboardInterrupt:
        logger.info("Application interrupted by user")
    except Exception as e:
        logger.exception("Unhandled exception in main loop")
    finally:
        # Clean up
        logger.info("Stopping mouse listener")
        if 'mouse_listener' in locals():
            mouse_listener.stop()

def parse_arguments():
    """Parse command line arguments"""
    default_data_dir = 'C:\\work\\data\\13. 懿心ONE Bonnie' if IS_WINDOWS else '/home/hmei/data/13. 懿心ONE Bonnie'
    
    parser = argparse.ArgumentParser(description='FormMaster - Automate form filling for university applications.')
    
    parser.add_argument('--dir', type=str, 
                      default=default_data_dir,
                      help='Directory containing student data')
    
    parser.add_argument('--mode', type=int, default=0,
                      help='Operation mode (0 for normal operation)')
    
    return parser.parse_args()

if __name__ == '__main__':
    args = parse_arguments()
    run(data_dir=args.dir, mode=args.mode)
