/**
 * OneTab Media - Content Script
 * Detects media playback events and communicates with background script
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
  
  // Debounce timer for media state changes
  let debounceTimer = null;
  
      console.log('OneTab Media: Content script loaded on', window.location.href);
  
  /**
   * Initialize content script
   */
  function initialize() {
    setupMediaDetection();
    setupMessageListener();
    
    // Handle dynamic content loading
    observeDocumentChanges();
  }
  
  /**
   * Set up detection for existing and new media elements
   */
  function setupMediaDetection() {
    // Detect existing media elements
    detectExistingMedia();
    
    // Watch for new media elements
    const mediaObserver = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            checkForMediaElements(node);
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
   * Detect all existing media elements on the page
   */
  function detectExistingMedia() {
    const videoElements = document.querySelectorAll('video');
    const audioElements = document.querySelectorAll('audio');
    
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
    
    // Volume change (to detect mute/unmute)
    element.addEventListener('volumechange', () => {
      const elementInfo = trackedElements.get(element);
      if (elementInfo && elementInfo.isPlaying) {
        // If media is playing and volume changed, notify about state
        debounceMediaStateChange(() => {
          if (element.muted || element.volume === 0) {
            handleMediaPause(element);
          } else {
            handleMediaPlay(element);
          }
        });
      }
    });
    
    // Check if element is already playing
    if (!element.paused) {
      handleMediaPlay(element);
    }
    
            console.log('OneTab Media: Attached listeners to', element.tagName, element.src || element.currentSrc);
  }
  
  /**
   * Handle when media starts playing
   */
  function handleMediaPlay(element) {
    const elementInfo = trackedElements.get(element);
    if (!elementInfo) return;
    
    elementInfo.isPlaying = true;
    activeMediaElements.add(element);
    
    const mediaInfo = {
      type: elementInfo.mediaType,
      src: element.src || element.currentSrc,
      title: element.title || document.title,
      duration: element.duration,
      currentTime: element.currentTime,
      volume: element.volume,
      muted: element.muted
    };
    
          console.log('OneTab Media: Media started playing', mediaInfo);
    
    // Notify background script
    sendMessage({
      type: 'MEDIA_STARTED',
      mediaInfo: mediaInfo
    });
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
   * Set up message listener for commands from background script
   */
  function setupMessageListener() {
    browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.type) {
        case 'PAUSE_MEDIA':
          pauseAllMedia();
          break;
          

          
        case 'GET_MEDIA_STATE':
          sendResponse({
            hasActiveMedia: activeMediaElements.size > 0,
            mediaCount: activeMediaElements.size
          });
          break;
          
        default:
          console.warn('Unknown message type:', message.type);
      }
      
      return true;
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
  function observeDocumentChanges() {
    // Handle single-page app navigation
    let lastUrl = location.href;
    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        console.log('OneTab Media: Page navigation detected, re-scanning for media');
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
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
  
})(); 