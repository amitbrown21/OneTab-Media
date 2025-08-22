/**
 * UME - Ultimate Media Extension - Background Script (Complete Redesign)
 * Clean, robust tab monitoring and media management system
 * Senior developer approach with proper separation of concerns
 */

// ============================================================================
// CORE BROWSER API AND LOGGING
// ============================================================================

const browserAPI = (() => {
  if (typeof browser !== 'undefined' && browser.runtime) return browser;
  if (typeof chrome !== 'undefined' && chrome.runtime) return chrome;
  throw new Error('Browser extension API not available');
})();

const log = {
  info: (msg, data) => console.log(`[UME-BACKGROUND] ${msg}`, data || ''),
  warn: (msg, data) => console.warn(`[UME-BACKGROUND] ${msg}`, data || ''),
  error: (msg, data) => console.error(`[UME-BACKGROUND] ${msg}`, data || '')
};

// ============================================================================
// STORAGE MANAGER
// ============================================================================

class StorageManager {
  static async get(keys) {
    try {
      const result = await browserAPI.storage.sync.get(keys);
      if (Object.keys(result).length === 0) {
        // Fallback to local storage
        return await browserAPI.storage.local.get(keys) || {};
      }
      return result;
    } catch (error) {
      log.warn('Sync storage failed, using local', { error: error.message });
      return await browserAPI.storage.local.get(keys) || {};
    }
  }
  
  static async set(items) {
    try {
      await browserAPI.storage.sync.set(items);
      // Also backup to local
      await browserAPI.storage.local.set(items);
      return true;
    } catch (error) {
      log.warn('Sync storage failed, using local only', { error: error.message });
      await browserAPI.storage.local.set(items);
      return false;
    }
  }
}

// ============================================================================
// SETTINGS MANAGER
// ============================================================================

class SettingsManager {
  constructor() {
    this.settings = this.getDefaultSettings();
    this.loaded = false;
  }
  
  getDefaultSettings() {
          return {
        extensionEnabled: true,
        enabled: true,
        showController: true,
        startHidden: false,
        rememberSpeed: true,
        forceLastSavedSpeed: false,
        audioBoolean: true,
        controllerOpacity: 0.8,
        speed: 1.0, // Default speed for new videos (only changed in options)
        lastSpeed: 1.0, // Last used speed (updated when videos change speed)
        keyBindings: [
          { action: 'display', key: 86, value: 0, force: false },
          { action: 'slower', key: 83, value: 0.1, force: false },
          { action: 'faster', key: 68, value: 0.1, force: false },
          { action: 'rewind', key: 90, value: 10, force: false },
          { action: 'advance', key: 88, value: 10, force: false },
          { action: 'reset', key: 82, value: 1.0, force: false },
          { action: 'fast', key: 71, value: 1.8, force: false }
        ],
        blacklist: 'www.instagram.com\ntwitter.com\nimgur.com\nteams.microsoft.com',
        volumeBoosterEnabled: true,
        globalVolume: 1.0,
        perDomainVolume: {},
        volumeBoostLimit: 5.0,
        speeds: {}, // Per-video speed storage
        markers: {} // Video bookmarks
      };
  }
  
  async load() {
    try {
      const keys = Object.keys(this.getDefaultSettings());
      const result = await StorageManager.get(keys);
      this.settings = { ...this.getDefaultSettings(), ...result };
      this.loaded = true;
      log.info('Settings loaded successfully');
    } catch (error) {
      log.error('Failed to load settings, using defaults', { error: error.message });
      this.settings = this.getDefaultSettings();
      this.loaded = true;
    }
  }
  
  async save() {
    try {
      await StorageManager.set(this.settings);
      log.info('Settings saved successfully');
    } catch (error) {
      log.error('Failed to save settings', { error: error.message });
    }
  }
  
  get(key) { return this.settings[key]; }
  set(key, value) { this.settings[key] = value; }
  update(updates) { Object.assign(this.settings, updates); }
}

// ============================================================================
// MEDIA SITE DETECTOR
// ============================================================================

