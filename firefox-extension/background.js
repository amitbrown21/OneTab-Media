/**
 * UME - Ultimate Media Extention - Background Script
 * Manages extension state, settings, and communication between components
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

// Default settings - must match options.js
const defaultSettings = {
  extensionEnabled: true,
  enabled: true, // Legacy compatibility
  showController: true,
  startHidden: false,
  rememberSpeed: false,
  forceLastSavedSpeed: false, // Always apply last saved speed to new videos
  audioBoolean: false,
  controllerOpacity: 0.3,
  speed: 1.0, // Default speed for videos
  displayKeyCode: 86, // V key for display toggle
  keyBindings: [
    { action: 'display', key: 86, value: 0, force: false, predefined: true }, // V
    { action: 'slower', key: 83, value: 0.1, force: false, predefined: true }, // S
    { action: 'faster', key: 68, value: 0.1, force: false, predefined: true }, // D
    { action: 'rewind', key: 90, value: 10, force: false, predefined: true }, // Z
    { action: 'advance', key: 88, value: 10, force: false, predefined: true }, // X
    { action: 'reset', key: 82, value: 1.0, force: false, predefined: true }, // R
    { action: 'fast', key: 71, value: 1.8, force: false, predefined: true } // G
  ],
  blacklist: `www.instagram.com
twitter.com
imgur.com
teams.microsoft.com`.replace(/^[\r\t\f\v ]+|[\r\t\f\v ]+$/gm, '')
};

/**
 * Initialize extension when background script starts
 */
async function initializeExtension() {
  // Log startup
  console.log('UME - Ultimate Media Extention: Background script started');
  
  // Clear any existing state
  activeMediaTabs.clear();
  currentPlayingTab = null;
  
  // Ensure default settings are applied
  await ensureDefaultSettings();
  
  // Load extension settings
  await loadExtensionSettings();
  
  // Set up message listeners
  setupMessageListeners();
  
  // Set up tab event listeners
  setupTabListeners();

  // Log initialization complete
  console.log('UME - Ultimate Media Extention: Initialization complete');
}

/**
 * Ensure default settings are properly set on extension startup
 */
async function ensureDefaultSettings() {
  try {
    // Ensure defaultSettings exists and is an object
    if (!defaultSettings || typeof defaultSettings !== 'object') {
      console.error('OneTab Media: defaultSettings is not properly defined');
      return;
    }

    const settingsKeys = Object.keys(defaultSettings);
    if (settingsKeys.length === 0) {
      console.error('OneTab Media: defaultSettings is empty');
      return;
    }

    const result = await browserAPI.storage.sync.get(settingsKeys);
    
    // Handle case where result is undefined or null
    const safeResult = result || {};
    
    // Check if this is a fresh install (no settings exist)
    const isFreshInstall = Object.keys(safeResult).length === 0;
    
    if (isFreshInstall) {
      console.log('OneTab Media: Setting up defaults for fresh install');
      await browserAPI.storage.sync.set(defaultSettings);
      console.log('OneTab Media: Default settings applied successfully');
    } else {
      // Ensure any missing settings are set to defaults
      const updates = {};
      for (const [key, defaultValue] of Object.entries(defaultSettings)) {
        if (safeResult[key] === undefined) {
          updates[key] = defaultValue;
        }
      }
      
      if (Object.keys(updates).length > 0) {
        console.log('OneTab Media: Adding missing default settings:', updates);
        await browserAPI.storage.sync.set(updates);
      }
    }
    
    // Migrate extensionEnabled to sync storage if it exists in local storage
    try {
      const localResult = await browserAPI.storage.local.get(['extensionEnabled']);
      const safeLocalResult = localResult || {};
      if (safeLocalResult.extensionEnabled !== undefined && safeResult.extensionEnabled === undefined) {
        await browserAPI.storage.sync.set({ extensionEnabled: safeLocalResult.extensionEnabled });
        console.log('OneTab Media: Migrated extensionEnabled setting to sync storage');
      }
    } catch (migrationError) {
      console.warn('OneTab Media: Failed to migrate extensionEnabled setting:', migrationError);
    }
    
  } catch (error) {
    console.error('UME - Ultimate Media Extention: Failed to ensure default settings:', error);
  }
}

