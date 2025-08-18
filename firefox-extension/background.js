/**
 * UME - Ultimate Media Extention - Background Script
 * Manages extension state, settings, and communication between components
 */

// Global state to track media tabs
let activeMediaTabs = new Map(); // tabId -> { url, title, mediaType, timestamp, isPlaying }
let potentialMediaTabs = new Map(); // tabId -> { url, title, status, timestamp }
let currentPlayingTab = null;
let isExtensionEnabled = true; // Extension enabled by default

// Firefox background script persistence
let backgroundScriptStartTime = Date.now();
let keepaliveTimer = null;
let isBackgroundScriptSuspended = false;

// Enhanced logging and diagnostics
const DEBUG_MODE = true;
let extensionStartTime = Date.now();
let logBuffer = [];
const MAX_LOG_BUFFER = 1000;

// Statistics tracking
let extensionStats = {
  tabsTracked: 0,
  tabsRemoved: 0,
  mediaStartEvents: 0,
  mediaEndEvents: 0,
  speedChanges: 0,
  errors: 0,
  lastActivity: Date.now()
};

/**
 * Enhanced logging with timestamps and categories
 */
function debugLog(category, message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    category,
    message,
    data: data ? JSON.stringify(data) : null,
    uptime: Date.now() - extensionStartTime
  };
  
  // Add to buffer
  logBuffer.push(logEntry);
  if (logBuffer.length > MAX_LOG_BUFFER) {
    logBuffer.shift();
  }
  
  // Console output
  const logLine = `[UME-${category}] ${timestamp} (+${logEntry.uptime}ms) ${message}`;
  if (data) {
    console.log(logLine, data);
  } else {
    console.log(logLine);
  }
  
  // Update last activity
  extensionStats.lastActivity = Date.now();
}

/**
 * Get diagnostic information
 */
function getDiagnosticInfo() {
  return {
    uptime: Date.now() - extensionStartTime,
    stats: extensionStats,
    activeTabsCount: activeMediaTabs.size,
    potentialTabsCount: potentialMediaTabs.size,
    currentPlayingTab,
    isExtensionEnabled,
    recentLogs: logBuffer.slice(-50), // Last 50 log entries
    memoryUsage: {
      activeMediaTabsSize: activeMediaTabs.size,
      potentialMediaTabsSize: potentialMediaTabs.size,
      logBufferSize: logBuffer.length
    }
  };
}

// Cleanup thresholds (used by tests and for scheduling)
const staleThreshold = 2 * 60 * 60 * 1000; // 2 hours
const cleanupIntervalMs = 10 * 60 * 1000; // 10 minutes

// Comprehensive list of common media/audio/video streaming sites
const MEDIA_SITES = [
  // Global video platforms
  'youtube.com', 'youtu.be', 'youtube-nocookie.com', 'm.youtube.com', 'music.youtube.com',
  'vimeo.com', 'player.vimeo.com', 'dailymotion.com', 'metacafe.com', 'vevo.com', 'rutube.ru', 'tubitv.com', 'pluto.tv',
  'rumble.com', 'odysee.com', 'bitchute.com', 'peertube',
  // Live streaming
  'twitch.tv', 'kick.com', 'dlive.tv', 'facebook.com/live', 'youtube.com/live',
  // US streaming services
  'netflix.com', 'hulu.com', 'primevideo.com', 'amazon.com/video', 'disneyplus.com', 'disney.com',
  'hbomax.com', 'max.com', 'paramountplus.com', 'peacocktv.com', 'apple.com/tv', 'tv.apple.com',
  'roku.com', 'rokuchannel.roku.com', 'crackle.com', 'kanopy.com', 'plex.tv', 'app.plex.tv', 'jellyfin.org', 'jellyfin.org/web', 'emby.media', 'app.emby.media',
  // Anime and intl streaming
  'crunchyroll.com', 'funimation.com', 'vrv.co', 'viki.com', 'hidive.com',
  'bilibili.com', 'youku.com', 'iqiyi.com', 'iq.com', 'wetv.vip', 'nicovideo.jp', 'niconico.jp',
  // UK/AU and other regionals
  'bbc.co.uk/iplayer', 'itv.com', 'itvx.com', 'channel4.com', 'sbs.com.au/ondemand', '9now.com.au', 'stan.com.au',
  // Social with media
  'facebook.com', 'fb.watch', 'instagram.com', 'tiktok.com', 'reddit.com', 'twitter.com', 'x.com', 'vk.com', 'ok.ru',
  // Music streaming
  'spotify.com', 'open.spotify.com', 'music.apple.com', 'soundcloud.com', 'bandcamp.com', 'deezer.com', 'tidal.com',
  'pandora.com', 'iheartradio.com', 'tunein.com', 'audible.com', 'podcasts.apple.com', 'pocketcasts.com',
  // Adult (media heavy)
  'pornhub.com', 'xvideos.com', 'redtube.com', 'xhamster.com', 'youporn.com', 'spankbang.com', 'xnxx.com'
];

/**
 * Check if URL is a potential media site
 */
function isPotentialMediaSite(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    const hostname = u.hostname.toLowerCase();
    return MEDIA_SITES.some(site => {
      const s = site.toLowerCase();
      if (s.includes('/')) return url.toLowerCase().includes(s);
      return hostname === s || hostname.endsWith('.' + s);
    });
  } catch {
    return false;
  }
}

/**
 * Add tab to potential media tracking
 */
function addPotentialTab(tabId, url, title) {
  potentialMediaTabs.set(tabId, {
    url: url,
    title: title || 'Unknown',
    status: 'monitoring', // monitoring, has_media, playing, paused
    timestamp: Date.now()
  });
  
  extensionStats.tabsTracked++;
  debugLog('TAB_TRACKING', `Added potential media tab ${tabId}`, {
    url: url,
    title: title,
    totalPotentialTabs: potentialMediaTabs.size
  });
  
  updateBadge();
  notifyPopupStateChange();
  
  // Check if it actually has media
  setTimeout(() => checkTabForMedia(tabId), 2000);
}

/**
 * Check tab for actual media elements
 */
async function checkTabForMedia(tabId) {
  try {
    debugLog('MEDIA_CHECK', `Checking tab ${tabId} for media elements`);
    
    const response = await browser.tabs.sendMessage(tabId, {
      type: 'CHECK_FOR_MEDIA'
    });
    
    if (response && response.hasMedia) {
      const potentialTab = potentialMediaTabs.get(tabId);
      if (potentialTab) {
        potentialTab.status = 'has_media';
        debugLog('MEDIA_CHECK', `Tab ${tabId} confirmed to have media`, {
          mediaCount: response.mediaCount,
          videoCount: response.videoCount,
          audioCount: response.audioCount,
          mediaTypes: response.mediaTypes
        });
      }
    } else {
      debugLog('MEDIA_CHECK', `Tab ${tabId} has no media elements`);
    }
  } catch (error) {
    debugLog('MEDIA_CHECK', `Failed to check media for tab ${tabId}`, {
      error: error.message,
      reason: 'Tab not ready or no content script'
    });
    extensionStats.errors++;
  }
}