class MediaSiteDetector {
  constructor() {
    this.mediaSites = [
      // Global video platforms
      'youtube.com', 'youtu.be', 'youtube-nocookie.com', 'vimeo.com', 'dailymotion.com', 
      'twitch.tv', 'kick.com', 'rumble.com', 'odysee.com',
      // Streaming services
      'netflix.com', 'hulu.com', 'primevideo.com', 'amazon.com', 'disneyplus.com',
      'hbomax.com', 'max.com', 'paramountplus.com', 'peacocktv.com', 'apple.com',
      // Music platforms
      'spotify.com', 'soundcloud.com', 'bandcamp.com', 'deezer.com', 'tidal.com',
      'pandora.com', 'music.apple.com',
      // Social with media
      'facebook.com', 'fb.watch', 'instagram.com', 'tiktok.com', 'reddit.com', 'twitter.com',
      // Other media sites
      'crunchyroll.com', 'funimation.com', 'plex.tv', 'jellyfin.org', 'emby.media'
    ];
  }
  
  isMediaSite(url) {
    if (!url) return false;
    
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return this.mediaSites.some(site => {
        return hostname === site || hostname.endsWith('.' + site);
      });
    } catch {
      return false;
    }
  }
}

// ============================================================================
// TAB MANAGER (COMPLETE REDESIGN)
// ============================================================================

class TabManager {
  constructor(settings) {
    this.settings = settings;
    this.detector = new MediaSiteDetector();
    this.tabs = new Map(); // tabId -> TabInfo
    this.currentPlayingTab = null;
    this.cleanupTimer = null;
    
    this.init();
  }
  
  init() {
    log.info('Tab manager initializing');
    
    // Setup tab event listeners
    this.setupTabListeners();
    
    // Setup periodic cleanup
    this.setupCleanup();
    
    // Scan existing tabs
    this.scanExistingTabs();
    
    log.info('Tab manager initialized');
  }
  
