### activeTab:
My extension uses `chrome.scripting.executeScript` to inject scripts into the active tab (e.g., for form analysis and filling). This functionality requires the `activeTab` permission is also used to decide whether or not the extension can be activated to provide better user experience for my extension.

### host_permissions:
The main feature of my extension is to interact with web pages to carry out tasks like form analysis and form filling. host_permissions is required for this purpose other wise the extension would be useless.

### storage:
My extension makes use of chrome.storage to save user's content that will be used in multiple pages in the form filling process, it also makes use of storages to collect the form structure to be used to map content. The 'storage' permission is required for my extension.

### scripting
My extension uses `chrome.scripting.executeScript` for injecting scripts, which requires the `scripting` permission. Removing it would break features like form analysis and filling, which rely on dynamic script injection.

### remote code
Remote code is used to integrate ai backend end, manage user subscription and plans, and provide users feature enhancements as the system matures. More importantly, the remote code is essential to provide customers improved user experience in that there will be no tedious configurations needed for customers on their end.

### webNavigation
My extension is currently using chrome.webNavigation API to manage document content and form field mapping, which will be a new tab page listing all information for user's review. It's essential for an improved user experience, hence the webNavigation permission is needed.

### identity
My extension needs to authenticate users and manage user's subscription, which will use google account social authentication. The `identity` permission is hence needed to manage users and in the future provide ways add support for different subscription types.