// Firefox-specific API layer
// Use Firefox WebExtensions API directly for optimal performance
if (typeof browser === 'undefined') {
  throw new Error('Firefox WebExtensions API not available');
}

/**
 * Firefox Background Script Persistence Management
 * Ensures the background script remains active for media monitoring
 */

/**
 * Set up keepalive mechanism to prevent Firefox from suspending the background script
 */
function setupBackgroundScriptKeepalive() {
  // Use alarms API for reliable keepalive (survives suspension)
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'keepalive') {
      debugLog('KEEPALIVE', 'Background script keepalive ping', {
        uptime: Date.now() - backgroundScriptStartTime,
        activeTabsCount: activeMediaTabs.size,
        potentialTabsCount: potentialMediaTabs.size
      });
      
      // Update badge to show we're still active
      updateBadge();
      
      // If we have active media, increase ping frequency
      const pingInterval = activeMediaTabs.size > 0 ? 1 : 5; // 1 min if active, 5 min otherwise
      browser.alarms.create('keepalive', { delayInMinutes: pingInterval });
    }
  });
  
  // Start the keepalive alarm
  browser.alarms.create('keepalive', { delayInMinutes: 1 });
  
  debugLog('PERSISTENCE', 'Firefox keepalive mechanism activated');
}

/**
 * Handle background script startup and recovery
 */
function handleBackgroundScriptStartup() {
  const now = Date.now();
  const wasRecentlyStarted = (now - backgroundScriptStartTime) < 5000; // 5 seconds
  
  debugLog('STARTUP', 'Background script startup detected', {
    wasRecentlyStarted,
    uptime: now - backgroundScriptStartTime,
    suspensionRecovery: isBackgroundScriptSuspended
  });
  
  if (!wasRecentlyStarted || isBackgroundScriptSuspended) {
    debugLog('STARTUP', 'Recovering from background script suspension/restart');
    
    // Re-initialize critical components
    recoverFromSuspension();
  }
  
  isBackgroundScriptSuspended = false;
  backgroundScriptStartTime = now;
}

/**
 * Recover from background script suspension
 */
async function recoverFromSuspension() {
  try {
    debugLog('RECOVERY', 'Starting background script recovery process');
    
    // Re-check existing tabs
    await checkExistingTabs();
    
    // Reload extension settings
    await loadExtensionSettings();
    
    // Notify all content scripts that background script is active again
    try {
      const tabs = await browser.tabs.query({});
      for (const tab of tabs) {
        try {
          await browser.tabs.sendMessage(tab.id, {
            type: 'BACKGROUND_SCRIPT_READY'
          });
        } catch (e) {
          // Ignore errors - content scripts may not be ready
        }
      }
    } catch (error) {
      debugLog('RECOVERY', 'Failed to notify content scripts of recovery', { error: error.message });
    }
    
    // Update badge
    updateBadge();
    
    debugLog('RECOVERY', 'Background script recovery complete', {
      activeTabsCount: activeMediaTabs.size,
      potentialTabsCount: potentialMediaTabs.size
    });
  } catch (error) {
    debugLog('RECOVERY', 'Background script recovery failed', { error: error.message });
  }
}

/**
 * Monitor background script health
 */
function setupBackgroundScriptMonitoring() {
  // Check if we're still responsive every 30 seconds
  setInterval(() => {
    const now = Date.now();
    const lastActivity = extensionStats.lastActivity;
    const timeSinceActivity = now - lastActivity;
    
    if (timeSinceActivity > 60000) { // 1 minute of inactivity
      debugLog('HEALTH', 'Background script appears inactive, checking tabs', {
        timeSinceActivity,
        activeTabsCount: activeMediaTabs.size
      });
      
      // If we have tracked tabs but no recent activity, try to re-establish connections
      if (activeMediaTabs.size > 0) {
        recoverFromSuspension();
      }
    }
  }, 30000); // Check every 30 seconds
  
  debugLog('MONITORING', 'Background script health monitoring started');
}

/**
 * Handle browser startup and wake events
 */
function setupBrowserWakeHandling() {
  // Listen for browser startup events
  browser.runtime.onStartup.addListener(() => {
    debugLog('BROWSER_STARTUP', 'Browser startup detected, ensuring extension is active');
    handleBackgroundScriptStartup();
    recoverFromSuspension();
  });
  
  // Listen for extension installation/enable events
  browser.runtime.onInstalled.addListener((details) => {
    debugLog('EXTENSION_INSTALLED', 'Extension installed/updated', {
      reason: details.reason,
      previousVersion: details.previousVersion
    });
    
    // Ensure we're set up correctly after installation/update
    setTimeout(() => {
      recoverFromSuspension();
    }, 1000);
  });
  
  debugLog('BROWSER_WAKE', 'Browser wake event handling set up');
}

// Default settings - Enhanced to match original videospeed extension exactly
const defaultSettings = {
  extensionEnabled: true,
  enabled: true, // Legacy compatibility
  // Theme settings
  theme: 'light', // 'light' | 'dark'
  showController: true,
  startHidden: false,
  rememberSpeed: true, // Enable by default like original
  forceLastSavedSpeed: false, // Always apply last saved speed to new videos  
  audioBoolean: true, // Enable on audio by default
  controllerOpacity: 0.8, // More visible like original
  speed: 1.0, // Default speed for videos
  displayKeyCode: 86, // V key for display toggle
  keyBindings: [
    { action: 'display', key: 86, value: 0, force: false, predefined: true }, // V
    { action: 'slower', key: 83, value: 0.25, force: false, predefined: true }, // S  
    { action: 'faster', key: 68, value: 0.25, force: false, predefined: true }, // D
    { action: 'rewind', key: 90, value: 10, force: false, predefined: true }, // Z
    { action: 'advance', key: 88, value: 10, force: false, predefined: true }, // X
    { action: 'reset', key: 82, value: 1.0, force: false, predefined: true }, // R
    { action: 'fast', key: 71, value: 1.8, force: false, predefined: true }, // G
    { action: 'mark', key: 77, value: 0, force: false, predefined: true }, // M - set marker
    { action: 'jump', key: 74, value: 0, force: false, predefined: true }, // J - jump to marker
    { action: 'volumeUp', key: 38, value: 0.1, force: false, predefined: true }, // Up Arrow - increase volume
    { action: 'volumeDown', key: 40, value: 0.1, force: false, predefined: true } // Down Arrow - decrease volume
  ],
  blacklist: `www.instagram.com
twitter.com
imgur.com
teams.microsoft.com`.replace(/^[\r\t\f\v ]+|[\r\t\f\v ]+$/gm, ''),
  // Volume booster settings
  volumeBoosterEnabled: true,
  globalVolume: 1.0, // Global volume multiplier
  perDomainVolume: {}, // Store per-domain volume settings
  volumeBoostLimit: 5.0, // Maximum volume boost (500%)
  volumeStep: 0.1, // Volume adjustment increment
  // Marker functionality
  markers: {} // Store video markers per URL
};