  setupTabListeners() {
    // New tabs
    browserAPI.tabs.onCreated.addListener((tab) => {
      if (this.settings.get('extensionEnabled') && tab.url && this.detector.isMediaSite(tab.url)) {
        this.addTab(tab.id, tab.url, tab.title, 'potential');
      }
    });
    
    // Tab updates (URL changes)
    browserAPI.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (!this.settings.get('extensionEnabled')) return;
      
      if (changeInfo.url) {
        // URL changed - remove old tracking and add new if it's a media site
        this.removeTab(tabId);
        
        if (this.detector.isMediaSite(changeInfo.url)) {
          this.addTab(tabId, changeInfo.url, tab.title, 'potential');
        }
      }
      
      // Tab finished loading - check for media
      if (changeInfo.status === 'complete' && this.tabs.has(tabId)) {
        setTimeout(() => this.checkTabForMedia(tabId), 500);
      }
    });
    
    // Tab closed
    browserAPI.tabs.onRemoved.addListener((tabId) => {
      this.removeTab(tabId);
    });
  }
  
  async scanExistingTabs() {
    try {
      const tabs = await browserAPI.tabs.query({});
      log.info('Scanning existing tabs', { count: tabs.length });
      
      for (const tab of tabs) {
        if (tab.url && this.detector.isMediaSite(tab.url)) {
          this.addTab(tab.id, tab.url, tab.title, 'potential');
        }
      }
      
      // Check for media in all tracked tabs
      setTimeout(() => {
        this.tabs.forEach((tabInfo, tabId) => {
          this.checkTabForMedia(tabId);
        });
      }, 1000);
      
    } catch (error) {
      log.error('Failed to scan existing tabs', { error: error.message });
    }
  }
  
  addTab(tabId, url, title, status = 'potential') {
    const tabInfo = {
      id: tabId,
      url: url,
      title: title || 'Unknown Title',
      status: status, // potential, has_media, playing, paused
      mediaType: null,
      timestamp: Date.now(),
      lastActivity: Date.now(),
      playbackRate: 1.0
    };
    
    this.tabs.set(tabId, tabInfo);
    this.updateBadge();
    this.notifyPopupStateChange();
    
    log.info('Tab added to tracking', { tabId, url: url, status });
  }
  
  removeTab(tabId) {
    const tabInfo = this.tabs.get(tabId);
    if (!tabInfo) return;
    
    this.tabs.delete(tabId);
    
    // Clear current playing tab if it's this one
    if (this.currentPlayingTab === tabId) {
      this.currentPlayingTab = null;
    }
    
    this.updateBadge();
    this.notifyPopupStateChange();
    
    log.info('Tab removed from tracking', { tabId, url: tabInfo.url });
  }
  
  async checkTabForMedia(tabId) {
    try {
      const response = await browserAPI.tabs.sendMessage(tabId, {
        type: 'CHECK_FOR_MEDIA'
      });
      
      if (response && response.hasMedia) {
        const tabInfo = this.tabs.get(tabId);
        if (tabInfo) {
          // CRITICAL FIX: Check if any media is actively playing
          if (response.hasPlayingMedia) {
            tabInfo.status = 'playing';
            this.currentPlayingTab = tabId;
            log.info('Found actively playing media in tab', { tabId, activeCount: response.activeCount });
          } else {
            tabInfo.status = 'has_media';
          }
          
          tabInfo.lastActivity = Date.now();
          this.notifyPopupStateChange();
          this.updateBadge();
          
          log.info('Media detected in tab', { 
            tabId, 
            mediaCount: response.mediaCount,
            activeCount: response.activeCount,
            status: tabInfo.status
          });
        }
      }
    } catch (error) {
      // Tab not ready or content script not loaded - this is normal
      log.info('Could not check tab for media (normal for new tabs)', { tabId });
    }
  }
  
  handleMediaStarted(tabId, mediaInfo) {
    const tabInfo = this.tabs.get(tabId);
    if (!tabInfo) {
      // Add tab if not tracked (content script found media on non-media site)
      try {
        browserAPI.tabs.get(tabId).then(tab => {
          if (tab) {
            this.addTab(tabId, tab.url, tab.title, 'playing');
            const newTabInfo = this.tabs.get(tabId);
            if (newTabInfo) {
              newTabInfo.mediaType = mediaInfo.type;
              newTabInfo.playbackRate = mediaInfo.playbackRate || 1.0;
            }
          }
        });
      } catch (error) {
        log.warn('Failed to get tab info for new media', { tabId });
      }
    } else {
      tabInfo.status = 'playing';
      tabInfo.mediaType = mediaInfo.type;
      tabInfo.playbackRate = mediaInfo.playbackRate || 1.0;
      tabInfo.lastActivity = Date.now();
    }
    
    // Handle auto-pause logic
    this.handleNewMediaPlaying(tabId, mediaInfo);
    
    this.updateBadge();
    this.notifyPopupStateChange();
    
    log.info('Media started in tab', { tabId, mediaType: mediaInfo.type });
  }
  
  handleMediaPaused(tabId) {
    const tabInfo = this.tabs.get(tabId);
    if (tabInfo) {
      tabInfo.status = 'paused';
      tabInfo.lastActivity = Date.now();
    }
    
    if (this.currentPlayingTab === tabId) {
      this.currentPlayingTab = null;
    }
    
    this.updateBadge();
    this.notifyPopupStateChange();
    
    log.info('Media paused in tab', { tabId });
  }
  
  handleMediaEnded(tabId) {
    const tabInfo = this.tabs.get(tabId);
    if (tabInfo) {
      tabInfo.status = 'has_media'; // Keep tracked but mark as not playing
      tabInfo.lastActivity = Date.now();
    }
    
    if (this.currentPlayingTab === tabId) {
      this.currentPlayingTab = null;
    }
    
    this.updateBadge();
    this.notifyPopupStateChange();
    
    log.info('Media ended in tab', { tabId });
  }
  
  handleSpeedChanged(tabId, speed, src) {
    const tabInfo = this.tabs.get(tabId);
    if (tabInfo) {
      tabInfo.playbackRate = speed;
      tabInfo.lastActivity = Date.now();
      this.notifyPopupStateChange();
    }
    
    log.info('Speed changed in tab', { tabId, speed });
  }
  
  handleNewMediaPlaying(tabId, mediaInfo) {
    // Simple auto-pause logic: pause previous playing tab if different
    if (this.currentPlayingTab && this.currentPlayingTab !== tabId) {
      this.pauseTab(this.currentPlayingTab);
    }
    
    this.currentPlayingTab = tabId;
  }
  
  async pauseTab(tabId) {
    try {
      await browserAPI.tabs.sendMessage(tabId, { type: 'PAUSE_MEDIA' });
      log.info('Tab paused', { tabId });
    } catch (error) {
      log.warn('Failed to pause tab', { tabId, error: error.message });
    }
  }
  
  async setTabVolume(tabId, volume) {
    try {
      const response = await browserAPI.tabs.sendMessage(tabId, { 
        type: 'SET_VOLUME', 
        volume: volume 
      });
      
      if (response && response.success) {
        log.info('Tab volume set', { tabId, volume });
      } else {
        log.warn('Failed to set tab volume', { tabId, error: response?.error });
      }
    } catch (error) {
      log.warn('Failed to send volume message to tab', { tabId, error: error.message });
    }
  }
  
  async setTabSpeed(tabId, speed) {
    try {
      await browserAPI.tabs.sendMessage(tabId, { 
        type: 'SET_SPEED', 
        speed: speed 
      });
      log.info('Tab speed set', { tabId, speed });
    } catch (error) {
      log.warn('Failed to set tab speed', { tabId, error: error.message });
    }
  }
  
  setupCleanup() {
    // Clean up stale tabs every 10 minutes
    this.cleanupTimer = setInterval(() => {
      this.cleanupStaleTabs();
    }, 10 * 60 * 1000);
  }
  
  async cleanupStaleTabs() {
    const now = Date.now();
    const staleThreshold = 30 * 60 * 1000; // 30 minutes
    const tabsToRemove = [];
    
    for (const [tabId, tabInfo] of this.tabs.entries()) {
      // Only remove tabs that are old and haven't had activity
      if (now - tabInfo.lastActivity > staleThreshold) {
        try {
          // Verify tab still exists
          await browserAPI.tabs.get(tabId);
          // Tab exists but is stale, leave it for now
        } catch (error) {
          // Tab no longer exists
          tabsToRemove.push(tabId);
        }
      }
    }
    
    // Remove non-existent tabs
    tabsToRemove.forEach(tabId => this.removeTab(tabId));
    
    if (tabsToRemove.length > 0) {
      log.info('Cleaned up stale tabs', { count: tabsToRemove.length });
    }
  }
  
  getState() {
    const activeTabs = Array.from(this.tabs.values()).map(tabInfo => ({
      tabId: tabInfo.id,
      url: tabInfo.url,
      title: tabInfo.title,
      status: tabInfo.status,
      mediaType: tabInfo.mediaType || 'potential',
      isPlaying: tabInfo.status === 'playing',
      hasActiveMedia: ['playing', 'paused', 'has_media'].includes(tabInfo.status),
      playbackRate: tabInfo.playbackRate,
      timestamp: tabInfo.timestamp
    }));
    
    // Sort by status priority: playing > has_media > paused > potential
    activeTabs.sort((a, b) => {
      const statusOrder = { playing: 0, has_media: 1, paused: 2, potential: 3 };
      return statusOrder[a.status] - statusOrder[b.status];
    });
    
    return {
      activeTabs,
      currentPlaying: this.currentPlayingTab,
      totalTabs: this.tabs.size,
      extensionEnabled: this.settings.get('extensionEnabled')
    };
  }
  
  updateBadge() {
    const tabCount = this.tabs.size;
    const badgeText = tabCount > 0 ? tabCount.toString() : '';
    
    let badgeColor = '#9CA3AF'; // Gray (disabled)
    if (this.settings.get('extensionEnabled')) {
      if (this.currentPlayingTab) {
        badgeColor = '#10B981'; // Green (playing)
      } else if (Array.from(this.tabs.values()).some(t => t.status === 'has_media')) {
        badgeColor = '#F59E0B'; // Orange (has media)
      } else if (tabCount > 0) {
        badgeColor = '#6B7280'; // Gray-blue (monitoring)
      }
    }
    
    try {
      browserAPI.browserAction.setBadgeText({ text: badgeText });
      browserAPI.browserAction.setBadgeBackgroundColor({ color: badgeColor });
    } catch (error) {
      log.warn('Failed to update badge', { error: error.message });
    }
  }
  
  notifyPopupStateChange() {
    try {
      browserAPI.runtime.sendMessage({
        type: 'MEDIA_STATE_CHANGED'
      }).catch(() => {
        // Popup not open, ignore
      });
    } catch (error) {
      // Popup not open, ignore
    }
  }
  
  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    this.tabs.clear();
    this.currentPlayingTab = null;
    
    log.info('Tab manager destroyed');
  }
}

