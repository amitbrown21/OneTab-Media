/**
 * UME - Ultimate Media Extension - Content Script (Complete Redesign)
 * Clean, maintainable media detection and speed control system
 * Senior developer approach with proper separation of concerns
 */

(function() {
  'use strict';
  
  // Prevent multiple injections
  if (window.umeContentScriptLoaded) return;
  window.umeContentScriptLoaded = true;
  
  // ============================================================================
  // CORE BROWSER API AND LOGGING
  // ============================================================================
  
  const browserAPI = (() => {
    if (typeof browser !== 'undefined' && browser.runtime) return browser;
    if (typeof chrome !== 'undefined' && chrome.runtime) return chrome;
    throw new Error('Browser extension API not available');
  })();
  
  const log = {
    info: (msg, data) => console.log(`[UME-CONTENT] ${msg}`, data || ''),
    warn: (msg, data) => console.warn(`[UME-CONTENT] ${msg}`, data || ''),
    error: (msg, data) => console.error(`[UME-CONTENT] ${msg}`, data || '')
  };
  
  // ============================================================================
  // STORAGE AND SETTINGS MANAGER
  // ============================================================================
  
  class StorageManager {
    static async get(keys) {
      try {
        const result = await browserAPI.storage.sync.get(keys);
        if (Object.keys(result).length === 0) {
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
        await browserAPI.storage.local.set(items);
        return true;
      } catch (error) {
        log.warn('Sync storage failed, using local only', { error: error.message });
        await browserAPI.storage.local.set(items);
        return false;
      }
    }
  }
  
  class SettingsManager {
    constructor() {
      this.settings = this.getDefaultSettings();
      this.loaded = false;
    }
    
    getDefaultSettings() {
      return {
        enabled: true,
        showController: true,
        startHidden: false,
        rememberSpeed: true,
        forceLastSavedSpeed: false,
        audioBoolean: true,
        controllerOpacity: 0.8,
        speed: 1.0, // Default speed for new videos (set only in options)
        lastSpeed: 1.0, // Last used speed (for remember speed feature)
        keyBindings: [
          { action: 'display', key: 86, value: 0, force: false },     // V
          { action: 'slower', key: 83, value: 0.1, force: false },   // S
          { action: 'faster', key: 68, value: 0.1, force: false },   // D
          { action: 'rewind', key: 90, value: 10, force: false },     // Z
          { action: 'advance', key: 88, value: 10, force: false },    // X
          { action: 'reset', key: 82, value: 1.0, force: false },     // R
          { action: 'fast', key: 71, value: 1.8, force: false }       // G
        ],
        blacklist: 'www.instagram.com\ntwitter.com\nimgur.com\nteams.microsoft.com',
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
    
    isBlacklisted(url) {
      if (!this.settings.blacklist) return false;
      
      const blacklistItems = this.settings.blacklist.split('\n').map(item => item.trim()).filter(item => item);
      const hostname = new URL(url).hostname.toLowerCase();
      
      return blacklistItems.some(item => {
        const blacklistedHost = item.toLowerCase();
        return hostname === blacklistedHost || hostname.endsWith('.' + blacklistedHost);
      });
    }
  }
  
  // ============================================================================
  // SPEED CONTROLLER (COMPLETE REDESIGN)
  // ============================================================================
  
  class SpeedController {
    constructor(mediaElement, settings) {
      this.media = mediaElement;
      this.settings = settings;
      this.container = null;
      this.shadowRoot = null;
      this.isInitialized = false;
      this.currentSpeed = 1.0;
      
      this.init();
    }
    
    init() {
      try {
        if (!this.settings.get('showController')) return;
        
        this.createController();
        this.attachEventListeners();
        this.restoreSpeed();
        this.isInitialized = true;
        
        log.info('Speed controller initialized', { 
          mediaType: this.media.tagName,
          src: this.media.src || this.media.currentSrc 
        });
      } catch (error) {
        log.error('Failed to initialize speed controller', { error: error.message });
      }
    }
    
    createController() {
      // Create container with shadow DOM
      this.container = document.createElement('div');
      this.container.className = 'ume-speed-controller';
      this.shadowRoot = this.container.attachShadow({ mode: 'open' });
      
      // Add styles
      const style = document.createElement('style');
      style.textContent = `
        .controller {
          position: absolute;
          top: 10px;
          left: 10px;
          background: rgba(0, 0, 0, 0.8);
          color: white;
          border-radius: 6px;
          padding: 8px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 12px;
          z-index: 2147483647;
          user-select: none;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: opacity 0.2s ease;
        }
        
        .controller.hidden {
          opacity: 0 !important;
          pointer-events: none;
        }
        
        .speed-display {
          font-weight: bold;
          min-width: 40px;
          text-align: center;
          cursor: move;
          padding: 2px 4px;
          border-radius: 3px;
          background: rgba(255, 255, 255, 0.1);
        }
        
        .speed-display:hover {
          background: rgba(255, 255, 255, 0.2);
        }
        
        .controls {
          display: flex;
          gap: 2px;
        }
        
        .control-btn {
          background: rgba(255, 255, 255, 0.1);
          border: none;
          color: white;
          width: 24px;
          height: 24px;
          border-radius: 3px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          transition: background 0.2s ease;
        }
        
        .control-btn:hover {
          background: rgba(255, 255, 255, 0.2);
        }
        
        .control-btn.hide {
          background: rgba(255, 0, 0, 0.2);
        }
      `;
      this.shadowRoot.appendChild(style);
      
      // Create controller UI
      const controller = document.createElement('div');
      controller.className = 'controller';
      controller.style.opacity = this.settings.get('controllerOpacity');
      
      if (this.settings.get('startHidden')) {
        controller.classList.add('hidden');
      }
      
      // Speed display
      const speedDisplay = document.createElement('div');
      speedDisplay.className = 'speed-display';
      speedDisplay.textContent = '1.00x';
      
      // Controls
      const controls = document.createElement('div');
      controls.className = 'controls';
      
      const buttons = [
        { text: '−', title: 'Slower (S)', action: 'slower' },
        { text: '+', title: 'Faster (D)', action: 'faster' },
        { text: '«', title: 'Rewind (Z)', action: 'rewind' },
        { text: '»', title: 'Advance (X)', action: 'advance' },
        { text: '⌂', title: 'Reset (R)', action: 'reset' },
        { text: '×', title: 'Hide (V)', action: 'hide' }
      ];
      
      buttons.forEach(btn => {
        const button = document.createElement('button');
        button.textContent = btn.text;
        button.title = btn.title;
        button.className = `control-btn ${btn.action}`;
        button.addEventListener('click', () => this.handleAction(btn.action));
        controls.appendChild(button);
      });
      
      controller.appendChild(speedDisplay);
      controller.appendChild(controls);
      this.shadowRoot.appendChild(controller);
      
      // Insert into DOM
      this.media.parentNode.insertBefore(this.container, this.media.nextSibling);
      
      // Store references
      this.speedDisplay = speedDisplay;
      this.controllerElement = controller;
      
      // Setup dragging
      this.setupDragging(speedDisplay, controller);
    }
    
    setupDragging(dragHandle, element) {
      let isDragging = false;
      let startX, startY, initialX, initialY;
      
      dragHandle.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = element.getBoundingClientRect();
        initialX = rect.left;
        initialY = rect.top;
        e.preventDefault();
      });
      
      document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        element.style.left = (initialX + deltaX) + 'px';
        element.style.top = (initialY + deltaY) + 'px';
      });
      
      document.addEventListener('mouseup', () => {
        isDragging = false;
      });
    }
    
    attachEventListeners() {
      this.media.addEventListener('play', () => this.onMediaPlay());
      this.media.addEventListener('loadeddata', () => this.onMediaReady());
      this.media.addEventListener('ratechange', () => this.onRateChange());
    }
    
    onMediaPlay() {
      if (this.settings.get('rememberSpeed') || this.settings.get('forceLastSavedSpeed')) {
        setTimeout(() => this.restoreSpeed(), 100);
      }
    }
    
    onMediaReady() {
      if (this.settings.get('forceLastSavedSpeed')) {
        this.restoreSpeed();
      }
    }
    
    onRateChange() {
      const newRate = this.media.playbackRate;
      if (Math.abs(newRate - this.currentSpeed) > 0.01) {
        this.currentSpeed = newRate;
        this.updateDisplay();
        this.storeSpeed();
      }
    }
    
    restoreSpeed() {
      try {
        if (this.isLivestream()) {
          log.info('Skipping speed restoration for livestream');
          return;
        }
        
        const src = this.media.src || this.media.currentSrc;
        let targetSpeed = this.settings.get('speed'); // Default speed from settings
        
        // Priority 1: Per-video stored speed (highest priority)
        const speeds = this.settings.get('speeds');
        if (src && speeds[src]) {
          targetSpeed = speeds[src];
          log.info('Using per-video stored speed', { speed: targetSpeed, src: src.substring(0, 50) + '...' });
        }
        // Priority 2: Last used speed (if rememberSpeed is enabled and no per-video speed)
        else if (this.settings.get('rememberSpeed')) {
          const lastSpeed = this.settings.get('lastSpeed');
          if (lastSpeed && lastSpeed !== 1.0) {
            targetSpeed = lastSpeed;
            log.info('Using remembered last speed', { speed: targetSpeed });
          }
        }
        // Priority 3: Force last saved speed (overrides everything if enabled)
        else if (this.settings.get('forceLastSavedSpeed')) {
          const lastSpeed = this.settings.get('lastSpeed') || this.settings.get('speed');
          targetSpeed = lastSpeed;
          log.info('Force applying last saved speed', { speed: targetSpeed });
        }
        
        // Only apply if different from current and not default 1.0
        if (targetSpeed !== 1.0 && Math.abs(this.media.playbackRate - targetSpeed) > 0.01) {
          this.setSpeed(targetSpeed);
          log.info('Speed restored', { 
            speed: targetSpeed, 
            source: src ? 'per-video' : 'default',
            currentRate: this.media.playbackRate 
          });
        }
      } catch (error) {
        log.error('Failed to restore speed', { error: error.message });
      }
    }
    
    handleAction(action) {
      try {
        switch (action) {
          case 'slower':
            this.adjustSpeed(-0.25);
            break;
          case 'faster':
            this.adjustSpeed(0.25);
            break;
          case 'rewind':
            this.seek(-10);
            break;
          case 'advance':
            this.seek(10);
            break;
                  case 'reset':
          // Reset toggles between 1.0x and default speed setting
          const defaultSpeed = this.settings.get('speed');
          const resetSpeed = (Math.abs(this.currentSpeed - 1.0) < 0.01) ? defaultSpeed : 1.0;
          this.setSpeed(resetSpeed);
          break;
          case 'hide':
            this.toggleVisibility();
            break;
        }
      } catch (error) {
        log.error('Action failed', { action, error: error.message });
      }
    }
    
    adjustSpeed(delta) {
      if (this.isLivestream()) {
        this.showNotification('Speed control not available for live streams');
        return;
      }
      const newSpeed = Math.max(0.1, Math.min(5.0, this.currentSpeed + delta));
      this.setSpeed(newSpeed);
    }
    
    seek(seconds) {
      const newTime = Math.max(0, this.media.currentTime + seconds);
      this.media.currentTime = Math.min(newTime, this.media.duration || newTime);
    }
    
    setSpeed(speed) {
      if (this.isLivestream()) {
        this.showNotification('Speed control not available for live streams');
        return;
      }
      
      try {
        speed = Math.max(0.1, Math.min(5.0, speed));
        this.media.playbackRate = speed;
        this.currentSpeed = speed;
        this.updateDisplay();
        this.storeSpeed();
        this.notifySpeedChange(speed);
        log.info('Speed set', { speed });
      } catch (error) {
        log.error('Failed to set speed', { speed, error: error.message });
      }
    }
    
    updateDisplay() {
      if (this.speedDisplay) {
        if (this.isLivestream()) {
          this.speedDisplay.textContent = 'LIVE';
        } else {
          this.speedDisplay.textContent = this.currentSpeed.toFixed(2) + 'x';
        }
      }
    }
    
    storeSpeed() {
      const src = this.media.src || this.media.currentSrc;
      if (src && this.currentSpeed !== this.lastStoredSpeed) {
        const speeds = this.settings.get('speeds');
        speeds[src] = this.currentSpeed;
        this.settings.set('speeds', speeds);
        
        // Update last used speed (for "remember last speed" feature)
        // but DO NOT update the default speed setting
        this.settings.set('lastSpeed', this.currentSpeed);
        
        this.settings.save();
        this.lastStoredSpeed = this.currentSpeed;
        
        log.info('Speed stored for video source', { 
          speed: this.currentSpeed, 
          src: src.substring(0, 50) + '...' 
        });
      }
    }
    
    toggleVisibility() {
      if (this.controllerElement) {
        this.controllerElement.classList.toggle('hidden');
      }
    }
    
    isLivestream() {
      return this.media.duration === Infinity || isNaN(this.media.duration);
    }
    
    showNotification(message) {
      const notification = document.createElement('div');
      notification.textContent = message;
      notification.style.cssText = `
        position: fixed; top: 20px; right: 20px;
        background: rgba(0, 0, 0, 0.8); color: white;
        padding: 12px 16px; border-radius: 6px;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 14px; z-index: 2147483647; pointer-events: none;
      `;
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 2000);
    }
    
    notifySpeedChange(speed) {
      try {
        browserAPI.runtime.sendMessage({
          type: 'SPEED_CHANGED',
          speed: speed,
          src: this.media.src || this.media.currentSrc
        });
      } catch (error) {
        log.warn('Failed to notify background of speed change', { error: error.message });
      }
    }
    
    destroy() {
      if (this.container && this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
      }
      this.isInitialized = false;
      log.info('Speed controller destroyed');
    }
  }
  
  // ============================================================================
  // MEDIA MANAGER (COMPLETE REDESIGN)
  // ============================================================================
  
  class MediaManager {
    constructor(settings) {
      this.settings = settings;
      this.trackedMedia = new Map();
      this.activeMedia = new Set();
      this.observer = null;
      this.keyboardHandler = null;
      
      this.init();
    }
    
    init() {
      log.info('Media manager initializing');
      
      this.scanForMedia();
      this.setupMutationObserver();
      this.setupKeyboardShortcuts();
      this.setupMessageListener();
      
      log.info('Media manager initialized');
    }
    
    scanForMedia() {
      const mediaElements = document.querySelectorAll('video, audio');
      log.info('Scanning for media elements', { count: mediaElements.length });
      
      mediaElements.forEach(element => {
        this.trackMediaElement(element);
        
        // CRITICAL FIX: Check if media is already playing when content script loads
        if (!element.paused && element.currentTime > 0) {
          // Video is currently playing - notify immediately
          log.info('Found already playing media on page load', { 
            type: element.tagName.toLowerCase(),
            currentTime: element.currentTime 
          });
          
          // Trigger the play handler manually since we missed the play event
          setTimeout(() => this.onMediaPlay(element), 100);
        } else if (element.paused && element.currentTime > 0) {
          // Video was played but is now paused - still track as has_media
          log.info('Found paused media with progress', { 
            type: element.tagName.toLowerCase(),
            currentTime: element.currentTime 
          });
          
          const tracked = this.trackedMedia.get(element);
          if (tracked) {
            tracked.info.hasBeenPlayed = true;
          }
        }
      });
    }
    
    setupMutationObserver() {
      this.observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.matches && node.matches('video, audio')) {
                this.trackMediaElement(node);
              }
              const mediaChildren = node.querySelectorAll && node.querySelectorAll('video, audio');
              if (mediaChildren) {
                mediaChildren.forEach(child => this.trackMediaElement(child));
              }
            }
          });
          
          mutation.removedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.matches && node.matches('video, audio')) {
                this.untrackMediaElement(node);
              }
              const mediaChildren = node.querySelectorAll && node.querySelectorAll('video, audio');
              if (mediaChildren) {
                mediaChildren.forEach(child => this.untrackMediaElement(child));
              }
            }
          });
        });
      });
      
      this.observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true
      });
    }
    
    trackMediaElement(element) {
      if (this.trackedMedia.has(element)) return;
      
      try {
        // Create speed controller for video elements
        let controller = null;
        if (element.tagName.toLowerCase() === 'video' && this.settings.get('showController')) {
          controller = new SpeedController(element, this.settings);
        }
        
        // Setup event listeners
        const listeners = {
          play: () => this.onMediaPlay(element),
          pause: () => this.onMediaPause(element),
          ended: () => this.onMediaEnded(element),
          loadstart: () => this.onMediaLoadStart(element)
        };
        
        Object.entries(listeners).forEach(([event, handler]) => {
          element.addEventListener(event, handler);
        });
        
        // Track the element
        this.trackedMedia.set(element, {
          controller,
          info: {
            type: element.tagName.toLowerCase(),
            src: element.src || element.currentSrc,
            isPlaying: false,
            trackingStarted: Date.now()
          },
          listeners
        });
        
        // CRITICAL FIX: Check if this newly tracked element is already playing
        // This handles cases where elements are dynamically added and immediately play
        setTimeout(() => {
          if (!element.paused && element.currentTime > 0 && !this.activeMedia.has(element)) {
            log.info('Newly tracked element is already playing', { 
              type: element.tagName.toLowerCase(),
              currentTime: element.currentTime 
            });
            this.onMediaPlay(element);
          }
        }, 50); // Small delay to ensure element is fully initialized
        
        log.info('Media element tracked', {
          type: element.tagName.toLowerCase(),
          src: element.src || element.currentSrc,
          hasController: !!controller,
          isPlaying: !element.paused && element.currentTime > 0
        });
      } catch (error) {
        log.error('Failed to track media element', { error: error.message });
      }
    }
    
    untrackMediaElement(element) {
      const tracked = this.trackedMedia.get(element);
      if (!tracked) return;
      
      try {
        // Remove event listeners
        Object.entries(tracked.listeners).forEach(([event, handler]) => {
          element.removeEventListener(event, handler);
        });
        
        // Destroy controller
        if (tracked.controller) {
          tracked.controller.destroy();
        }
        
        // Remove from tracking
        this.trackedMedia.delete(element);
        this.activeMedia.delete(element);
        
        log.info('Media element untracked', { type: tracked.info.type });
      } catch (error) {
        log.error('Failed to untrack media element', { error: error.message });
      }
    }
    
    onMediaPlay(element) {
      this.activeMedia.add(element);
      
      const tracked = this.trackedMedia.get(element);
      if (tracked) {
        tracked.info.isPlaying = true;
        tracked.info.lastPlay = Date.now();
      }
      
      this.notifyBackgroundScript('MEDIA_STARTED', {
        type: element.tagName.toLowerCase(),
        src: element.src || element.currentSrc,
        title: document.title,
        duration: element.duration,
        playbackRate: element.playbackRate
      });
      
      log.info('Media started playing', { 
        type: element.tagName.toLowerCase(),
        src: element.src || element.currentSrc
      });
    }
    
    onMediaPause(element) {
      this.activeMedia.delete(element);
      
      const tracked = this.trackedMedia.get(element);
      if (tracked) {
        tracked.info.isPlaying = false;
      }
      
      if (this.activeMedia.size === 0) {
        this.notifyBackgroundScript('MEDIA_PAUSED');
      }
      
      log.info('Media paused');
    }
    
    onMediaEnded(element) {
      this.activeMedia.delete(element);
      
      const tracked = this.trackedMedia.get(element);
      if (tracked) {
        tracked.info.isPlaying = false;
      }
      
      if (this.activeMedia.size === 0) {
        this.notifyBackgroundScript('MEDIA_ENDED');
      }
      
      log.info('Media ended');
    }
    
    onMediaLoadStart(element) {
      const tracked = this.trackedMedia.get(element);
      if (tracked && tracked.controller) {
        tracked.controller.restoreSpeed();
      }
    }
    
    setupKeyboardShortcuts() {
      this.keyboardHandler = (event) => {
        // Skip if modifiers or in input fields
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        if (event.target.matches('input, textarea, [contenteditable="true"]')) return;
        if (this.trackedMedia.size === 0) return;
        
        // Find matching key binding
        const keyBindings = this.settings.get('keyBindings');
        const binding = keyBindings.find(b => b.key === event.keyCode);
        
        if (binding && this.settings.get('enabled')) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          
          this.executeAction(binding.action, binding.value);
          return false;
        }
      };
      
      // Add event listeners at multiple levels for maximum coverage
      window.addEventListener('keydown', this.keyboardHandler, true);
      document.addEventListener('keydown', this.keyboardHandler, true);
    }
    
    executeAction(action, value) {
      const activeElements = Array.from(this.activeMedia);
      const allElements = Array.from(this.trackedMedia.keys());
      const elementsToProcess = activeElements.length > 0 ? activeElements : allElements;
      
      elementsToProcess.forEach(element => {
        const tracked = this.trackedMedia.get(element);
        
        switch (action) {
          case 'slower':
            if (tracked && tracked.controller) {
              tracked.controller.adjustSpeed(-value);
            } else {
              this.adjustElementSpeed(element, -value);
            }
            break;
            
          case 'faster':
            if (tracked && tracked.controller) {
              tracked.controller.adjustSpeed(value);
            } else {
              this.adjustElementSpeed(element, value);
            }
            break;
            
          case 'reset':
            // Reset behavior: toggle between 1.0x and default speed setting
            const currentSpeed = element.playbackRate;
            const defaultSpeed = this.settings.get('speed');
            const resetSpeed = (Math.abs(currentSpeed - 1.0) < 0.01) ? defaultSpeed : 1.0;
            
            if (tracked && tracked.controller) {
              tracked.controller.setSpeed(resetSpeed);
            } else {
              element.playbackRate = resetSpeed;
              
              // Store the reset speed
              const src = element.src || element.currentSrc;
              if (src) {
                const speeds = this.settings.get('speeds');
                speeds[src] = resetSpeed;
                this.settings.set('speeds', speeds);
                this.settings.set('lastSpeed', resetSpeed);
              }
            }
            break;
            
          case 'fast':
            if (tracked && tracked.controller) {
              tracked.controller.setSpeed(value);
            } else {
              element.playbackRate = value;
              
              // Store the fast speed
              const src = element.src || element.currentSrc;
              if (src) {
                const speeds = this.settings.get('speeds');
                speeds[src] = value;
                this.settings.set('speeds', speeds);
                this.settings.set('lastSpeed', value);
              }
            }
            break;
            
          case 'rewind':
            element.currentTime = Math.max(0, element.currentTime - value);
            break;
            
          case 'advance':
            element.currentTime = Math.min(element.currentTime + value, element.duration || element.currentTime + value);
            break;
            
          case 'display':
            this.trackedMedia.forEach((tracked) => {
              if (tracked.controller) {
                tracked.controller.toggleVisibility();
              }
            });
            break;
        }
      });
      
      // Save all settings changes after keyboard actions
      if (['slower', 'faster', 'reset', 'fast'].includes(action)) {
        this.settings.save();
      }
      
      log.info('Keyboard action executed', { action, value, elements: elementsToProcess.length });
    }
    
    adjustElementSpeed(element, delta) {
      if (element.duration === Infinity || isNaN(element.duration)) {
        log.info('Skipping speed adjustment for livestream');
        return;
      }
      
      const newSpeed = Math.max(0.1, Math.min(5.0, element.playbackRate + delta));
      element.playbackRate = newSpeed;
      
      // Store the speed properly (per-video and lastSpeed, not default speed)
      const src = element.src || element.currentSrc;
      if (src) {
        const speeds = this.settings.get('speeds');
        speeds[src] = newSpeed;
        this.settings.set('speeds', speeds);
        this.settings.set('lastSpeed', newSpeed); // Update last used speed only
        this.settings.save();
        
        log.info('Element speed adjusted and stored', { 
          speed: newSpeed, 
          element: element.tagName.toLowerCase() 
        });
      }
    }
    
    setupMessageListener() {
      browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
        try {
          switch (message.type) {
            case 'PAUSE_MEDIA':
              this.pauseAllMedia();
              sendResponse({ success: true });
              break;
              
            case 'SET_VOLUME':
              this.setVolume(message.volume);
              sendResponse({ success: true, volume: message.volume });
              break;
              
            case 'SET_SPEED':
              this.setSpeedAll(message.speed);
              sendResponse({ success: true });
              break;
              
            case 'SPEED_ACTION':
              this.executeAction(message.action, message.value);
              sendResponse({ success: true });
              break;
              
            case 'CHECK_FOR_MEDIA':
              const mediaInfo = this.getMediaInfo();
              sendResponse(mediaInfo);
              break;
              
            case 'SETTINGS_UPDATED':
              this.handleSettingsUpdate(message.settings);
              sendResponse({ success: true });
              break;
              
            case 'GET_CONTENT_DIAGNOSTICS':
              const diagnostics = this.getDiagnostics();
              sendResponse(diagnostics);
              break;
              
            default:
              log.warn('Unknown message type', { type: message.type });
              sendResponse({ error: 'Unknown message type' });
          }
        } catch (error) {
          log.error('Message handling failed', { type: message.type, error: error.message });
          sendResponse({ error: error.message });
        }
        
        return true;
      });
    }
    
    pauseAllMedia() {
      this.activeMedia.forEach(element => {
        if (element && typeof element.pause === 'function') {
          element.pause();
        }
      });
      log.info('All media paused', { count: this.activeMedia.size });
    }
    
    setVolume(volume) {
      this.trackedMedia.forEach((tracked, element) => {
        if (element.volume !== undefined) {
          element.volume = Math.max(0, Math.min(1, volume));
        }
      });
      log.info('Volume set for all media', { volume, count: this.trackedMedia.size });
    }
    
    setSpeedAll(speed) {
      this.trackedMedia.forEach((tracked, element) => {
        if (tracked.controller) {
          tracked.controller.setSpeed(speed);
        } else if (element.duration !== Infinity && !isNaN(element.duration)) {
          element.playbackRate = speed;
          
          // Store per-video speed and update lastSpeed, but not default speed
          const src = element.src || element.currentSrc;
          if (src) {
            const speeds = this.settings.get('speeds');
            speeds[src] = speed;
            this.settings.set('speeds', speeds);
            this.settings.set('lastSpeed', speed); // Update last used speed only
          }
        }
      });
      
      // Save all changes at once
      this.settings.save();
      
      log.info('Speed set for all media', { speed, count: this.trackedMedia.size });
    }
    
    getMediaInfo() {
      const allMedia = document.querySelectorAll('video, audio');
      const trackedCount = this.trackedMedia.size;
      const activeCount = this.activeMedia.size;
      
      // CRITICAL FIX: Check for actively playing media
      const playingMedia = Array.from(allMedia).filter(el => !el.paused && el.currentTime > 0);
      const hasPlayingMedia = playingMedia.length > 0;
      
      return {
        hasMedia: allMedia.length > 0,
        mediaCount: allMedia.length,
        trackedCount,
        activeCount,
        hasPlayingMedia, // NEW: Indicates if any media is currently playing
        playingMediaCount: playingMedia.length, // NEW: Count of playing media
        mediaTypes: Array.from(new Set(Array.from(allMedia).map(el => el.tagName.toLowerCase()))),
        videoCount: document.querySelectorAll('video').length,
        audioCount: document.querySelectorAll('audio').length
      };
    }
    
    handleSettingsUpdate(newSettings) {
      this.settings.update(newSettings);
      
      // Update existing controllers
      this.trackedMedia.forEach(tracked => {
        if (tracked.controller) {
          if (newSettings.showController !== undefined && !newSettings.showController) {
            tracked.controller.destroy();
            tracked.controller = null;
          }
          
          if (tracked.controller && newSettings.controllerOpacity !== undefined) {
            tracked.controller.controllerElement.style.opacity = newSettings.controllerOpacity;
          }
        }
      });
      
      log.info('Settings updated', { settingsKeys: Object.keys(newSettings) });
    }
    
    getDiagnostics() {
      return {
        trackedMediaCount: this.trackedMedia.size,
        activeMediaCount: this.activeMedia.size,
        mediaInfo: this.getMediaInfo(),
        settings: {
          enabled: this.settings.get('enabled'),
          showController: this.settings.get('showController'),
          keyBindingsCount: this.settings.get('keyBindings').length
        }
      };
    }
    
    notifyBackgroundScript(type, data = null) {
      try {
        const message = { type };
        if (data) message.mediaInfo = data;
        browserAPI.runtime.sendMessage(message);
      } catch (error) {
        log.warn('Failed to notify background script', { type, error: error.message });
      }
    }
    
    destroy() {
      if (this.observer) {
        this.observer.disconnect();
      }
      
      if (this.keyboardHandler) {
        window.removeEventListener('keydown', this.keyboardHandler, true);
        document.removeEventListener('keydown', this.keyboardHandler, true);
      }
      
      this.trackedMedia.forEach((tracked, element) => {
        this.untrackMediaElement(element);
      });
      
      log.info('Media manager destroyed');
    }
  }
  
  // ============================================================================
  // MAIN CONTENT SCRIPT CLASS
  // ============================================================================
  
  class ContentScript {
    constructor() {
      this.settings = new SettingsManager();
      this.mediaManager = null;
      this.initialized = false;
    }
    
    async init() {
      try {
        log.info('Content script initializing', { url: window.location.href });
        
        // Load settings
        await this.settings.load();
        
        // Check if site is blacklisted
        if (this.settings.isBlacklisted(window.location.href)) {
          log.info('Site is blacklisted, skipping initialization');
          return;
        }
        
        // Check if extension is enabled
        if (!this.settings.get('enabled')) {
          log.info('Extension is disabled, skipping initialization');
          return;
        }
        
        // Initialize media manager
        this.mediaManager = new MediaManager(this.settings);
        
        // Setup navigation handler for SPAs
        this.setupNavigationHandler();
        
        // CRITICAL FIX: Add delayed checks for media that starts playing after page load
        this.setupDelayedMediaChecks();
        
        this.initialized = true;
        log.info('Content script initialized successfully');
        
      } catch (error) {
        log.error('Content script initialization failed', { error: error.message });
      }
    }
    
    setupNavigationHandler() {
      // Handle single-page app navigation
      let lastUrl = location.href;
      
      const navigationObserver = new MutationObserver(() => {
        const currentUrl = location.href;
        if (currentUrl !== lastUrl) {
          lastUrl = currentUrl;
          log.info('Navigation detected, reinitializing', { newUrl: currentUrl });
          
          // Clean up and reinitialize
          this.cleanup();
          setTimeout(() => this.init(), 1000);
        }
      });
      
      navigationObserver.observe(document, { subtree: true, childList: true });
    }
    
    setupDelayedMediaChecks() {
      // CRITICAL FIX: Some videos start playing after page load and content script initialization
      // Check for new playing media at intervals for the first few seconds
      const checkIntervals = [500, 1000, 2000, 3000]; // Check at 0.5s, 1s, 2s, 3s
      
      checkIntervals.forEach((delay, index) => {
        setTimeout(() => {
          if (this.mediaManager && this.initialized) {
            const mediaElements = document.querySelectorAll('video, audio');
            let foundNewMedia = false;
            
            mediaElements.forEach(element => {
              // Check for media that's now playing but wasn't tracked as playing before
              if (!element.paused && element.currentTime > 0 && !this.mediaManager.activeMedia.has(element)) {
                log.info(`Delayed check ${index + 1} found new playing media`, { 
                  type: element.tagName.toLowerCase(),
                  currentTime: element.currentTime,
                  delay: delay 
                });
                
                // Track it if not already tracked
                if (!this.mediaManager.trackedMedia.has(element)) {
                  this.mediaManager.trackMediaElement(element);
                }
                
                // Trigger the play handler
                this.mediaManager.onMediaPlay(element);
                foundNewMedia = true;
              }
            });
            
            if (foundNewMedia) {
              log.info(`Delayed check ${index + 1} completed - found new playing media`);
            }
          }
        }, delay);
      });
      
      log.info('Set up delayed media checks for first 3 seconds after page load');
    }
    
    cleanup() {
      if (this.mediaManager) {
        this.mediaManager.destroy();
        this.mediaManager = null;
      }
      this.initialized = false;
      log.info('Content script cleaned up');
    }
  }
  
  // ============================================================================
  // STARTUP
  // ============================================================================
  
  const contentScript = new ContentScript();
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => contentScript.init());
  } else {
    contentScript.init();
  }
  
  // Cleanup on unload
  window.addEventListener('beforeunload', () => contentScript.cleanup());
  
  log.info('UME Content Script loaded', { 
    url: window.location.href,
    readyState: document.readyState
  });
  
})();
