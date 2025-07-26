/**
 * Media Tab Manager - Background Script
 * Manages cross-tab communication and media playback coordination
 */

// Global state to track active media tabs
let activeMediaTabs = new Map(); // tabId -> { url, title, mediaType, timestamp }
let currentPlayingTab = null;
let isExtensionEnabled = true; // Extension enabled by default

// Browser compatibility layer
const browserAPI = (function() {
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    return chrome;
  } else if (typeof browser !== 'undefined' && browser.runtime) {
    return browser;
  }
  return null;
})();

/**
 * Initialize extension when background script starts
 */
function initializeExtension() {
  console.log('Media Tab Manager: Background script initialized');
  
  // Clear any existing state
  activeMediaTabs.clear();
  currentPlayingTab = null;
  
  // Load extension settings
  loadExtensionSettings();
  
  // Set up message listeners
  setupMessageListeners();
  
  // Set up tab event listeners
  setupTabListeners();
}

/**
 * Load extension settings from storage
 */
async function loadExtensionSettings() {
  try {
    const result = await browserAPI.storage.local.get(['extensionEnabled']);
    isExtensionEnabled = result.extensionEnabled !== false; // Default to true
    console.log('Extension enabled:', isExtensionEnabled);
    updateBadge();
  } catch (error) {
    console.error('Failed to load extension settings:', error);
    isExtensionEnabled = true;
  }
}

/**
 * Set up message listeners for communication with content scripts
 */
function setupMessageListeners() {
  browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const tabId = sender.tab?.id;
    
    switch (message.type) {
      case 'MEDIA_STARTED':
        if (isExtensionEnabled) {
          handleMediaStarted(tabId, sender.tab, message.mediaInfo);
        }
        break;
        
      case 'MEDIA_PAUSED':
        handleMediaPaused(tabId);
        break;
        
      case 'MEDIA_ENDED':
        handleMediaEnded(tabId);
        break;
        
      case 'GET_ACTIVE_TABS':
        const state = getExtensionState();
        sendResponse(state);
        break;
        
      case 'PAUSE_TAB':
        pauseTabMedia(message.tabId);
        break;
        

        
      case 'EXTENSION_TOGGLE':
        handleExtensionToggle(message.enabled);
        break;
        
      default:
        console.warn('Unknown message type:', message.type);
    }
    
    // Return true to indicate async response handling
    return true;
  });
}

/**
 * Handle extension toggle
 */
async function handleExtensionToggle(enabled) {
  try {
    isExtensionEnabled = enabled;
    
    // Save to storage
    await browserAPI.storage.local.set({ extensionEnabled: enabled });
    
    console.log('Extension toggled:', enabled);
    
    // If disabled, clear current playing state but keep tracked tabs
    if (!enabled && currentPlayingTab) {
      currentPlayingTab = null;
    }
    
    // Update badge
    updateBadge();
    
    // Notify popup of state change
    notifyPopupStateChange();
    
  } catch (error) {
    console.error('Failed to handle extension toggle:', error);
  }
}

/**
 * Set up tab event listeners
 */
function setupTabListeners() {
  // Clean up when tab is closed
  browserAPI.tabs.onRemoved.addListener((tabId) => {
    if (activeMediaTabs.has(tabId)) {
      activeMediaTabs.delete(tabId);
      if (currentPlayingTab === tabId) {
        currentPlayingTab = null;
      }
      updateBadge();
      notifyPopupStateChange();
    }
  });
  
  // Clean up when tab is updated (e.g., navigation)
  browserAPI.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url && activeMediaTabs.has(tabId)) {
      // URL changed, likely navigated away from media content
      activeMediaTabs.delete(tabId);
      if (currentPlayingTab === tabId) {
        currentPlayingTab = null;
      }
      updateBadge();
      notifyPopupStateChange();
    }
  });
}

/**
 * Handle when media starts playing in a tab
 */