/**
 * Load extension settings from storage
 */
async function loadExtensionSettings() {
  try {
    // First try sync storage, then fall back to local storage
    let result = await browserAPI.storage.sync.get(['extensionEnabled']);
    let safeResult = result || {};
    
    if (safeResult.extensionEnabled === undefined) {
      result = await browserAPI.storage.local.get(['extensionEnabled']);
      safeResult = result || {};
    }
    
    // Handle case where result is undefined or doesn't have the property
    isExtensionEnabled = safeResult.extensionEnabled === false ? false : true; // Default to true
    console.log('OneTab Media: Extension enabled:', isExtensionEnabled);
    updateBadge();
  } catch (error) {
    console.error('UME - Ultimate Media Extention: Failed to load extension settings:', error);
    isExtensionEnabled = true;
    updateBadge();
  }
}

/**
 * Set up message listeners for communication with content scripts and popup
 */
function setupMessageListeners() {
  browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const tabId = sender.tab?.id;
    
    // Handle synchronous messages first
    switch (message.type) {
      case 'GET_ACTIVE_TABS':
        const state = getExtensionState();
        console.log('DEBUG: GET_ACTIVE_TABS - activeMediaTabs size:', activeMediaTabs.size);
        console.log('DEBUG: GET_ACTIVE_TABS - state object:', state);
        console.log('DEBUG: Sending state from background:', state);
        sendResponse(state);
        return false; // Synchronous response
        
      case 'MEDIA_PAUSED':
        handleMediaPaused(tabId);
        return false; // Synchronous response
        
      case 'MEDIA_ENDED':
        handleMediaEnded(tabId);
        return false; // Synchronous response
        
      case 'PAUSE_TAB':
        pauseTabMedia(message.tabId);
        return false; // Synchronous response
        
      case 'SPEED_CHANGED':
        handleSpeedChanged(tabId, message.speed, message.src);
        return false; // Synchronous response
        
      case 'SET_TAB_SPEED':
        setTabSpeed(message.tabId, message.speed);
        return false; // Synchronous response
        
      case 'SPEED_ACTION_TAB':
        sendSpeedActionToTab(message.tabId, message.action, message.value);
        return false; // Synchronous response
        
      case 'EXTENSION_TOGGLE':
        handleExtensionToggle(message.enabled);
        return false; // Synchronous response
    }
    
    // Handle async messages
    (async () => {
      try {
        switch (message.type) {
          case 'MEDIA_STARTED':
            // Get tab info and call handleMediaStarted with correct parameters
            try {
              const tab = await browserAPI.tabs.get(tabId);
              console.log('DEBUG: tabs.get result:', tab);
              handleMediaStarted(tabId, tab, message.mediaInfo);
            } catch (error) {
              console.error('DEBUG: Failed to get tab info:', error);
              // Call with fallback tab info
              const fallbackTab = {
                url: message.mediaInfo?.src || 'Unknown URL',
                title: message.mediaInfo?.title || 'Unknown Title',
                favIconUrl: null
              };
              handleMediaStarted(tabId, fallbackTab, message.mediaInfo);
            }
            break;
            
          case 'GET_SPEED_SETTINGS':
            const settings = await getSpeedSettings();
            sendResponse(settings);
            break;
            
          case 'UPDATE_SPEED_SETTINGS':
            await updateSpeedSettings(message.settings);
            sendResponse({ success: true });
            break;
            
          case 'BROADCAST_SETTINGS_UPDATE':
            broadcastSettingsUpdate(message.settings);
            sendResponse({ success: true });
            break;
            
          default:
            console.warn('Unknown message type:', message.type);
        }
      } catch (error) {
        console.error('Error handling async message:', error);
        sendResponse({ error: error.message });
      }
    })();
    
    // Return true for async messages that need sendResponse
    return ['GET_SPEED_SETTINGS', 'UPDATE_SPEED_SETTINGS', 'BROADCAST_SETTINGS_UPDATE'].includes(message.type);
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
  
  // Intelligent cleanup when tab is updated - only remove on actual navigation
  browserAPI.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url && activeMediaTabs.has(tabId)) {
      const currentTabInfo = activeMediaTabs.get(tabId);
      const currentUrl = new URL(currentTabInfo.url);
      
      try {
        const newUrl = new URL(changeInfo.url);
        
        // Only remove if hostname changed (actual navigation to different site)
        // Keep tracking for SPA routing, hash changes, query params, etc.
        if (currentUrl.hostname !== newUrl.hostname) {
          console.log(`Media tab ${tabId} navigated to different hostname: ${currentUrl.hostname} -> ${newUrl.hostname}`);
          activeMediaTabs.delete(tabId);
          if (currentPlayingTab === tabId) {
            currentPlayingTab = null;
          }
          updateBadge();
          notifyPopupStateChange();
        } else {
          // Same hostname - update URL but keep tracking
          currentTabInfo.url = changeInfo.url;
          currentTabInfo.timestamp = Date.now(); // Update activity timestamp
          console.log(`Media tab ${tabId} URL updated on same hostname: ${changeInfo.url}`);
        }
      } catch (error) {
        // If URL parsing fails, be conservative and remove the tab
        console.warn(`Failed to parse URL for tab ${tabId}, removing from tracking:`, error);
        activeMediaTabs.delete(tabId);
        if (currentPlayingTab === tabId) {
          currentPlayingTab = null;
        }
        updateBadge();
        notifyPopupStateChange();
      }
    }
  });
  
  // Set up periodic cleanup to remove truly stale tabs
  setupPeriodicCleanup();
}