// ============================================================================
// MESSAGE HANDLER
// ============================================================================

class MessageHandler {
  constructor(tabManager, settings) {
    this.tabManager = tabManager;
    this.settings = settings;
    
    this.init();
  }
  
  init() {
    browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
      const tabId = sender.tab?.id;
      
      // Handle synchronous messages
      switch (message.type) {
        case 'GET_ACTIVE_TABS':
          const state = this.tabManager.getState();
          sendResponse(state);
          return false;
          
        case 'MEDIA_PAUSED':
          this.tabManager.handleMediaPaused(tabId);
          sendResponse({ success: true });
          return false;
          
        case 'MEDIA_ENDED':
          this.tabManager.handleMediaEnded(tabId);
          sendResponse({ success: true });
          return false;
          
        case 'PAUSE_TAB':
          this.tabManager.pauseTab(message.tabId);
          sendResponse({ success: true });
          return false;
          
        case 'SET_VOLUME':
          this.tabManager.setTabVolume(message.tabId, message.volume);
          sendResponse({ success: true });
          return false;
          
        case 'SPEED_CHANGED':
          this.tabManager.handleSpeedChanged(tabId, message.speed, message.src);
          sendResponse({ success: true });
          return false;
          
        case 'SET_TAB_SPEED':
          this.tabManager.setTabSpeed(message.tabId, message.speed);
          sendResponse({ success: true });
          return false;
          
        case 'EXTENSION_TOGGLE':
          this.handleExtensionToggle(message.enabled);
          sendResponse({ success: true });
          return false;
      }
      
      // Handle async messages
      this.handleAsyncMessage(message, sender, sendResponse);
      return true; // Keep message channel open
    });
  }
  
  async handleAsyncMessage(message, sender, sendResponse) {
    const tabId = sender.tab?.id;
    
    try {
      switch (message.type) {
        case 'MEDIA_STARTED':
          this.tabManager.handleMediaStarted(tabId, message.mediaInfo);
          sendResponse({ success: true });
          break;
          
        case 'GET_SPEED_SETTINGS':
          const settings = await this.getSpeedSettings();
          sendResponse(settings);
          break;
          
        case 'UPDATE_SPEED_SETTINGS':
          await this.updateSpeedSettings(message.settings);
          sendResponse({ success: true });
          break;
          
        case 'BROADCAST_SETTINGS_UPDATE':
          await this.broadcastSettingsUpdate(message.settings);
          sendResponse({ success: true });
          break;
          
        default:
          log.warn('Unknown message type', { type: message.type });
          sendResponse({ error: 'Unknown message type' });
      }
    } catch (error) {
      log.error('Error handling async message', { type: message.type, error: error.message });
      sendResponse({ error: error.message });
    }
  }
  
  async handleExtensionToggle(enabled) {
    this.settings.set('extensionEnabled', enabled);
    this.settings.set('enabled', enabled); // Legacy compatibility
    await this.settings.save();
    
    if (!enabled && this.tabManager.currentPlayingTab) {
      this.tabManager.currentPlayingTab = null;
    }
    
    this.tabManager.updateBadge();
    this.tabManager.notifyPopupStateChange();
    
    log.info('Extension toggled', { enabled });
  }
  
  async getSpeedSettings() {
    const settings = this.settings.settings;
    
    return {
      enabled: settings.enabled !== false,
      showController: settings.showController !== false,
      startHidden: settings.startHidden || false,
      rememberSpeed: settings.rememberSpeed || false,
      forceLastSavedSpeed: settings.forceLastSavedSpeed || false,
      controllerOpacity: settings.controllerOpacity || 0.8,
      speed: settings.speed || 1.0, // Default speed (for new videos)
      lastSpeed: settings.lastSpeed || 1.0, // Last used speed (for remember feature)
      keyBindings: settings.keyBindings || [],
      blacklist: settings.blacklist || '',
      speeds: settings.speeds || {}, // Per-video speeds
      markers: settings.markers || {}
    };
  }
  
  async updateSpeedSettings(newSettings) {
    // CRITICAL: Only allow certain settings to be updated from content scripts
    // Default speed (speed) should only be changed from options page, not from video speed changes
    const allowedFromContent = ['lastSpeed', 'speeds', 'markers'];
    const filteredSettings = {};
    
    Object.keys(newSettings).forEach(key => {
      if (allowedFromContent.includes(key) || !newSettings.hasOwnProperty('speed')) {
        // Allow all settings if 'speed' is not being updated (options page)
        // Or allow only specific settings if it's from content script
        filteredSettings[key] = newSettings[key];
      }
    });
    
    // If this update includes 'speed' but not from options page, ignore it
    if (newSettings.speed && allowedFromContent.some(key => newSettings.hasOwnProperty(key))) {
      log.warn('Ignoring attempt to update default speed from content script');
      delete filteredSettings.speed;
    }
    
    this.settings.update(filteredSettings);
    await this.settings.save();
    
    // Broadcast to content scripts
    await this.broadcastSettingsUpdate(filteredSettings);
    
    log.info('Speed settings updated', { 
      keys: Object.keys(filteredSettings),
      fromOptions: !allowedFromContent.some(key => newSettings.hasOwnProperty(key))
    });
  }
  
  async broadcastSettingsUpdate(settings) {
    try {
      const tabs = await browserAPI.tabs.query({});
      
      for (const tab of tabs) {
        try {
          await browserAPI.tabs.sendMessage(tab.id, {
            type: 'SETTINGS_UPDATED',
            settings: settings
          });
        } catch (error) {
          // Content script not loaded or tab not ready - ignore
        }
      }
      
      log.info('Settings update broadcasted', { tabCount: tabs.length });
    } catch (error) {
      log.warn('Failed to broadcast settings update', { error: error.message });
    }
  }
}