/**
 * Check all existing tabs for potential media sites - Firefox optimized
 */
async function checkExistingTabs() {
  try {
    debugLog('INIT', 'Querying existing tabs with Firefox WebExtensions API');
    
    // Use Firefox WebExtensions API directly
    const tabs = await browser.tabs.query({});
    
    if (!Array.isArray(tabs)) {
      debugLog('INIT', 'Invalid tabs response from Firefox API', { 
        tabs: tabs,
        type: typeof tabs,
        isArray: Array.isArray(tabs)
      });
      return;
    }
    
    debugLog('INIT', `Found ${tabs.length} existing tabs to check`);
    
    for (const tab of tabs) {
      if (!tab || !tab.id || !tab.url) {
        debugLog('INIT', 'Skipping invalid tab', { tab: tab });
        continue;
      }

      // 1) Known media sites are immediately monitored
      if (isPotentialMediaSite(tab.url)) {
        addPotentialTab(tab.id, tab.url, tab.title);
      }

      // 2) Proactively detect media presence on any site using Firefox API
      try {
        const response = await browser.tabs.sendMessage(tab.id, { type: 'CHECK_FOR_MEDIA' });
        if (response && response.hasMedia) {
          if (!potentialMediaTabs.has(tab.id)) {
            addPotentialTab(tab.id, tab.url, tab.title);
          }
          const info = potentialMediaTabs.get(tab.id);
          if (info && info.status !== 'playing') {
            info.status = 'has_media';
          }
        }
      } catch (e) {
        // Tab may not be ready or cannot receive messages; ignore
        // This is normal in Firefox when tabs are not fully loaded
      }
    }
    
    console.log(`Monitoring ${potentialMediaTabs.size} tabs for media`);
  } catch (error) {
    console.error('Error checking existing tabs:', error);
  }
}

/**
 * Initialize extension when background script starts
 */
async function initializeExtension() {
  debugLog('INIT', 'Firefox background script starting up');
  
  // Handle background script startup and recovery
  handleBackgroundScriptStartup();
  
  // Preserve existing tabs but clear potential tabs (will be re-detected)
  const preservedTabs = activeMediaTabs.size;
  potentialMediaTabs.clear();
  debugLog('INIT', `Preserving ${preservedTabs} active media tabs, cleared potential tabs`);
  
  try {
    // Set up Firefox-specific background script persistence
    debugLog('INIT', 'Setting up background script persistence mechanisms');
    setupBackgroundScriptKeepalive();
    setupBackgroundScriptMonitoring();
    setupBrowserWakeHandling();
    
    // Ensure default settings are applied
    debugLog('INIT', 'Ensuring default settings are applied');
    await ensureDefaultSettings();
    
    // Load extension settings
    debugLog('INIT', 'Loading extension settings');
    await loadExtensionSettings();
    
    // Set up message listeners
    debugLog('INIT', 'Setting up message listeners');
    setupMessageListeners();
    
    // Set up tab event listeners
    debugLog('INIT', 'Setting up tab event listeners');
    setupTabListeners();
    
    // Check existing tabs for potential media sites
    debugLog('INIT', 'Checking existing tabs for media');
    await checkExistingTabs();

    // Start conservative cleanup loop
    try { 
      debugLog('INIT', 'Setting up periodic cleanup');
      setupPeriodicCleanup(); 
    } catch (e) { 
      debugLog('INIT', 'Failed to setup periodic cleanup', { error: e.message });
      extensionStats.errors++;
    }

    debugLog('INIT', 'Extension initialization complete', getDiagnosticInfo());
  } catch (error) {
    debugLog('INIT', 'Extension initialization failed', { error: error.message });
    extensionStats.errors++;
  }
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

    // First check if we have the settingsInitialized flag to avoid fresh install detection issues
    const initCheck = await StorageManager.get(['settingsInitialized', 'settingsVersion']);
    console.log('OneTab Media: Checking initialization status:', initCheck);
    
    // Use enhanced storage manager with fallback
    const result = await StorageManager.get(settingsKeys);
    console.log('OneTab Media: Loaded settings keys:', Object.keys(result));
    
    // Check if this is a fresh install - be more specific about detection
    const isFreshInstall = !initCheck.settingsInitialized && Object.keys(result).filter(key => 
      key !== 'settingsInitialized' && 
      key !== 'settingsVersion' && 
      result[key] !== undefined
    ).length === 0;
    
    console.log('OneTab Media: Install check:', { 
      hasInitFlag: !!initCheck.settingsInitialized,
      resultKeysCount: Object.keys(result).length,
      isFreshInstall: isFreshInstall
    });
    
    if (isFreshInstall) {
      console.log('OneTab Media: Setting up defaults for fresh install');
      const success = await StorageManager.set({
        ...defaultSettings,
        settingsVersion: '4.0', // Track settings version for future migrations
        settingsInitialized: true,
        installDate: new Date().toISOString()
      });
      
      if (success) {
        console.log('OneTab Media: Default settings applied successfully with persistence');
      } else {
        console.error('OneTab Media: Failed to save default settings');
      }
    } else {
      console.log('OneTab Media: Existing installation detected, checking for missing settings');
      // Ensure any missing settings are set to defaults
      const updates = {};
      for (const [key, defaultValue] of Object.entries(defaultSettings)) {
        if (result[key] === undefined) {
          updates[key] = defaultValue;
          console.log(`OneTab Media: Adding missing setting ${key}:`, defaultValue);
        }
      }
      
      // Update settings version if needed
      if (!result.settingsVersion || result.settingsVersion !== '4.0') {
        updates.settingsVersion = '4.0';
        updates.lastUpdated = new Date().toISOString();
      }
      
      if (!result.settingsInitialized) {
        updates.settingsInitialized = true;
      }
      
      if (Object.keys(updates).length > 0) {
        console.log('OneTab Media: Adding missing default settings:', updates);
        await StorageManager.set(updates);
      } else {
        console.log('OneTab Media: All settings are present, no updates needed');
      }
    }
    
    // Perform settings migration if needed
    await migrateSettings(result);
    
  } catch (error) {
    console.error('UME - Ultimate Media Extention: Failed to ensure default settings:', error);
  }
}

/**
 * Migrate settings from previous versions with enhanced persistence
 */