/**
 * Handle when media starts playing in a tab
 */
function handleMediaStarted(tabId, tab, mediaInfo) {
  console.log(`Media started in tab ${tabId}:`, mediaInfo);
  console.log('DEBUG: handleMediaStarted - tab info:', tab);
  console.log('DEBUG: handleMediaStarted - isExtensionEnabled:', isExtensionEnabled);
  
  // If extension is disabled, don't manage media
  if (!isExtensionEnabled) {
    console.log('DEBUG: Extension disabled, not storing tab');
    return;
  }
  
  // If there's already a playing tab, pause it
  if (currentPlayingTab && currentPlayingTab !== tabId) {
    pauseTabMedia(currentPlayingTab);
  }
  
  console.log('DEBUG: About to store tab in activeMediaTabs');
  
  // Handle case where tab info is unavailable
  const safeTab = tab || {
    url: mediaInfo?.src || 'Unknown URL',
    title: mediaInfo?.title || 'Unknown Title',
    favIconUrl: null
  };
  
  // Update the active media tabs
  activeMediaTabs.set(tabId, {
    url: safeTab.url,
    title: safeTab.title,
    mediaType: mediaInfo.type,
    timestamp: Date.now(),
    favicon: safeTab.favIconUrl
  });
  
  console.log('DEBUG: activeMediaTabs.size after storing:', activeMediaTabs.size);
  console.log('DEBUG: Tab stored:', activeMediaTabs.get(tabId));
  
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

/**
 * Handle speed change notification from content script
 */
function handleSpeedChanged(tabId, speed, src) {
  console.log(`Speed changed in tab ${tabId}: ${speed} for ${src}`);
  
  // Update the active media tab info if it exists
  if (activeMediaTabs.has(tabId)) {
    const tabInfo = activeMediaTabs.get(tabId);
    tabInfo.playbackRate = speed;
    tabInfo.lastSpeedChange = Date.now();
    activeMediaTabs.set(tabId, tabInfo);
  }
  
  // Notify popup of state change
  notifyPopupStateChange();
}

/**
 * Set speed for a specific tab
 */
async function setTabSpeed(tabId, speed) {
  if (!activeMediaTabs.has(tabId)) {
    console.warn(`Cannot set speed for tab ${tabId}: not found in active tabs`);
    return;
  }
  
  try {
    await browserAPI.tabs.sendMessage(tabId, {
      type: 'SET_SPEED',
      speed: speed
    });
    console.log(`Set speed to ${speed} for tab ${tabId}`);
  } catch (error) {
    console.warn(`Failed to set speed for tab ${tabId}:`, error);
  }
}

/**
 * Send speed action to a specific tab
 */
async function sendSpeedActionToTab(tabId, action, value) {
  try {
    await browserAPI.tabs.sendMessage(tabId, {
      type: 'SPEED_ACTION',
      action: action,
      value: value
    });
    console.log(`Sent speed action ${action} to tab ${tabId}`);
  } catch (error) {
    console.warn(`Failed to send speed action to tab ${tabId}:`, error);
  }
}

/**
 * Get speed settings from storage
 */
async function getSpeedSettings() {
  try {
    const result = await browserAPI.storage.sync.get([
      'enabled',
      'showController',
      'startHidden',
      'rememberSpeed',
      'forceLastSavedSpeed',
      'controllerOpacity',
      'speed',
      'displayKeyCode',
      'keyBindings',
      'blacklist',
      'videoSpeedSettings', // Legacy support
      'videoSpeedEnabled',  // Legacy support
      'lastSpeed'          // Legacy support
    ]);
    
    return {
      enabled: result.enabled !== false,
      showController: result.showController !== false,
      startHidden: result.startHidden || false,
      rememberSpeed: result.rememberSpeed || false,
      forceLastSavedSpeed: result.forceLastSavedSpeed || false,
      controllerOpacity: result.controllerOpacity || 0.3,
      speed: result.speed || 1.0,
      displayKeyCode: result.displayKeyCode || 86,
      keyBindings: result.keyBindings || defaultSettings.keyBindings,
      blacklist: result.blacklist || defaultSettings.blacklist,
      // Legacy support
      videoSpeedSettings: result.videoSpeedSettings || {},
      videoSpeedEnabled: result.videoSpeedEnabled !== false,
      lastSpeed: result.lastSpeed || result.speed || 1.0
    };
  } catch (error) {
    console.error('OneTab Media: Failed to get speed settings:', error);
    return {
      enabled: true,
      showController: true,
      startHidden: false,
      rememberSpeed: false,
      forceLastSavedSpeed: false,
      controllerOpacity: 0.3,
      speed: 1.0,
      displayKeyCode: 86,
      keyBindings: defaultSettings.keyBindings,
      blacklist: defaultSettings.blacklist,
      videoSpeedSettings: {},
      videoSpeedEnabled: true,
      lastSpeed: 1.0
    };
  }
}

/**
 * Update speed settings in storage
 */
async function updateSpeedSettings(settings) {
  try {
    const updates = {};
    
    // Update individual settings if provided
    if (settings.enabled !== undefined) updates.enabled = settings.enabled;
    if (settings.showController !== undefined) updates.showController = settings.showController;
    if (settings.startHidden !== undefined) updates.startHidden = settings.startHidden;
    if (settings.rememberSpeed !== undefined) updates.rememberSpeed = settings.rememberSpeed;
    if (settings.forceLastSavedSpeed !== undefined) updates.forceLastSavedSpeed = settings.forceLastSavedSpeed;
    if (settings.controllerOpacity !== undefined) updates.controllerOpacity = settings.controllerOpacity;
    if (settings.speed !== undefined) updates.speed = settings.speed;
    if (settings.displayKeyCode !== undefined) updates.displayKeyCode = settings.displayKeyCode;
    if (settings.keyBindings !== undefined) updates.keyBindings = settings.keyBindings;
    if (settings.blacklist !== undefined) updates.blacklist = settings.blacklist;
    
    // Legacy support
    if (settings.videoSpeedSettings !== undefined) updates.videoSpeedSettings = settings.videoSpeedSettings;
    if (settings.videoSpeedEnabled !== undefined) updates.videoSpeedEnabled = settings.videoSpeedEnabled;
    if (settings.lastSpeed !== undefined) {
      updates.lastSpeed = settings.lastSpeed;
      updates.speed = settings.lastSpeed; // Sync with new speed setting
    }
    
    await browserAPI.storage.sync.set(updates);
    console.log('OneTab Media: Speed settings updated:', updates);
    
    // Broadcast settings update to all content scripts
    broadcastSettingsUpdate(updates);
  } catch (error) {
    console.error('OneTab Media: Failed to update speed settings:', error);
  }
}

/**
 * Broadcast settings updates to all content scripts
 */
function broadcastSettingsUpdate(settings) {
  try {
    browserAPI.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        try {
          browserAPI.tabs.sendMessage(tab.id, {
            type: 'SETTINGS_UPDATED',
            settings: settings
          }).catch(() => {
            // Ignore errors for tabs without content scripts
          });
        } catch (error) {
          // Ignore errors for tabs that can't receive messages
        }
      });
    });
  } catch (error) {
    console.warn('OneTab Media: Failed to broadcast settings update:', error);
  }
}