// ============================================================================
// BACKGROUND SCRIPT INITIALIZATION
// ============================================================================

class BackgroundScript {
  constructor() {
    this.settings = new SettingsManager();
    this.tabManager = null;
    this.messageHandler = null;
    this.initialized = false;
  }
  
  async init() {
    try {
      log.info('Background script initializing');
      
      // Load settings
      await this.settings.load();
      
      // Ensure default settings exist
      await this.ensureDefaultSettings();
      
      // Initialize tab manager
      this.tabManager = new TabManager(this.settings);
      
      // Initialize message handler
      this.messageHandler = new MessageHandler(this.tabManager, this.settings);
      
      // Setup browser event listeners
      this.setupBrowserListeners();
      
      this.initialized = true;
      log.info('Background script initialized successfully');
      
    } catch (error) {
      log.error('Background script initialization failed', { error: error.message });
    }
  }
  
  async ensureDefaultSettings() {
    try {
      // Check if this is a fresh install
      const initCheck = await StorageManager.get(['settingsInitialized', 'settingsVersion']);
      const isFreshInstall = !initCheck.settingsInitialized;
      
      if (isFreshInstall) {
        log.info('Setting up defaults for fresh install');
        const defaultsWithMeta = {
          ...this.settings.getDefaultSettings(),
          settingsVersion: '4.0',
          settingsInitialized: true,
          installDate: new Date().toISOString()
        };
        
        await StorageManager.set(defaultsWithMeta);
        log.info('Default settings applied successfully');
      } else {
        // Ensure any missing settings are set to defaults
        const defaults = this.settings.getDefaultSettings();
        const current = await StorageManager.get(Object.keys(defaults));
        
        const updates = {};
        for (const [key, defaultValue] of Object.entries(defaults)) {
          if (current[key] === undefined) {
            updates[key] = defaultValue;
          }
        }
        
        if (Object.keys(updates).length > 0) {
          log.info('Adding missing default settings', { keys: Object.keys(updates) });
          await StorageManager.set(updates);
        }
      }
    } catch (error) {
      log.error('Failed to ensure default settings', { error: error.message });
    }
  }
  
  setupBrowserListeners() {
    // Handle browser startup
    browserAPI.runtime.onStartup.addListener(() => {
      log.info('Browser startup detected');
      // Reinitialize if needed
    });
    
    // Handle extension install/update
    browserAPI.runtime.onInstalled.addListener((details) => {
      log.info('Extension installed/updated', { 
        reason: details.reason,
        previousVersion: details.previousVersion 
      });
    });
  }
  
  destroy() {
    if (this.tabManager) {
      this.tabManager.destroy();
      this.tabManager = null;
    }
    
    this.messageHandler = null;
    this.initialized = false;
    
    log.info('Background script destroyed');
  }
}

// ============================================================================
// STARTUP
// ============================================================================

const backgroundScript = new BackgroundScript();

// Initialize immediately
backgroundScript.init();

// Handle script unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    backgroundScript.destroy();
  });
}

log.info('UME Background Script loaded');

// Export for testing purposes
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { backgroundScript, TabManager, MessageHandler, StorageManager };
}
