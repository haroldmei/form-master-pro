activeTab
FormMaster Pro uses chrome.scripting.executeScript to inject scripts into the active tab for analyzing and filling forms. The activeTab permission allows the extension to run only when needed, ensuring a seamless user experience without unnecessary background activity.

host_permissions
This extension interacts with web pages to analyze and fill forms dynamically. The host_permissions permission is essential for enabling these core functionalities, as the extension needs access to form structures on different websites. Without this permission, the extension would not function as intended.

storage
FormMaster Pro utilizes chrome.storage to securely store user-auth status data needed for form filling across multiple pages. It also saves form structures for accurate data mapping. The storage permission is required to maintain user preferences and streamline the form-filling process.

scripting
The extension injects scripts using chrome.scripting.executeScript to analyze forms and autofill fields in real time. The scripting permission is necessary to execute these functions dynamically and provide an automated experience. Removing it would break essential features.

remote code
Remote code execution is required to integrate with the AI-powered backend, manage user subscriptions, and enable advanced features as the extension evolves. This eliminates the need for complex user configurations, ensuring a smooth and hassle-free experience.

webNavigation
FormMaster Pro uses the chrome.webNavigation API to track page loading events and manage form field mapping. This enables features like a summary page where users can review form data before submission, enhancing usability and accuracy.

identity
To authenticate users and manage subscriptions, FormMaster Pro supports Google account-based login. The identity permission allows secure user authentication and future support for multiple subscription tiers.

