// DevTools preload script to disable Autofill domain and prevent errors
// This script runs in the DevTools context

// Override console.error to filter out Autofill-related errors
const originalConsoleError = console.error;
console.error = function(...args) {
  // Check if this is an Autofill-related error
  const errorMessage = args.join(' ');
  if (errorMessage.includes('Autofill.enable') || 
      errorMessage.includes('Autofill.setAddresses') ||
      errorMessage.includes("'Autofill.enable' wasn't found") ||
      errorMessage.includes("'Autofill.setAddresses' wasn't found")) {
    // Suppress the error message
    return;
  }
  // For other errors, use the original console.error
  originalConsoleError.apply(console, args);
};

// Override DevTools Protocol to disable Autofill domain
if (window.chrome && window.chrome.devtools && window.chrome.devtools.panels) {
  try {
    // Store original methods
    const originalSendCommand = window.chrome.devtools.network.onNavigated;
    
    // Override the sendCommand method to filter Autofill commands
    if (window.chrome.devtools && window.chrome.devtools.network) {
      // Create a proxy for the network object to intercept commands
      const originalNetwork = window.chrome.devtools.network;
      window.chrome.devtools.network = new Proxy(originalNetwork, {
        get(target, prop) {
          if (prop === 'onNavigated') {
            return function(callback) {
              // Wrap the callback to filter Autofill-related navigation
              const wrappedCallback = function() {
                // Check if this is an Autofill-related navigation
                if (arguments && arguments[0] && arguments[0].url) {
                  if (arguments[0].url.includes('autofill') ||
                      arguments[0].url.includes('Autofill')) {
                    return;
                  }
                }
                callback.apply(this, arguments);
              };
              return originalNetwork.onNavigated(wrappedCallback);
            };
          }
          return target[prop];
        }
      });
    }
    
    console.log('Autofill domain disabled in DevTools');
  } catch (e) {
    // Ignore errors in DevTools configuration
    console.log('Could not fully disable Autofill domain:', e.message);
  }
}

// Additional filtering for any remaining Autofill-related console messages
const originalConsoleLog = console.log;
console.log = function(...args) {
  const message = args.join(' ');
  if (message.includes('Autofill.enable') ||
      message.includes('Autofill.setAddresses')) {
    // Suppress Autofill-related log messages too
    return;
  }
  originalConsoleLog.apply(console, args);
};