async function migrateSettings(currentSettings) {
  try {
    const migrations = [];
    
    // Migration from local storage to sync storage - Firefox optimized
    try {
      const localResult = await browser.storage.local.get([
        'extensionEnabled', 'speed', 'lastSpeed', 'enabled', 'showController',
        'startHidden', 'rememberSpeed', 'forceLastSavedSpeed', 'controllerOpacity',
        'keyBindings', 'blacklist', 'theme', 'volumeBoosterEnabled', 'globalVolume'
      ]);
      
      if (localResult && Object.keys(localResult).length > 0) {
        console.log('OneTab Media Firefox: Found settings in local storage, checking for migration');
        
        // Only migrate if sync storage doesn't have these values
        const toMigrate = {};
        for (const [key, value] of Object.entries(localResult)) {
          if (currentSettings[key] === undefined && value !== undefined) {
            toMigrate[key] = value;
          }
        }
        
        if (Object.keys(toMigrate).length > 0) {
          console.log('OneTab Media Firefox: Migrating settings from local to sync storage:', toMigrate);
          await StorageManager.set(toMigrate);
          migrations.push('local-to-sync');
          
          // Clean up migrated local storage items
          await browser.storage.local.remove(Object.keys(toMigrate));
          console.log('OneTab Media Firefox: Cleaned up migrated local storage items');
        }
      }
    } catch (migrationError) {
      console.warn('OneTab Media Firefox: Local to sync migration failed:', migrationError.message);
    }
    
    // Legacy settings compatibility migration
    try {
      if (currentSettings.videoSpeedEnabled !== undefined && currentSettings.enabled === undefined) {
        await StorageManager.set({ enabled: currentSettings.videoSpeedEnabled });
        migrations.push('legacy-videospeed');
      }
      
      if (currentSettings.videoSpeedSettings && typeof currentSettings.videoSpeedSettings === 'object') {
        const legacyUpdates = {};
        if (currentSettings.videoSpeedSettings.speed && !currentSettings.speed) {
          legacyUpdates.speed = currentSettings.videoSpeedSettings.speed;
        }
        if (Object.keys(legacyUpdates).length > 0) {
          await StorageManager.set(legacyUpdates);
          migrations.push('legacy-settings');
        }
      }
    } catch (legacyError) {
      console.warn('OneTab Media: Legacy migration failed:', legacyError);
    }
    
    // Record migration completion
    if (migrations.length > 0) {
      await StorageManager.set({
        lastMigration: new Date().toISOString(),
        migrationsApplied: [...(currentSettings.migrationsApplied || []), ...migrations]
      });
      console.log('OneTab Media: Settings migrations completed successfully:', migrations);
    }
    
  } catch (error) {
    console.warn('OneTab Media: Settings migration failed:', error);
  }
}

/**
 * Firefox-optimized storage manager
 * Uses Firefox WebExtensions storage API directly for optimal performance
 */
const FirefoxStorageManager = {
  /**
   * Get settings with sync storage and local fallback - Firefox optimized
   */
  async get(keys) {
    const keysArray = Array.isArray(keys) ? keys : [keys];
    console.log('OneTab Media Firefox: Attempting to get keys:', keysArray);
    
    try {
      // Use Firefox sync storage directly
      const result = await browser.storage.sync.get(keys);
      
      const resultKeys = Object.keys(result || {});
      const validResults = resultKeys.filter(key => result[key] !== undefined);
      
      console.log('OneTab Media Firefox: Sync storage results:', { 
        totalKeys: resultKeys.length, 
        validKeys: validResults.length,
        requestedKeys: keysArray.length,
        hasData: validResults.length > 0
      });
      
      // If sync storage has valid data, return it
      if (validResults.length > 0) {
        console.log('OneTab Media Firefox: Using sync storage data');
        return result;
      }
      
      // If sync storage is empty, try local storage fallback
      console.log('OneTab Media Firefox: Sync storage empty, trying local fallback');
      const fallbackResult = await browser.storage.local.get(keys);
      const fallbackKeys = Object.keys(fallbackResult || {});
      
      console.log('OneTab Media Firefox: Local fallback returned:', { 
        keys: fallbackKeys,
        count: fallbackKeys.length 
      });
      
      return fallbackResult || {};
    } catch (error) {
      console.warn('OneTab Media Firefox: Sync storage failed, trying local fallback:', error.message);
      try {
        const result = await browser.storage.local.get(keys);
        console.log('OneTab Media Firefox: Local storage fallback successful');
        return result || {};
      } catch (fallbackError) {
        console.error('OneTab Media Firefox: All storage methods failed:', fallbackError.message);
        return {};
      }
    }
  },

  /**
   * Set settings with Firefox-optimized storage
   */
  async set(items) {
    console.log('OneTab Media Firefox: Saving settings:', Object.keys(items));
    
    let syncSuccess = false;
    let localSuccess = false;
    
    try {
      // Primary: Save to sync storage for cross-device sync
      await browser.storage.sync.set(items);
      console.log('OneTab Media Firefox: Settings saved to sync storage');
      syncSuccess = true;
    } catch (syncError) {
      console.warn('OneTab Media Firefox: Sync storage failed:', syncError.message);
      
      // Fallback to local storage if sync fails
      try {
        await browser.storage.local.set(items);
        console.log('OneTab Media Firefox: Settings saved to local storage (sync failed)');
        localSuccess = true;
      } catch (localError) {
        console.error('OneTab Media Firefox: Both sync and local storage failed:', localError.message);
        return false;
      }
    }
    
    // Always backup to local storage if sync succeeded (for faster access)
    if (syncSuccess) {
      try {
        await browser.storage.local.set(items);
        console.log('OneTab Media Firefox: Settings backed up to local storage');
        localSuccess = true;
      } catch (backupError) {
        console.warn('OneTab Media Firefox: Local backup failed (sync succeeded):', backupError.message);
      }
    }
    
    // Verify the save by reading back a key
    try {
      const verifyKey = Object.keys(items)[0];
      if (verifyKey) {
        // Wait a bit for Firefox to process the storage operation
        await new Promise(resolve => setTimeout(resolve, 10));
        
        const verification = await this.get([verifyKey]);
        const expectedValue = items[verifyKey];
        const actualValue = verification[verifyKey];
        
        // Handle complex object comparison
        const isEqual = JSON.stringify(expectedValue) === JSON.stringify(actualValue);
        
        if (isEqual) {
          console.log('OneTab Media Firefox: Settings save verified successfully');
        } else {
          console.warn('OneTab Media Firefox: Settings save verification failed', { 
            key: verifyKey,
            expected: expectedValue, 
            actual: actualValue,
            expectedType: typeof expectedValue,
            actualType: typeof actualValue
          });
        }
      }
    } catch (verifyError) {
      console.warn('OneTab Media Firefox: Could not verify settings save:', verifyError.message);
    }
    
    return syncSuccess || localSuccess;
  },

  /**
   * Remove items from both sync and local storage - Firefox optimized
   */
  async remove(keys) {
    try {
      // Remove from sync storage
      await browser.storage.sync.remove(keys);
      console.log('OneTab Media Firefox: Removed from sync storage:', keys);
      
      // Also remove from local storage backup
      try {
        await browser.storage.local.remove(keys);
        console.log('OneTab Media Firefox: Removed from local storage:', keys);
      } catch (localError) {
        console.warn('OneTab Media Firefox: Local storage remove failed:', localError.message);
      }
      
    } catch (error) {
      console.warn('OneTab Media Firefox: Sync storage remove failed, trying local only:', error.message);
      try {
        await browser.storage.local.remove(keys);
        console.log('OneTab Media Firefox: Removed from local storage only');
      } catch (fallbackError) {
        console.error('OneTab Media Firefox: All storage remove methods failed:', fallbackError.message);
      }
    }
  },

  /**
   * Clear all extension settings from both storages - Firefox optimized  
   */
  async clear() {
    try {
      // Clear sync storage
      await browser.storage.sync.clear();
      console.log('OneTab Media Firefox: Sync storage cleared');
      
      // Also clear local storage backup
      try {
        await browser.storage.local.clear();
        console.log('OneTab Media Firefox: Local storage cleared');
      } catch (localError) {
        console.warn('OneTab Media Firefox: Local storage clear failed:', localError.message);
      }
      
    } catch (error) {
      console.warn('OneTab Media Firefox: Sync storage clear failed, trying local only:', error.message);
      try {
        await browser.storage.local.clear();
        console.log('OneTab Media Firefox: Local storage cleared (sync failed)');
      } catch (fallbackError) {
        console.error('OneTab Media Firefox: All storage clear methods failed:', fallbackError.message);
      }
    }
  }
};