function handleMediaStarted(tabId, tab, mediaInfo) {
  console.log(`Media started in tab ${tabId}:`, mediaInfo);
  
  // If extension is disabled, don't manage media
  if (!isExtensionEnabled) {
    return;
  }
  
  // If there's already a playing tab, pause it
  if (currentPlayingTab && currentPlayingTab !== tabId) {
    pauseTabMedia(currentPlayingTab);
  }
  
  // Update the active media tabs
  activeMediaTabs.set(tabId, {
    url: tab.url,
    title: tab.title,
    mediaType: mediaInfo.type,
    timestamp: Date.now(),
    favicon: tab.favIconUrl
  });
  
  // Set this tab as the currently playing tab
  currentPlayingTab = tabId;
  
  // Update extension badge
  updateBadge();
  
  // Notify popup of state change
  notifyPopupStateChange();
}

/**
 * Handle when media is paused in a tab
 */
function handleMediaPaused(tabId) {
  console.log(`Media paused in tab ${tabId}`);
  
  if (currentPlayingTab === tabId) {
    currentPlayingTab = null;
  }
  
  updateBadge();
  
  // Notify popup of state change
  notifyPopupStateChange();
}

/**
 * Handle when media ends in a tab
 */
function handleMediaEnded(tabId) {
  console.log(`Media ended in tab ${tabId}`);
  
  activeMediaTabs.delete(tabId);
  
  if (currentPlayingTab === tabId) {
    currentPlayingTab = null;
  }
  
  updateBadge();
  
  // Notify popup of state change
  notifyPopupStateChange();
}

/**
 * Pause media in a specific tab
 */
function pauseTabMedia(tabId) {
  if (!tabId || !activeMediaTabs.has(tabId)) {
    return;
  }
  
  try {
    const result = browserAPI.tabs.sendMessage(tabId, {
      type: 'PAUSE_MEDIA'
    });
    
    // Handle both Chrome (returns Promise) and Firefox (may return undefined)
    if (result && typeof result.catch === 'function') {
      result.catch(error => {
        console.warn(`Failed to pause media in tab ${tabId}:`, error);
        // Tab might be closed or unresponsive, remove from active tabs
        activeMediaTabs.delete(tabId);
        if (currentPlayingTab === tabId) {
          currentPlayingTab = null;
        }
        updateBadge();
      });
    }
  } catch (error) {
    console.warn(`Failed to pause media in tab ${tabId}:`, error);
    // Tab might be closed or unresponsive, remove from active tabs
    activeMediaTabs.delete(tabId);
    if (currentPlayingTab === tabId) {
      currentPlayingTab = null;
    }
    updateBadge();
  }
}



/**
 * Update extension badge to show number of active media tabs
 */
function updateBadge() {
  const activeCount = activeMediaTabs.size;
  const badgeText = activeCount > 0 ? activeCount.toString() : '';
  const badgeColor = !isExtensionEnabled ? '#9CA3AF' : (currentPlayingTab ? '#10B981' : '#6B7280');
  
  try {
    if (browserAPI.action) {
      // Chrome Manifest V3
      browserAPI.action.setBadgeText({ text: badgeText });
      browserAPI.action.setBadgeBackgroundColor({ color: badgeColor });
    } else if (browserAPI.browserAction) {
      // Firefox/Chrome Manifest V2
      browserAPI.browserAction.setBadgeText({ text: badgeText });
      browserAPI.browserAction.setBadgeBackgroundColor({ color: badgeColor });
    }
  } catch (error) {
    console.warn('Failed to update badge:', error);
  }
}

/**
 * Get current extension state (for popup)
 */
function getExtensionState() {
  return {
    activeTabs: Array.from(activeMediaTabs.entries()).map(([tabId, info]) => ({
      tabId,
      ...info,
      isPlaying: tabId === currentPlayingTab
    })),
    currentPlaying: currentPlayingTab,
    totalTabs: activeMediaTabs.size,
    extensionEnabled: isExtensionEnabled
  };
}

/**
 * Notify popup of media state changes
 */
function notifyPopupStateChange() {
  // Try to send message to popup (if it's open)
  try {
    browserAPI.runtime.sendMessage({
      type: 'MEDIA_STATE_CHANGED'
    }).catch(() => {
      // Popup is not open, ignore the error
    });
  } catch (error) {
    // Popup is not open or other error, ignore
  }
}

// Initialize when background script loads
initializeExtension();

// Export for testing purposes (if needed)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    handleMediaStarted,
    handleMediaPaused,
    handleMediaEnded,
    pauseTabMedia,
    getExtensionState
  };
} 