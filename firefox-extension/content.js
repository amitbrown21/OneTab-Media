/**
 * UME - Ultimate Media Extention - Content Script
 * Integrates media detection and speed control functionality into web pages
 * Includes visual overlay controller and keyboard shortcuts
 */

(function() {
  'use strict';
  
  // Prevent multiple injections
  if (window.mediaTabManagerInjected) {
    return;
  }
  window.mediaTabManagerInjected = true;
  
  // Browser compatibility layer
  const browserAPI = (function() {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      return chrome;
    } else if (typeof browser !== 'undefined' && browser.runtime) {
      return browser;
    }
    return null;
  })();
  
  // Track media elements and their states
  const trackedElements = new WeakMap();
  const activeMediaElements = new Set();
  
  // Speed control settings
  let speedSettings = {
    lastSpeed: 1.0,
    enabled: true,
    speeds: {}, // Store speeds per media source
    // Visual controller settings
    showController: true,
    startHidden: false,
    controllerOpacity: 0.3,
    displayKeyCode: 86, // V key
    keyBindings: [
      { action: 'display', key: 86, value: 0, force: false }, // V
      { action: 'slower', key: 83, value: 0.1, force: false }, // S
      { action: 'faster', key: 68, value: 0.1, force: false }, // D
      { action: 'rewind', key: 90, value: 10, force: false }, // Z
      { action: 'advance', key: 88, value: 10, force: false }, // X
      { action: 'reset', key: 82, value: 1.0, force: false }, // R
      { action: 'fast', key: 71, value: 1.8, force: false } // G
    ]
  };

  /**
   * VideoController class - Creates and manages visual speed controller overlay
   */
  class VideoController {
    constructor(video) {
      // Additional safeguard: prevent duplicate controllers
      if (video.vsc) {
        console.warn('OneTab Media: VideoController already exists for this element, preventing duplicate');
        return video.vsc;
      }
      
      this.video = video;
      this.element = video;
      this.isInitialized = false;
      this.init();
    }

    init() {
      try {
        // Restore speed from settings
        const src = this.video.src || this.video.currentSrc;
        let storedSpeed = speedSettings.speeds[src] || speedSettings.lastSpeed;
        this.video.playbackRate = storedSpeed;

        this.div = this.initializeControls();

        // Set up event listeners
        this.setupEventListeners();
        
        this.isInitialized = true;
        console.log('OneTab Media: VideoController initialized successfully');
      } catch (error) {
        console.error('OneTab Media: Failed to initialize VideoController:', error);
      }
    }

    initializeControls() {
      const document = this.video.ownerDocument;
      const speed = this.video.playbackRate.toFixed(2);
      const top = Math.max(this.video.offsetTop, 0) + 'px';
      const left = Math.max(this.video.offsetLeft, 0) + 'px';

      // Create wrapper element
      const wrapper = document.createElement('div');
      wrapper.classList.add('vsc-controller');

      // Hide if no source
      if (!this.video.src && !this.video.currentSrc) {
        wrapper.classList.add('vsc-nosource');
      }

      // Hide if startHidden setting is enabled
      if (speedSettings.startHidden) {
        wrapper.classList.add('vsc-hidden');
      }

      // Create shadow DOM
      const shadow = wrapper.attachShadow({ mode: 'open' });
      
      // Create and append stylesheet
      const style = document.createElement('style');
      style.textContent = `@import "${browserAPI.runtime.getURL('shadow.css')}";`;
      shadow.appendChild(style);

      // Create controller div
      const controller = document.createElement('div');
      controller.id = 'controller';
      controller.style.top = top;
      controller.style.left = left;
      controller.style.opacity = speedSettings.controllerOpacity;

      // Create draggable speed display
      const speedDisplay = document.createElement('span');
      speedDisplay.className = 'draggable';
      speedDisplay.textContent = speed + 'x';

      // Create controls container
      const controls = document.createElement('span');
      controls.id = 'controls';

      // Create control buttons
      const buttonConfigs = [
        { title: 'Slower (S)', class: 'rw', text: '−' },
        { title: 'Faster (D)', class: '', text: '+' },
        { title: 'Rewind (Z)', class: 'rw', text: '«' },
        { title: 'Advance (X)', class: '', text: '»' },
        { title: 'Reset (R)', class: '', text: '⌂' },
        { title: 'Hide (V)', class: 'hideButton', text: '×' }
      ];

      buttonConfigs.forEach(buttonConfig => {
        const button = document.createElement('button');
        button.title = buttonConfig.title;
        if (buttonConfig.class) {
          button.className = buttonConfig.class;
        }
        button.textContent = buttonConfig.text;
        controls.appendChild(button);
      });

      // Assemble the DOM structure
      controller.appendChild(speedDisplay);
      controller.appendChild(controls);
      shadow.appendChild(controller);

      // Get shadow DOM elements with error checking
      this.shadow = shadow;
      this.controller = shadow.querySelector('#controller');
      this.speedDisplay = shadow.querySelector('.draggable');
      this.controls = shadow.querySelector('#controls');
      
      if (!this.controller || !this.speedDisplay || !this.controls) {
        console.error('OneTab Media: Failed to find shadow DOM elements');
        return wrapper;
      }
      
      const buttons = shadow.querySelectorAll('button');
      if (buttons.length < 6) {
        console.error('OneTab Media: Not all buttons found in shadow DOM');
        return wrapper;
      }
      
      const [slowerBtn, fasterBtn, rewindBtn, advanceBtn, resetBtn, hideBtn] = buttons;

      // Set up button event listeners with error handling
      try {
        slowerBtn.addEventListener('click', () => this.handleSpeedAction('slower', 0.1));
        fasterBtn.addEventListener('click', () => this.handleSpeedAction('faster', 0.1));
        rewindBtn.addEventListener('click', () => this.handleSpeedAction('rewind', 10));
        advanceBtn.addEventListener('click', () => this.handleSpeedAction('advance', 10));
        resetBtn.addEventListener('click', () => this.handleSpeedAction('reset', 1.0));
        hideBtn.addEventListener('click', () => this.toggleDisplay());
      } catch (error) {
        console.error('OneTab Media: Failed to set up button listeners:', error);
      }

      // Set up dragging
      this.setupDragging();

      // Insert into DOM near video element
      try {
        this.video.parentNode.insertBefore(wrapper, this.video.nextSibling);
      } catch (error) {
        console.error('OneTab Media: Failed to insert controller into DOM:', error);
        // Try appending to parent as fallback
        try {
          this.video.parentNode.appendChild(wrapper);
        } catch (fallbackError) {
          console.error('OneTab Media: Failed to append controller as fallback:', fallbackError);
        }
      }

      return wrapper;
    }

    setupEventListeners() {
      // Handle play events
      this.handlePlay = () => {
        const src = this.video.src || this.video.currentSrc;
        let storedSpeed = speedSettings.speeds[src] || speedSettings.lastSpeed;
        this.setSpeed(storedSpeed);
      };

      // Handle seeked events
      this.handleSeek = () => {
        const src = this.video.src || this.video.currentSrc;
        let storedSpeed = speedSettings.speeds[src] || speedSettings.lastSpeed;
        this.setSpeed(storedSpeed);
      };

      this.video.addEventListener('play', this.handlePlay);
      this.video.addEventListener('seeked', this.handleSeek);

      // Watch for source changes
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && 
              (mutation.attributeName === 'src' || mutation.attributeName === 'currentSrc')) {
            if (!this.video.src && !this.video.currentSrc) {
              this.div.classList.add('vsc-nosource');
            } else {
              this.div.classList.remove('vsc-nosource');
            }
          }
        });
      });

      observer.observe(this.video, {
        attributeFilter: ['src', 'currentSrc']
      });
    }

    setupDragging() {
      if (!this.speedDisplay || !this.controller) {
        console.error('OneTab Media: Cannot setup dragging - elements not found');
        return;
      }

      let isDragging = false;
      let startX, startY, initialX, initialY;

      this.speedDisplay.addEventListener('mousedown', (e) => {
        isDragging = true;
        this.controller.classList.add('dragging');
        
        startX = e.clientX;
        startY = e.clientY;
        
        const rect = this.controller.getBoundingClientRect();
        initialX = rect.left;
        initialY = rect.top;
        
        e.preventDefault();
      });

      document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        this.controller.style.left = (initialX + deltaX) + 'px';
        this.controller.style.top = (initialY + deltaY) + 'px';
      });

      document.addEventListener('mouseup', () => {
        if (isDragging) {
          isDragging = false;
          this.controller.classList.remove('dragging');
        }
      });
    }

    handleSpeedAction(action, value) {
      switch (action) {
        case 'slower':
          this.setSpeed(Math.max(0.1, this.video.playbackRate - value));
          break;
        case 'faster':
          this.setSpeed(Math.min(5.0, this.video.playbackRate + value));
          break;
        case 'rewind':
          this.video.currentTime = Math.max(0, this.video.currentTime - value);
          break;
        case 'advance':
          this.video.currentTime = Math.min(this.video.duration || Infinity, 
            this.video.currentTime + value);
          break;
        case 'reset':
          this.setSpeed(1.0);
          break;
        case 'fast':
          this.setSpeed(value);
          break;
      }
    }

    setSpeed(speed) {
      if (!this.isInitialized) {
        console.warn('OneTab Media: VideoController not initialized, cannot set speed');
        return;
      }

      speed = Math.max(0.1, Math.min(5.0, speed));
      
      try {
        // Update video playback rate
        this.video.playbackRate = speed;
        
        // Update display - ensure speedDisplay exists
        if (this.speedDisplay) {
          this.speedDisplay.textContent = speed.toFixed(2) + 'x';
          console.log('OneTab Media: Updated display to', speed.toFixed(2) + 'x');
        } else {
          console.error('OneTab Media: speedDisplay element not found for update');
        }
        
        // Store speed
        const src = this.video.src || this.video.currentSrc;
        if (src) {
          speedSettings.speeds[src] = speed;
        }
        speedSettings.lastSpeed = speed;
        
        // Save to storage
        saveSpeedSettings();
        
        // Notify background script of speed change
        sendMessage({
          type: 'SPEED_CHANGED',
          speed: speed,
          src: src
        });
        
        console.log('OneTab Media: VideoController speed set to', speed);
      } catch (error) {
        console.error('OneTab Media: Error setting speed in VideoController:', error);
      }
    }

    toggleDisplay() {
      if (!this.div) {
        console.error('OneTab Media: Cannot toggle display - div not found');
        return;
      }
      
      try {
        const wasHidden = this.div.classList.contains('vsc-hidden');
        this.div.classList.toggle('vsc-hidden');
        const isNowHidden = this.div.classList.contains('vsc-hidden');
        
        console.log('OneTab Media: Controller visibility toggled from', wasHidden ? 'hidden' : 'visible', 'to', isNowHidden ? 'hidden' : 'visible');
      } catch (error) {
        console.error('OneTab Media: Error toggling display:', error);
      }
    }

    remove() {
      try {
        if (this.div && this.div.parentNode) {
          this.div.parentNode.removeChild(this.div);
        }
        if (this.video) {
          this.video.removeEventListener('play', this.handlePlay);
          this.video.removeEventListener('seeked', this.handleSeek);
          delete this.video.vsc;
        }
        console.log('OneTab Media: VideoController removed successfully');
      } catch (error) {
        console.error('OneTab Media: Error removing VideoController:', error);
      }
    }
  }

  // Debounce timer for media state changes
  let debounceTimer = null;
  
  console.log('OneTab Media: Enhanced content script loaded on', window.location.href);

  /**
   * Initialize content script
   */
  function initialize() {
    setupMediaDetection();
    setupMessageListener();
    setupKeyboardShortcuts();
    loadSpeedSettings();
    
    // Handle dynamic content loading
    observeDocumentChanges();
  }

  /**
   * Load speed control settings from storage
   */
  async function loadSpeedSettings() {
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
        // Legacy support
        'videoSpeedSettings', 
        'videoSpeedEnabled',
        'lastSpeed'
      ]);
      
      // Update settings with loaded values
      speedSettings.enabled = result.enabled !== false;
      speedSettings.showController = result.showController !== false;
      speedSettings.startHidden = result.startHidden || false;
      speedSettings.rememberSpeed = result.rememberSpeed || false;
      speedSettings.forceLastSavedSpeed = result.forceLastSavedSpeed || false;
      speedSettings.controllerOpacity = result.controllerOpacity || 0.3;
      speedSettings.lastSpeed = result.speed || result.lastSpeed || 1.0;
      speedSettings.displayKeyCode = result.displayKeyCode || 86;
      
      if (result.keyBindings && Array.isArray(result.keyBindings)) {
        speedSettings.keyBindings = result.keyBindings;
      }
      
      if (result.blacklist) {
        speedSettings.blacklist = result.blacklist;
      }
      
      // Legacy support
      if (result.videoSpeedSettings) {
        Object.assign(speedSettings, result.videoSpeedSettings);
      }
      if (result.videoSpeedEnabled !== undefined) {
        speedSettings.enabled = result.videoSpeedEnabled;
      }
      
      console.log('OneTab Media: Settings loaded successfully:', speedSettings);
    } catch (error) {
      console.warn('OneTab Media: Failed to load speed settings:', error);
    }
  }

  /**
   * Save speed settings to storage
   */
  async function saveSpeedSettings() {
    try {
      await browserAPI.storage.sync.set({
        enabled: speedSettings.enabled,
        showController: speedSettings.showController,
        startHidden: speedSettings.startHidden,
        rememberSpeed: speedSettings.rememberSpeed,
        forceLastSavedSpeed: speedSettings.forceLastSavedSpeed,
        controllerOpacity: speedSettings.controllerOpacity,
        speed: speedSettings.lastSpeed,
        displayKeyCode: speedSettings.displayKeyCode,
        keyBindings: speedSettings.keyBindings,
        blacklist: speedSettings.blacklist,
        // Legacy support
        videoSpeedSettings: speedSettings,
        lastSpeed: speedSettings.lastSpeed
      });
      console.log('OneTab Media: Settings saved successfully');
    } catch (error) {
      console.warn('OneTab Media: Failed to save speed settings:', error);
    }
  }

  /**
   * Set up keyboard shortcuts for video speed control
   */
  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(event) {
      const keyCode = event.keyCode;
      
      // Ignore if modifiers are active
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }
      
      // Ignore if typing in input fields
      if (event.target.nodeName === 'INPUT' || 
          event.target.nodeName === 'TEXTAREA' || 
          event.target.isContentEditable) {
        return;
      }
      
      // Ignore if no media elements are present
      if (activeMediaElements.size === 0) {
        return;
      }
      
      // Find matching key binding
      const binding = speedSettings.keyBindings.find(item => item.key === keyCode);
      if (binding && speedSettings.enabled) {
        runSpeedAction(binding.action, binding.value);
        
        if (binding.force) {
          event.preventDefault();
          event.stopPropagation();
        }
      }
    }, true);
  }

  /**
   * Run speed control action on active media elements
   */
  function runSpeedAction(action, value) {
    activeMediaElements.forEach(element => {
      const elementInfo = trackedElements.get(element);
      if (!elementInfo || element.paused) return; // Only affect playing media
      
      switch (action) {
        case 'faster':
          const fasterSpeed = Math.min((element.playbackRate < 0.1 ? 0.0 : element.playbackRate) + value, 16);
          // Use VideoController's setSpeed if available, otherwise use global setSpeed
          if (element.vsc && typeof element.vsc.setSpeed === 'function') {
            element.vsc.setSpeed(fasterSpeed);
          } else {
            setSpeed(element, fasterSpeed);
          }
          break;
          
        case 'slower':
          const slowerSpeed = Math.max(element.playbackRate - value, 0.07);
          // Use VideoController's setSpeed if available, otherwise use global setSpeed
          if (element.vsc && typeof element.vsc.setSpeed === 'function') {
            element.vsc.setSpeed(slowerSpeed);
          } else {
            setSpeed(element, slowerSpeed);
          }
          break;
          
        case 'reset':
          const resetSpeed = element.playbackRate === 1.0 ? speedSettings.lastSpeed : 1.0;
          // Use VideoController's setSpeed if available, otherwise use global setSpeed
          if (element.vsc && typeof element.vsc.setSpeed === 'function') {
            element.vsc.setSpeed(resetSpeed);
          } else {
            setSpeed(element, resetSpeed);
          }
          break;

        case 'fast':
          // Use VideoController's setSpeed if available, otherwise use global setSpeed
          if (element.vsc && typeof element.vsc.setSpeed === 'function') {
            element.vsc.setSpeed(value);
          } else {
            setSpeed(element, value);
          }
          break;
          
        case 'rewind':
          element.currentTime = Math.max(element.currentTime - value, 0);
          break;
          
        case 'advance':
          element.currentTime = Math.min(element.currentTime + value, element.duration || element.currentTime + value);
          break;
          
        case 'display':
          // Toggle visual controller visibility for all video elements
          document.querySelectorAll('video').forEach(video => {
            if (video.vsc) {
              video.vsc.toggleDisplay();
            }
          });
          console.log('Speed controller display toggled');
          break;
      }
    });
  }

  /**
   * Set playback speed for a media element
   */
  function setSpeed(element, speed) {
    const speedValue = Number(speed.toFixed(2));
    element.playbackRate = speedValue;
    
    // Store speed settings
    if (element.src || element.currentSrc) {
      speedSettings.speeds[element.src || element.currentSrc] = speedValue;
    }
    speedSettings.lastSpeed = speedValue;
    
    // Save to storage
    saveSpeedSettings();
    
    // Notify background script about speed change
    sendMessage({
      type: 'SPEED_CHANGED',
      speed: speedValue,
      src: element.src || element.currentSrc
    });
    
    console.log('OneTab Media: Speed changed to', speedValue);
  }
  
  /**
   * Set up detection for existing and new media elements
   */
  function setupMediaDetection() {
    // Detect existing media elements
    detectExistingMedia();
    
    // Watch for new and removed media elements
    const mediaObserver = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        // Handle added nodes
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            checkForMediaElements(node);
          }
        });
        
        // Handle removed nodes
        mutation.removedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            cleanupRemovedMediaElements(node);
          }
        });
      });
    });
    
    mediaObserver.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });
  }
  
  /**
   * Clean up VideoControllers for removed media elements
   */
  function cleanupRemovedMediaElements(node) {
    // Check if the removed node itself is a video element
    if (node.tagName && node.tagName.toLowerCase() === 'video') {
      cleanupMediaElement(node);
    }
    
    // Check for video elements within the removed node
    if (node.querySelectorAll) {
      const videoElements = node.querySelectorAll('video');
      videoElements.forEach(video => {
        cleanupMediaElement(video);
      });
    }
  }
  
  /**
   * Clean up a single media element
   */
  function cleanupMediaElement(element) {
    try {
      // Remove VideoController if it exists
      if (element.vsc && typeof element.vsc.remove === 'function') {
        element.vsc.remove();
        element.vsc = null;
        console.log('OneTab Media: Cleaned up VideoController for removed element');
      }
      
      // Remove from tracked elements
      if (trackedElements.has(element)) {
        trackedElements.delete(element);
        console.log('OneTab Media: Removed element from tracking');
      }
      
      // Remove from active elements
      if (activeMediaElements.has(element)) {
        activeMediaElements.delete(element);
        console.log('OneTab Media: Removed element from active media');
      }
    } catch (error) {
      console.warn('OneTab Media: Error cleaning up media element:', error);
    }
  }
  
  /**
   * Detect all existing media elements on the page
   */
  function detectExistingMedia() {
    const videoElements = document.querySelectorAll('video');
    const audioElements = document.querySelectorAll('audio');
    
    console.log('OneTab Media: Detecting existing media elements');
    console.log('OneTab Media: Found', videoElements.length, 'video elements');
    console.log('OneTab Media: Found', audioElements.length, 'audio elements');
    console.log('OneTab Media: URL:', window.location.href);
    
    // Log details about video elements
    videoElements.forEach((video, index) => {
      console.log(`OneTab Media: Video ${index}:`, {
        src: video.src,
        currentSrc: video.currentSrc,
        paused: video.paused,
        readyState: video.readyState,
        tagName: video.tagName,
        className: video.className,
        id: video.id
      });
    });
    
    [...videoElements, ...audioElements].forEach(element => {
      attachMediaListeners(element);
    });
    
    // Also check for Web Audio API usage
    detectWebAudioUsage();
  }
  
  /**
   * Check if a node or its children contain media elements
   */
  function checkForMediaElements(node) {
    if (node.tagName === 'VIDEO' || node.tagName === 'AUDIO') {
      attachMediaListeners(node);
    }
    
    // Check children
    const mediaChildren = node.querySelectorAll && node.querySelectorAll('video, audio');
    if (mediaChildren) {
      mediaChildren.forEach(element => {
        attachMediaListeners(element);
      });
    }
  }
  
  /**
   * Attach event listeners to a media element
   */
  function attachMediaListeners(element) {
    if (trackedElements.has(element)) {
      return; // Already tracking this element
    }
    
    trackedElements.set(element, {
      isPlaying: false,
      mediaType: element.tagName.toLowerCase()
    });
    
    // Create visual controller for video elements if enabled
    if (speedSettings.showController && element.tagName.toLowerCase() === 'video') {
      // Ensure we don't create multiple controllers for the same element
      if (!element.vsc) {
        try {
          element.vsc = new VideoController(element);
          console.log('OneTab Media: Created VideoController for video');
        } catch (error) {
          console.warn('Failed to create video controller:', error);
        }
      }
    }
    
    // Play event
    element.addEventListener('play', () => {
      handleMediaPlay(element);
    });
    
    // Pause event  
    element.addEventListener('pause', () => {
      handleMediaPause(element);
    });
    
    // Ended event
    element.addEventListener('ended', () => {
      handleMediaEnd(element);
    });
    
    console.log('OneTab Media: Attached listeners to', element.tagName.toLowerCase(), 'element');
  }
  
  /**
   * Handle when media starts playing
   */
  function handleMediaPlay(element) {
    const elementInfo = trackedElements.get(element);
    if (!elementInfo) return;
    
    elementInfo.isPlaying = true;
    activeMediaElements.add(element);
    
    // Restore speed for this media source if available
    restoreSpeed(element);
    
    const mediaInfo = {
      type: elementInfo.mediaType,
      src: element.src || element.currentSrc,
      title: element.title || document.title,
      duration: element.duration,
      currentTime: element.currentTime,
      volume: element.volume,
      muted: element.muted,
      playbackRate: element.playbackRate // Add current speed
    };
    
    console.log('OneTab Media: Media started playing', mediaInfo);
    console.log('OneTab Media: activeMediaElements.size:', activeMediaElements.size);
    
    // Notify background script
    sendMessage({
      type: 'MEDIA_STARTED',
      mediaInfo: mediaInfo
    });
  }

  /**
   * Restore speed for a media element based on stored settings
   */
  function restoreSpeed(element) {
    const src = element.src || element.currentSrc;
    let targetSpeed = speedSettings.lastSpeed;
    
    // Check if we have a specific speed stored for this source
    if (src && speedSettings.speeds[src]) {
      targetSpeed = speedSettings.speeds[src];
    }
    
    // Only set speed if it's different from current and not default
    if (targetSpeed !== 1.0 && Math.abs(element.playbackRate - targetSpeed) > 0.01) {
      // Use VideoController's setSpeed if available, otherwise set directly
      if (element.vsc && typeof element.vsc.setSpeed === 'function') {
        element.vsc.setSpeed(targetSpeed);
      } else {
        element.playbackRate = targetSpeed;
      }
      console.log('OneTab Media: Restored speed to', targetSpeed, 'for', src);
    }
  }
  
  /**
   * Handle when media is paused
   */
  function handleMediaPause(element) {
    const elementInfo = trackedElements.get(element);
    if (!elementInfo) return;
    
    elementInfo.isPlaying = false;
    activeMediaElements.delete(element);
    
          console.log('OneTab Media: Media paused');
    
    // Only notify if there are no other playing media elements
    if (activeMediaElements.size === 0) {
      sendMessage({
        type: 'MEDIA_PAUSED'
      });
    }
  }
  
  /**
   * Handle when media ends
   */
  function handleMediaEnd(element) {
    const elementInfo = trackedElements.get(element);
    if (!elementInfo) return;
    
    elementInfo.isPlaying = false;
    activeMediaElements.delete(element);
    
          console.log('OneTab Media: Media ended');
    
    // Only notify if there are no other playing media elements
    if (activeMediaElements.size === 0) {
      sendMessage({
        type: 'MEDIA_ENDED'
      });
    }
  }
  
  /**
   * Detect Web Audio API usage (for web-based music players)
   */
  function detectWebAudioUsage() {
    if (!window.AudioContext && !window.webkitAudioContext) {
      return;
    }
    
    // Override AudioContext methods to detect audio playback
    const OriginalAudioContext = window.AudioContext || window.webkitAudioContext;
    
    if (OriginalAudioContext && !OriginalAudioContext._mediaTabManagerPatched) {
      const originalCreateGain = OriginalAudioContext.prototype.createGain;
      const originalCreateBufferSource = OriginalAudioContext.prototype.createBufferSource;
      
      // Patch createGain to detect volume changes
      OriginalAudioContext.prototype.createGain = function() {
        const gainNode = originalCreateGain.call(this);
        
        // Monitor gain changes as a proxy for playback state
        const originalConnect = gainNode.connect;
        gainNode.connect = function(destination) {
          // If connecting to speakers/destination, likely starting playback
          if (destination === this.context.destination) {
            setTimeout(() => {
              sendMessage({
                type: 'MEDIA_STARTED',
                mediaInfo: {
                  type: 'webaudio',
                  src: 'Web Audio API',
                  title: document.title
                }
              });
            }, 100);
          }
          return originalConnect.apply(this, arguments);
        };
        
        return gainNode;
      };
      
      OriginalAudioContext._mediaTabManagerPatched = true;
    }
  }
  
  /**
   * Apply settings update from options page
   */
  function applySettingsUpdate(newSettings) {
    try {
      console.log('OneTab Media: Applying settings update:', newSettings);
      
      // Update speedSettings with new values
      if (newSettings.enabled !== undefined) speedSettings.enabled = newSettings.enabled;
      if (newSettings.showController !== undefined) speedSettings.showController = newSettings.showController;
      if (newSettings.startHidden !== undefined) speedSettings.startHidden = newSettings.startHidden;
      if (newSettings.rememberSpeed !== undefined) speedSettings.rememberSpeed = newSettings.rememberSpeed;
      if (newSettings.forceLastSavedSpeed !== undefined) speedSettings.forceLastSavedSpeed = newSettings.forceLastSavedSpeed;
      if (newSettings.controllerOpacity !== undefined) speedSettings.controllerOpacity = newSettings.controllerOpacity;
      if (newSettings.speed !== undefined) speedSettings.lastSpeed = newSettings.speed;
      if (newSettings.displayKeyCode !== undefined) speedSettings.displayKeyCode = newSettings.displayKeyCode;
      if (newSettings.keyBindings !== undefined) speedSettings.keyBindings = newSettings.keyBindings;
      if (newSettings.blacklist !== undefined) speedSettings.blacklist = newSettings.blacklist;
      
      // Apply settings to existing video controllers
      activeMediaElements.forEach(element => {
        if (element.vsc && element.vsc.isInitialized) {
                            // Update controller opacity
          if (newSettings.controllerOpacity !== undefined) {
            try {
              const controller = element.vsc.controller;
              if (controller) {
                controller.style.opacity = newSettings.controllerOpacity;
              }
            } catch (error) {
              console.warn('OneTab Media: Failed to update controller opacity:', error);
            }
          }
          
          // Update visibility based on showController setting
          if (newSettings.showController !== undefined) {
            try {
              const wrapper = element.vsc.div;
              if (wrapper) {
                if (newSettings.showController) {
                  wrapper.classList.remove('vsc-hidden');
                } else {
                  wrapper.classList.add('vsc-hidden');
                }
              }
            } catch (error) {
              console.warn('OneTab Media: Failed to update controller visibility:', error);
            }
          }
          
          // Apply default speed if forceLastSavedSpeed is enabled
          if (newSettings.forceLastSavedSpeed && newSettings.speed !== undefined) {
            try {
              element.playbackRate = newSettings.speed;
              if (element.vsc.setSpeed) {
                element.vsc.setSpeed(newSettings.speed);
              }
            } catch (error) {
              console.warn('OneTab Media: Failed to apply speed setting:', error);
            }
          }
        }
      });
      
      console.log('OneTab Media: Settings update applied successfully');
    } catch (error) {
      console.error('OneTab Media: Failed to apply settings update:', error);
    }
  }

  /**
   * Set up message listener for commands from background script
   */
  function setupMessageListener() {
    browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.type) {
        case 'PAUSE_MEDIA':
          pauseAllMedia();
          break;
          
        case 'SET_SPEED':
          setSpeedForAllMedia(message.speed);
          break;
          
        case 'SPEED_ACTION':
          runSpeedAction(message.action, message.value);
          break;
          
        case 'GET_MEDIA_STATE':
          const mediaState = [];
          activeMediaElements.forEach(element => {
            mediaState.push({
              src: element.src || element.currentSrc,
              playbackRate: element.playbackRate,
              currentTime: element.currentTime,
              duration: element.duration,
              paused: element.paused
            });
          });
          
          sendResponse({
            hasActiveMedia: activeMediaElements.size > 0,
            mediaCount: activeMediaElements.size,
            mediaElements: mediaState,
            speedSettings: speedSettings
          });
          break;
          
        case 'SETTINGS_UPDATED':
          applySettingsUpdate(message.settings);
          break;
          
        case 'UPDATE_SPEED_SETTINGS':
          Object.assign(speedSettings, message.settings);
          saveSpeedSettings();
          break;
          
        default:
          console.warn('Unknown message type:', message.type);
      }
      
      return true;
    });
  }

  /**
   * Set speed for all active media elements
   */
  function setSpeedForAllMedia(speed) {
    activeMediaElements.forEach(element => {
      setSpeed(element, speed);
    });
  }
  
  /**
   * Pause all media elements in this tab
   */
  function pauseAllMedia() {
          console.log('OneTab Media: Pausing all media in tab');
    
    // Pause HTML5 media elements
    activeMediaElements.forEach(element => {
      if (element && typeof element.pause === 'function') {
        element.pause();
      }
    });
    
    // For Web Audio API, we can't directly pause, but we can try common patterns
    pauseWebAudioMedia();
    
    // Try to find and click pause buttons (fallback for complex players)
    pauseViaUI();
  }
  

  
  /**
   * Attempt to pause Web Audio API media
   */
  function pauseWebAudioMedia() {
    // This is a best-effort approach since Web Audio API doesn't have standard pause
    try {
      // Look for common Web Audio patterns
      if (window.audioContext) {
        // Try to suspend the audio context
        if (typeof window.audioContext.suspend === 'function') {
          window.audioContext.suspend();
        }
      }
    } catch (error) {
      console.warn('Failed to pause Web Audio API:', error);
    }
  }
  

  
  /**
   * Try to pause media by clicking pause buttons (fallback method)
   */
  function pauseViaUI() {
    // Common selectors for pause buttons
    const pauseSelectors = [
      '[aria-label*="pause" i]',
      '[title*="pause" i]',
      '.pause-button',
      '.pause-btn',
      '.play-pause-button.playing',
      '.ytp-play-button[aria-label*="Pause"]', // YouTube
      '[data-testid="control-button-playpause"]', // Spotify
      '.playerBarPlay', // Various players
      '.pause'
    ];
    
    pauseSelectors.forEach(selector => {
      try {
        const buttons = document.querySelectorAll(selector);
        buttons.forEach(button => {
          if (button && typeof button.click === 'function') {
            // Check if button appears to be a pause button
            const text = button.textContent || button.getAttribute('aria-label') || button.getAttribute('title') || '';
            if (text.toLowerCase().includes('pause')) {
              button.click();
              console.log('OneTab Media: Clicked pause button via selector', selector);
            }
          }
        });
      } catch (error) {
        console.warn('Error trying pause selector', selector, error);
      }
    });
  }
  

  
  /**
   * Observe document changes for dynamic content
   */
  /**
   * Clean up all VideoControllers and tracked elements
   */
  function cleanupAllMediaElements() {
    try {
      // Clean up all VideoControllers
      trackedElements.forEach((info, element) => {
        if (element.vsc && typeof element.vsc.remove === 'function') {
          element.vsc.remove();
          element.vsc = null;
        }
      });
      
      // Clear all tracking data
      trackedElements.clear();
      activeMediaElements.clear();
      
      console.log('OneTab Media: Cleaned up all media elements and controllers');
    } catch (error) {
      console.warn('OneTab Media: Error during full cleanup:', error);
    }
  }

  function observeDocumentChanges() {
    // Handle single-page app navigation
    let lastUrl = location.href;
    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        console.log('OneTab Media: Page navigation detected, cleaning up and re-scanning for media');
        
        // Clean up all existing controllers before re-scanning
        cleanupAllMediaElements();
        
        setTimeout(() => {
          detectExistingMedia();
        }, 1000);
      }
    }).observe(document, { subtree: true, childList: true });
  }
  
  /**
   * Send message to background script
   */
  function sendMessage(message) {
    try {
      browserAPI.runtime.sendMessage(message);
    } catch (error) {
      console.warn('Failed to send message to background script:', error);
    }
  }
  
  /**
   * Debounce media state changes to avoid spam
   */
  function debounceMediaStateChange(callback, delay = 100) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(callback, delay);
  }
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    console.log('OneTab Media: DOM still loading, waiting...');
    document.addEventListener('DOMContentLoaded', () => {
      console.log('OneTab Media: DOM loaded, initializing...');
      initialize();
    });
  } else {
    console.log('OneTab Media: DOM already ready, initializing immediately...');
    initialize();
  }
  
  // Add some debugging for CSS loading
  console.log('OneTab Media: Content script loaded on', window.location.href);
  console.log('OneTab Media: Extension runtime URL:', browserAPI.runtime.getURL(''));
  
  // Check if CSS files exist
  fetch(browserAPI.runtime.getURL('shadow.css'))
    .then(response => {
      if (response.ok) {
        console.log('OneTab Media: shadow.css loaded successfully');
      } else {
        console.error('OneTab Media: Failed to load shadow.css:', response.status);
      }
    })
    .catch(error => {
      console.error('OneTab Media: Error loading shadow.css:', error);
    });
    
  fetch(browserAPI.runtime.getURL('controller.css'))
    .then(response => {
      if (response.ok) {
        console.log('OneTab Media: controller.css loaded successfully');
      } else {
        console.error('OneTab Media: Failed to load controller.css:', response.status);
      }
    })
    .catch(error => {
      console.error('OneTab Media: Error loading controller.css:', error);
    });
    
})(); 