// Use the Firefox-optimized storage manager
const StorageManager = FirefoxStorageManager;

/**
 * Load extension settings from storage with enhanced fallback
 */
async function loadExtensionSettings() {
  try {
    const result = await StorageManager.get(['extensionEnabled']);
    
    // Handle case where result is undefined or doesn't have the property
    isExtensionEnabled = result.extensionEnabled === false ? false : true; // Default to true
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
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
        
      case 'SET_VOLUME':
        setTabVolume(message.tabId, message.volume);
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
        
      case 'GET_DIAGNOSTICS':
        sendResponse(getDiagnosticInfo());
        return false; // Synchronous response
    }
    
    // Handle async messages
    (async () => {
      try {
        switch (message.type) {
          case 'MEDIA_STARTED':
            // Get tab info using Firefox API and call handleMediaStarted
            try {
              debugLog('TAB_INFO', `Attempting to get tab info for tab ${tabId}`);
              
              const tab = await browser.tabs.get(tabId);
              debugLog('TAB_INFO', `Successfully got tab info for tab ${tabId}`, {
                hasTab: !!tab,
                tabUrl: tab?.url,
                tabTitle: tab?.title
              });
              
              handleMediaStarted(tabId, tab, message.mediaInfo);
            } catch (error) {
              debugLog('TAB_INFO', `Failed to get tab info for tab ${tabId} (using fallback)`, {
                error: error.message,
                reason: 'Tab may be suspended or restricted'
              });
              
              // Call with fallback tab info - normal for suspended tabs in Firefox
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
    
    // Save to storage using Firefox-optimized StorageManager
    await StorageManager.set({ extensionEnabled: enabled });
    
    console.log('OneTab Media Firefox: Extension toggled:', enabled);
    
    // If disabled, clear current playing state but keep tracked tabs
    if (!enabled && currentPlayingTab) {
      currentPlayingTab = null;
    }
    
    // Update badge
    updateBadge();
    
    // Notify popup of state change
    notifyPopupStateChange();
    
  } catch (error) {
    console.error('OneTab Media Firefox: Failed to handle extension toggle:', error);
  }
}

/**
 * Set up Firefox-optimized tab listeners  
 */
function setupTabListeners() {
  // Track new tabs with Firefox API
  browser.tabs.onCreated.addListener((tab) => {
    if (!isExtensionEnabled || !tab.url) return;
    
    debugLog('TAB_CREATE', `New tab created: ${tab.id}`, { url: tab.url, title: tab.title });
    
    if (isPotentialMediaSite(tab.url)) {
      addPotentialTab(tab.id, tab.url, tab.title);
    }
  });
  
  // Track tab updates (URL changes) with Firefox API 
  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (!isExtensionEnabled) return;

    if (changeInfo.url) {
      debugLog('TAB_UPDATE', `Tab ${tabId} URL changed`, { 
        oldTracked: potentialMediaTabs.has(tabId),
        newUrl: changeInfo.url 
      });
      
      // Remove any previous tracking for this tab on any URL change
      if (potentialMediaTabs.has(tabId)) {
        potentialMediaTabs.delete(tabId);
      }
      if (activeMediaTabs.has(tabId)) {
        activeMediaTabs.delete(tabId);
      }
      if (currentPlayingTab === tabId) {
        currentPlayingTab = null;
      }

      // If new URL is a known media site, start monitoring again
      if (isPotentialMediaSite(changeInfo.url)) {
        addPotentialTab(tabId, changeInfo.url, tab.title);
      }

      updateBadge();
      notifyPopupStateChange();
    }

    // After load completes, proactively detect media on this tab
    if (changeInfo.status === 'complete') {
      // Use async IIFE for Firefox compatibility
      (async () => {
        try {
          // Add small delay for Firefox to ensure content script is ready
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const response = await browser.tabs.sendMessage(tabId, { type: 'CHECK_FOR_MEDIA' });
          if (response && response.hasMedia) {
            if (!potentialMediaTabs.has(tabId)) {
              addPotentialTab(tabId, tab.url, tab.title);
            }
            const info = potentialMediaTabs.get(tabId);
            if (info && info.status !== 'playing') {
              info.status = 'has_media';
              notifyPopupStateChange();
              updateBadge();
            }
          }
        } catch (e) {
          // Firefox-specific: Content script may not be ready yet
          debugLog('TAB_UPDATE', `Content script not ready for tab ${tabId}`, { 
            error: e.message,
            status: changeInfo.status 
          });
        }
      })();
    }
  });
  
  // Clean up closed tabs with Firefox API
  browser.tabs.onRemoved.addListener((tabId, removeInfo) => {
    debugLog('TAB_REMOVE', `Tab ${tabId} closed`, { 
      hadPotential: potentialMediaTabs.has(tabId),
      hadActive: activeMediaTabs.has(tabId),
      wasCurrent: currentPlayingTab === tabId
    });
    
    potentialMediaTabs.delete(tabId);
    if (activeMediaTabs.has(tabId)) {
      activeMediaTabs.delete(tabId);
      if (currentPlayingTab === tabId) {
        currentPlayingTab = null;
      }
    }
    updateBadge();
    notifyPopupStateChange();
  });
}

/**
 * Determine if new media should pause existing media based on priority
 * Priority: video > audio > webaudio (Web Audio API)
 */
function shouldPauseForNewMedia(currentTabId, newTabId, newMediaInfo) {
  // Get current tab's media info
  const currentTabInfo = activeMediaTabs.get(currentTabId);
  if (!currentTabInfo) {
    debugLog('MEDIA_PRIORITY', `Current tab ${currentTabId} not found, allowing new media`);
    return true; // If we can't find current tab, allow new media
  }
  
  const currentMediaType = currentTabInfo.mediaType;
  const newMediaType = newMediaInfo.type;
  
  // Media priority order (higher number = higher priority)
  const mediaPriority = {
    'webaudio': 1,  // Lowest priority (background audio, ads, etc.)
    'audio': 2,     // Medium priority (audio elements)
    'video': 3      // Highest priority (video elements)
  };
  
  const currentPriority = mediaPriority[currentMediaType] || 0;
  const newPriority = mediaPriority[newMediaType] || 0;
  
  debugLog('MEDIA_PRIORITY', `Comparing media priorities`, {
    currentTab: currentTabId,
    currentType: currentMediaType,
    currentPriority: currentPriority,
    newTab: newTabId,
    newType: newMediaType,
    newPriority: newPriority,
    shouldPause: newPriority >= currentPriority
  });
  
  // Only pause if new media has equal or higher priority
  // This prevents Web Audio API (priority 1) from pausing videos (priority 3)
  return newPriority >= currentPriority;
}

/**
 * Handle when media starts playing in a tab
 */
function handleMediaStarted(tabId, tab, mediaInfo) {
  // Prevent duplicate events for the same tab and media source within a short time
  const now = Date.now();
  const mediaKey = `${tabId}_${mediaInfo.src}_${mediaInfo.type}`;
  
  if (!window._lastMediaEvents) {
    window._lastMediaEvents = new Map();
  }
  
  const lastEvent = window._lastMediaEvents.get(mediaKey);
  if (lastEvent && (now - lastEvent) < 1000) { // 1 second debounce
    debugLog('MEDIA_START', `Ignoring duplicate media start event for tab ${tabId}`, {
      mediaType: mediaInfo.type,
      timeSinceLastEvent: now - lastEvent
    });
    return;
  }
  
  window._lastMediaEvents.set(mediaKey, now);
  
  // Cleanup old entries to prevent memory leak
  if (window._lastMediaEvents.size > 100) {
    const cutoffTime = now - 60000; // 1 minute
    for (const [key, timestamp] of window._lastMediaEvents.entries()) {
      if (timestamp < cutoffTime) {
        window._lastMediaEvents.delete(key);
      }
    }
  }
  
  extensionStats.mediaStartEvents++;
  debugLog('MEDIA_START', `Media started in tab ${tabId}`, {
    mediaInfo: mediaInfo,
    tabInfo: {
      url: tab?.url,
      title: tab?.title,
      favIconUrl: tab?.favIconUrl
    },
    extensionEnabled: isExtensionEnabled,
    currentActiveTab: currentPlayingTab
  });
  
  // If extension is disabled, don't manage media
  if (!isExtensionEnabled) {
    debugLog('MEDIA_START', `Extension disabled, not storing tab ${tabId}`);
    return;
  }
  
  // Determine if we should pause the previous tab
  let shouldSetAsCurrentPlaying = true;
  
  if (currentPlayingTab && currentPlayingTab !== tabId) {
    const shouldPausePrevious = shouldPauseForNewMedia(currentPlayingTab, tabId, mediaInfo);
    
    if (shouldPausePrevious) {
      debugLog('MEDIA_START', `Pausing previous playing tab ${currentPlayingTab} for higher priority media`);
      pauseTabMedia(currentPlayingTab);
    } else {
      debugLog('MEDIA_START', `NOT pausing previous tab ${currentPlayingTab} - new media is lower priority`, {
        newMediaType: mediaInfo.type,
        currentTab: currentPlayingTab,
        newTab: tabId
      });
      shouldSetAsCurrentPlaying = false;
    }
  }
  
  // Handle case where tab info is unavailable
  const safeTab = tab || {
    url: mediaInfo?.src || 'Unknown URL',
    title: mediaInfo?.title || 'Unknown Title',
    favIconUrl: null
  };
  
  // Ensure tab is tracked in potential list even if it wasn't a known media site
  if (!potentialMediaTabs.has(tabId)) {
    addPotentialTab(tabId, safeTab.url, safeTab.title);
  }
  // Update potential tab status
  if (potentialMediaTabs.has(tabId)) {
    potentialMediaTabs.get(tabId).status = 'playing';
  }
  
  // Update the active media tabs
  activeMediaTabs.set(tabId, {
    url: safeTab.url,
    title: safeTab.title,
    mediaType: mediaInfo.type,
    timestamp: Date.now(),
    favicon: safeTab.favIconUrl,
    isPlaying: true,
    playbackRate: mediaInfo.playbackRate || 1.0
  });
  
  // Set this tab as the currently playing tab only if appropriate
  if (shouldSetAsCurrentPlaying) {
    currentPlayingTab = tabId;
    debugLog('MEDIA_START', `Tab ${tabId} set as current playing tab`);
  } else {
    debugLog('MEDIA_START', `Tab ${tabId} tracked but not set as current playing (lower priority)`);
  }
  
  debugLog('MEDIA_START', `Tab ${tabId} now actively playing`, {
    totalActiveTabs: activeMediaTabs.size,
    totalPotentialTabs: potentialMediaTabs.size,
    mediaType: mediaInfo.type,
    duration: mediaInfo.duration,
    isLivestream: mediaInfo.duration === Infinity
  });
  
  // Update extension badge
  updateBadge();
  
  // Notify popup of state change
  notifyPopupStateChange();
}

/**
 * Handle when media is paused in a tab
 */
function handleMediaPaused(tabId) {
  debugLog('MEDIA_PAUSE', `Media paused in tab ${tabId}`, {
    wasPotentialTab: potentialMediaTabs.has(tabId),
    wasActiveTab: activeMediaTabs.has(tabId),
    wasCurrentPlaying: currentPlayingTab === tabId
  });
  
  // Update potential tab status if it exists
  if (potentialMediaTabs.has(tabId)) {
    potentialMediaTabs.get(tabId).status = 'paused';
  }
  
  // Update active tab status
  if (activeMediaTabs.has(tabId)) {
    activeMediaTabs.get(tabId).isPlaying = false;
  }
  
  if (currentPlayingTab === tabId) {
    currentPlayingTab = null;
    debugLog('MEDIA_PAUSE', `Cleared current playing tab ${tabId}`);
  }
  
  updateBadge();
  
  // Notify popup of state change
  notifyPopupStateChange();
}

/**
 * Handle when media ends in a tab
 * FIXED: Don't remove tab when media ends - keep it tracked for potential replay
 */
function handleMediaEnded(tabId) {
  extensionStats.mediaEndEvents++;
  debugLog('MEDIA_END', `Media ended in tab ${tabId} - keeping tracked for replay`, {
    wasPotentialTab: potentialMediaTabs.has(tabId),
    wasActiveTab: activeMediaTabs.has(tabId),
    wasCurrentPlaying: currentPlayingTab === tabId
  });
  
  // Update potential tab status if it exists
  if (potentialMediaTabs.has(tabId)) {
    potentialMediaTabs.get(tabId).status = 'has_media'; // Media ended but still available
  }
  
  // Update active tab status but keep it tracked
  if (activeMediaTabs.has(tabId)) {
    activeMediaTabs.get(tabId).isPlaying = false;
  }
  
  // Clear the current playing tab to allow other tabs to play
  if (currentPlayingTab === tabId) {
    currentPlayingTab = null;
    debugLog('MEDIA_END', `Cleared currentPlayingTab ${tabId} - other tabs can now play`);
  }
  
  updateBadge();
  
  // Notify popup of state change
  notifyPopupStateChange();
}

/**
 * Pause media in a specific tab
 */
function pauseTabMedia(tabId) {
  if (!tabId) {
    debugLog('PAUSE_MEDIA', 'Cannot pause media - no tabId provided');
    return;
  }
  
  debugLog('PAUSE_MEDIA', `Attempting to pause media in tab ${tabId}`, {
    hasActiveTab: activeMediaTabs.has(tabId),
    isCurrentPlaying: currentPlayingTab === tabId
  });
  
  try {
    // Use Firefox API directly - returns a Promise
    const result = browser.tabs.sendMessage(tabId, {
      type: 'PAUSE_MEDIA'
    });
    
    result.then(response => {
      debugLog('PAUSE_MEDIA', `Successfully sent pause message to tab ${tabId}`, response);
    }).catch(error => {
      debugLog('PAUSE_MEDIA', `Failed to pause media in tab ${tabId} (keeping tracked)`, {
        error: error.message,
        reason: 'Tab may be suspended, backgrounded, or unresponsive'
      });
      // FIXED: Don't remove tab on communication failure - keep it tracked
      // In Firefox, tabs can be suspended or unresponsive but still contain media
    });
  } catch (error) {
    debugLog('PAUSE_MEDIA', `Failed to send pause message to tab ${tabId}`, {
      error: error.message,
      keepingTracked: true
    });
    extensionStats.errors++;
    // FIXED: Don't remove tab on communication failure - keep it tracked  
  }
}

/**
 * Set volume for media in a specific tab
 */
function setTabVolume(tabId, volume) {
  if (!tabId) {
    console.error('setTabVolume: tabId is required');
    return;
  }
  
  if (volume === undefined || volume === null) {
    console.error('setTabVolume: volume is required');
    return;
  }
  
  console.log(`Setting volume to ${volume} for tab ${tabId}`);
  
  try {
    // Use Firefox API directly
    const result = browser.tabs.sendMessage(tabId, {
      type: 'SET_VOLUME',
      volume: volume
    });
    
    result.then(response => {
      if (response && response.success) {
        console.log(`OneTab Media Firefox: Volume successfully set to ${response.volume} for tab ${tabId}`);
      } else {
        console.warn(`OneTab Media Firefox: Failed to set volume for tab ${tabId}:`, response?.error || 'Unknown error');
      }
    }).catch(error => {
      console.warn(`OneTab Media Firefox: Failed to set volume in tab ${tabId}:`, error.message);
    });
  } catch (error) {
    console.warn(`OneTab Media Firefox: Failed to send volume message to tab ${tabId}:`, error.message);
  }
}



/**
 * Update extension badge to show number of active media tabs
 */
function updateBadge() {
  // Show potential media tabs count (includes both monitored and active)
  const potentialCount = potentialMediaTabs.size;
  const badgeText = potentialCount > 0 ? potentialCount.toString() : '';
  
  // Badge color based on status
  let badgeColor = '#9CA3AF'; // Gray (disabled)
  if (isExtensionEnabled) {
    if (currentPlayingTab) {
      badgeColor = '#10B981'; // Green (playing)
    } else if (activeMediaTabs.size > 0) {
      badgeColor = '#F59E0B'; // Orange (has media)
    } else if (potentialCount > 0) {
      badgeColor = '#6B7280'; // Gray-blue (monitoring)
    }
  }
  
  try {
    // Use Firefox browserAction API directly (Manifest V2)
    browser.browserAction.setBadgeText({ text: badgeText });
    browser.browserAction.setBadgeBackgroundColor({ color: badgeColor });
  } catch (error) {
    console.warn('OneTab Media Firefox: Failed to update badge:', error.message);
  }
}

/**
 * Get current extension state (for popup)
 */
function getExtensionState() {
  // Combine potential and active tabs for display
  const allTabs = [];
  
  for (const [tabId, potentialInfo] of potentialMediaTabs.entries()) {
    const activeInfo = activeMediaTabs.get(tabId);
    const isPlaying = tabId === currentPlayingTab;
    
    allTabs.push({
      tabId,
      url: potentialInfo.url,
      title: potentialInfo.title,
      status: potentialInfo.status,
      timestamp: potentialInfo.timestamp,
      favicon: activeInfo?.favicon,
      mediaType: activeInfo?.mediaType || 'potential',
      isPlaying: isPlaying,
      hasActiveMedia: activeInfo !== undefined
    });
  }
  
  // Sort by status: playing > has_media > monitoring
  allTabs.sort((a, b) => {
    const order = { playing: 0, has_media: 1, paused: 2, monitoring: 3 };
    return order[a.status] - order[b.status];
  });
  
  return {
    activeTabs: allTabs, // Now shows ALL potential media tabs
    currentPlaying: currentPlayingTab,
    totalTabs: potentialMediaTabs.size,
    extensionEnabled: isExtensionEnabled
  };
}

/**
 * Notify popup of media state changes
 */
function notifyPopupStateChange() {
  // Try to send message to popup using Firefox API (if it's open)
  try {
    browser.runtime.sendMessage({
      type: 'MEDIA_STATE_CHANGED'
    }).catch(() => {
      // Popup is not open, ignore the error - normal in Firefox
    });
  } catch (error) {
    // Popup is not open or other error, ignore - normal behavior
  }
}

/**
 * Handle speed change notification from content script
 */
function handleSpeedChanged(tabId, speed, src) {
  extensionStats.speedChanges++;
  debugLog('SPEED_CHANGE', `Speed changed in tab ${tabId}`, {
    speed: speed,
    src: src,
    previousSpeed: activeMediaTabs.has(tabId) ? activeMediaTabs.get(tabId).playbackRate : 'unknown'
  });
  
  // Update the active media tab info if it exists
  if (activeMediaTabs.has(tabId)) {
    const tabInfo = activeMediaTabs.get(tabId);
    tabInfo.playbackRate = speed;
    tabInfo.lastSpeedChange = Date.now();
    activeMediaTabs.set(tabId, tabInfo);
    
    debugLog('SPEED_CHANGE', `Updated tab ${tabId} info with new speed`, {
      tabInfo: tabInfo
    });
  } else {
    debugLog('SPEED_CHANGE', `Tab ${tabId} not found in active media tabs`, {
      activeTabsCount: activeMediaTabs.size
    });
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
    await browser.tabs.sendMessage(tabId, {
      type: 'SET_SPEED',
      speed: speed
    });
    console.log(`OneTab Media Firefox: Set speed to ${speed} for tab ${tabId}`);
  } catch (error) {
    console.warn(`OneTab Media Firefox: Failed to set speed for tab ${tabId}:`, error.message);
  }
}

/**
 * Send speed action to a specific tab
 */
async function sendSpeedActionToTab(tabId, action, value) {
  try {
    await browser.tabs.sendMessage(tabId, {
      type: 'SPEED_ACTION',
      action: action,
      value: value
    });
    console.log(`OneTab Media Firefox: Sent speed action ${action} to tab ${tabId}`);
  } catch (error) {
    console.warn(`OneTab Media Firefox: Failed to send speed action to tab ${tabId}:`, error.message);
  }
}

/**
 * Get speed settings from storage
 */
async function getSpeedSettings() {
  try {
    const result = await StorageManager.get([
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
      'theme',
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
      theme: result.theme || defaultSettings.theme,
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
    if (settings.theme !== undefined) updates.theme = settings.theme;
    
    // Legacy support
    if (settings.videoSpeedSettings !== undefined) updates.videoSpeedSettings = settings.videoSpeedSettings;
    if (settings.videoSpeedEnabled !== undefined) updates.videoSpeedEnabled = settings.videoSpeedEnabled;
    if (settings.lastSpeed !== undefined) {
      updates.lastSpeed = settings.lastSpeed;
      updates.speed = settings.lastSpeed; // Sync with new speed setting
    }
    
    await StorageManager.set(updates);
    console.log('OneTab Media: Speed settings updated with enhanced persistence:', updates);
    
    // Broadcast settings update to all content scripts
    broadcastSettingsUpdate(updates);
  } catch (error) {
    console.error('OneTab Media: Failed to update speed settings:', error);
  }
}

/**
 * Broadcast settings updates to all content scripts
 */
async function broadcastSettingsUpdate(settings) {
  try {
    // Use Firefox API with async/await for better error handling
    const tabs = await browser.tabs.query({});
    
    console.log(`OneTab Media Firefox: Broadcasting settings update to ${tabs.length} tabs`);
    
    for (const tab of tabs) {
      try {
        await browser.tabs.sendMessage(tab.id, {
          type: 'SETTINGS_UPDATED',
          settings: settings
        });
      } catch (error) {
        // Ignore errors for tabs without content scripts - normal in Firefox
        // This happens for system pages, about:, etc.
      }
    }
  } catch (error) {
    console.warn('OneTab Media Firefox: Failed to broadcast settings update:', error.message);
  }
}

/**
 * Set up periodic cleanup to verify tabs are still valid
 * ULTRA-CONSERVATIVE: Never removes any tabs during cleanup - read-only monitoring
 * Only browser-initiated events (tab close, navigation) can remove tracked tabs
 * This ensures livestreams and suspended tabs are never accidentally removed
 */
function setupPeriodicCleanup() {
  // Run cleanup every 3 hours - read-only check, no tabs removed
  setInterval(async () => {
    try {
      debugLog('CLEANUP', 'Starting ultra-conservative media tab check (read-only)', {
        activeTabsCount: activeMediaTabs.size,
        potentialTabsCount: potentialMediaTabs.size,
        uptime: Date.now() - extensionStartTime
      });
      
      const tabsToRemove = [];
      let tabsChecked = 0;
      let tabsKept = 0;
      
      // Check each tracked tab
      for (const [tabId, tabInfo] of activeMediaTabs.entries()) {
        tabsChecked++;
        try {
          // Verify tab still exists and is accessible using Firefox API
          const tab = await browser.tabs.get(tabId);
          
          // NEVER remove tabs during cleanup - too risky for livestreams
          // Even if tab is null, it might just be a temporary state
          // Let tabs be cleaned up only when browser explicitly tells us they're closed
          if (!tab) {
            console.log(`Tab ${tabId} returned null but keeping tracked for safety (could be temporary state)`);
            tabsKept++;
            continue;
          }
          
          // DISABLED: URL hostname check - too risky for livestreams and complex sites
          // Livestreams and video sites often change URLs during playback
          // Let other mechanisms handle navigation cleanup
          if (tab.url && tabInfo.url) {
            try {
              const currentHostname = new URL(tab.url).hostname;
              const trackedHostname = new URL(tabInfo.url).hostname;
              
              // Log URL changes but don't remove tabs based on them
              if (currentHostname !== trackedHostname) {
                console.log(`Tab ${tabId} URL changed from ${trackedHostname} to ${currentHostname} but keeping tracked for safety`);
              }
            } catch (urlError) {
              // URL parsing error, keep the tab tracked
              console.log(`URL parsing error for tab ${tabId}, keeping in tracking for safety`);
            }
          }
          
          // LIVESTREAM-FRIENDLY: Never remove tabs based on communication state
          // Suspended tabs, livestreams, and background tabs often can't respond to messages
          // Update timestamp to show tab is still being tracked
          tabInfo.timestamp = Date.now();
          
          // Don't ping tabs for media state - this can cause issues with livestreams
          // Just log that we're keeping the tab tracked
          tabsKept++;
          debugLog('CLEANUP', `Tab ${tabId} remains tracked - livestream-friendly policy`, {
            url: tabInfo.url,
            mediaType: tabInfo.mediaType,
            ageMinutes: Math.round((Date.now() - tabInfo.timestamp) / 60000)
          });
          
        } catch (tabError) {
          // Tab access failed - but don't remove! Could be temporary permission issue
          // Livestreams and suspended tabs often cause access errors
          debugLog('CLEANUP', `Tab ${tabId} access failed but keeping tracked for safety`, {
            error: tabError.message,
            tabInfo: tabInfo
          });
          tabsKept++;
          // Keep the tab tracked - better safe than sorry
        }
      }
      
      // Also clean up potential media tabs - but be conservative
      for (const [tabId, tabInfo] of potentialMediaTabs.entries()) {
        try {
          const tab = await browser.tabs.get(tabId);
          if (!tab) {
            // Don't remove - could be temporary state
            console.log(`Potential media tab ${tabId} returned null but keeping tracked for safety`);
          }
        } catch (tabError) {
          // Don't remove - could be permission issue or temporary error
          console.log(`Potential media tab ${tabId} access failed but keeping tracked for safety`);
        }
      }
      
      // No tabs are removed during cleanup - only browser-initiated events remove tabs
      // This ensures livestreams and other important media are never accidentally removed
      let removedCount = 0; // Always 0 now - cleanup is read-only
      
      debugLog('CLEANUP', 'Conservative cleanup completed - no tabs removed', {
        tabsChecked: tabsChecked,
        tabsKept: tabsKept,
        tabsRemoved: removedCount,
        finalActiveTabsCount: activeMediaTabs.size,
        finalPotentialTabsCount: potentialMediaTabs.size
      });
      
      if (removedCount > 0) {
        updateBadge();
        notifyPopupStateChange();
      }
      
    } catch (error) {
      debugLog('CLEANUP', 'Error during cleanup', { error: error.message });
      extensionStats.errors++;
    }
  }, 3 * 60 * 60 * 1000); // Every 3 hours - read-only check
  
  debugLog('CLEANUP', 'Ultra-conservative cleanup scheduled (every 3 hours, read-only, no tabs removed)');
}

// Initialize when background script loads
initializeExtension();

// Detect background script suspension
window.addEventListener('beforeunload', () => {
  debugLog('SUSPENSION', 'Background script being suspended/unloaded');
  isBackgroundScriptSuspended = true;
});

// Log that we're starting up
debugLog('SCRIPT_LOAD', 'Background script loaded and starting initialization');

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