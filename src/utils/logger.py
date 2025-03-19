import logging
import os
from datetime import datetime

def get_logger(name=None):
    """
    Get or create a logger with the specified name.
    If name is None, returns the root logger.
    
    This ensures all modules use the same logging configuration.
    """
    global _logging_initialized
    
    # Check if we've already initialized logging
    if not getattr(get_logger, "_logging_initialized", False):
        # Create a timestamp for the log filename
        timestamp = datetime.now().strftime("%y_%m_%d_%H_%M_%S")
        log_filename = f"formmaster_{timestamp}.log"
        
        # Store logs in user's .formmaster directory
        log_dir = os.path.join(os.environ.get('USERPROFILE', os.environ.get('HOME', '')), '.formmaster')
        
        # Create directory if it doesn't exist
        if not os.path.exists(log_dir):
            os.makedirs(log_dir, exist_ok=True)
            
        log_path = os.path.join(log_dir, log_filename)
        
        # Configure root logger
        root_logger = logging.getLogger()
        root_logger.setLevel(logging.INFO)
        
        # Create formatter
        formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        
        # File handler with UTF-8 encoding
        file_handler = logging.FileHandler(log_path, encoding='utf-8')
        file_handler.setFormatter(formatter)
        root_logger.addHandler(file_handler)
        
        # Console handler
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(formatter)
        root_logger.addHandler(console_handler)
        
        # Mark logging as initialized
        get_logger._logging_initialized = True
        
        # Log that initialization is complete
        logging.getLogger('formmaster').info(f"Logging initialized. Log file: {log_path}")
    
    # Return the requested logger
    return logging.getLogger(name or 'formmaster')