/**
 * Set up periodic cleanup to verify tabs are still valid and contain active media
 */
function setupPeriodicCleanup() {
  // Run cleanup every 5 minutes
  setInterval(async () => {
    try {
      console.log('Running periodic media tab cleanup...');
      const currentTime = Date.now();
      const staleThreshold = 30 * 60 * 1000; // 30 minutes
      const tabsToRemove = [];
      
      // Check each tracked tab
      for (const [tabId, tabInfo] of activeMediaTabs.entries()) {
        const ageMinutes = (currentTime - tabInfo.timestamp) / 60000;
        
        try {
          // Verify tab still exists and is accessible
          const tab = await browserAPI.tabs.get(tabId);
          
          if (!tab || tab.discarded) {
            console.log(`Removing discarded tab ${tabId} from media tracking`);
            tabsToRemove.push(tabId);
            continue;
          }
          
          // Check if tab has been inactive for too long (30+ minutes)
          if (currentTime - tabInfo.timestamp > staleThreshold) {
            console.log(`Removing stale tab ${tabId} (inactive for ${ageMinutes.toFixed(1)} minutes)`);
            tabsToRemove.push(tabId);
            continue;
          }
          
          // Verify the tab still has the expected content by checking URL
          if (tab.url && tabInfo.url) {
            try {
              const currentHostname = new URL(tab.url).hostname;
              const trackedHostname = new URL(tabInfo.url).hostname;
              
              if (currentHostname !== trackedHostname) {
                console.log(`Removing tab ${tabId} - hostname changed from ${trackedHostname} to ${currentHostname}`);
                tabsToRemove.push(tabId);
              }
            } catch (urlError) {
              console.warn(`Could not parse URLs for tab ${tabId}, keeping in tracking`);
            }
          }
          
        } catch (tabError) {
          // Tab no longer exists or is not accessible
          console.log(`Removing inaccessible tab ${tabId} from media tracking:`, tabError.message);
          tabsToRemove.push(tabId);
        }
      }
      
      // Remove stale tabs
      let removedCount = 0;
      tabsToRemove.forEach(tabId => {
        if (activeMediaTabs.has(tabId)) {
          activeMediaTabs.delete(tabId);
          if (currentPlayingTab === tabId) {
            currentPlayingTab = null;
          }
          removedCount++;
        }
      });
      
      if (removedCount > 0) {
        console.log(`Periodic cleanup removed ${removedCount} stale media tabs`);
        updateBadge();
        notifyPopupStateChange();
      } else {
        console.log('Periodic cleanup: all media tabs are still valid');
      }
      
    } catch (error) {
      console.error('Error during periodic media tab cleanup:', error);
    }
  }, 5 * 60 * 1000); // Every 5 minutes
  
  console.log('Periodic media tab cleanup scheduled (every 5 minutes)');
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