/**
 * UME - Ultimate Media Extention - Popup Script
 * Handles the popup interface for managing media across browser tabs
 */

(function() {
  'use strict';
  
  // Extension loaded successfully
  
  // Browser compatibility layer
  const browserAPI = (function() {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      return chrome;
    } else if (typeof browser !== 'undefined' && browser.runtime) {
      return browser;
    }
    return null;
  })();
  
  // DOM elements
  let statusDot, statusText, tabsList, noTabsMessage, pauseAllButton, refreshButton;
  let extensionToggle, toggleLabel, footerStatus, popupContainer;
  let speedControlSection, currentSpeedDisplay;
  let optionsButton;
  
  // State
  let currentTabs = [];
  let isExtensionEnabled = true;
  let currentSpeed = 1.0;
  let speedSettings = {};
  
  /**
   * Initialize popup when DOM is loaded
   */
  function initialize() {
    // Get DOM elements
    getElements();
    
    // Set up event listeners
    setupEventListeners();
    
    // Load extension settings
    loadExtensionSettings();
    
    // Load initial data
    loadTabsData();
    
    // Listen for changes from background script
    setupBackgroundListener();
  }
  
  /**
   * Get all required DOM elements
   */
  function getElements() {
    statusDot = document.getElementById('statusDot');
    statusText = document.getElementById('statusText');
    tabsList = document.getElementById('tabsList');
    noTabsMessage = document.getElementById('noTabsMessage');
    pauseAllButton = document.getElementById('pauseAllButton');
    refreshButton = document.getElementById('refreshButton');
    extensionToggle = document.getElementById('extensionToggle');
    toggleLabel = document.getElementById('toggleLabel');
    footerStatus = document.getElementById('footerStatus');
    popupContainer = document.querySelector('.popup-container');
    
    // Speed control elements
    speedControlSection = document.getElementById('speedControlSection');
    currentSpeedDisplay = document.getElementById('currentSpeed');
    optionsButton = document.getElementById('optionsButton');
  }
  
  /**
   * Set up event listeners for user interactions
   */
  function setupEventListeners() {
    // Pause all button
    pauseAllButton?.addEventListener('click', handlePauseAll);
    
    // Refresh button
    refreshButton?.addEventListener('click', handleRefresh);
    
    // Options button
    optionsButton?.addEventListener('click', handleOptions);
    
    // Extension toggle
    extensionToggle?.addEventListener('change', handleExtensionToggle);
    
    // Refresh when popup becomes visible (user opens it)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        loadTabsData();
      }
    });
  }
  
  /**
   * Set up listener for background script notifications
   */
  function setupBackgroundListener() {
    // Listen for messages from background script about media changes
    browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'MEDIA_STATE_CHANGED') {
        // Refresh popup data when media state changes
        loadTabsData();
      }
    });
  }
  
  /**
   * Load extension settings from storage
   */
  async function loadExtensionSettings() {
    try {
      const result = await browserAPI.storage.local.get(['extensionEnabled']);
      // Handle case where result is undefined or doesn't have the property
      isExtensionEnabled = result && result.extensionEnabled === false ? false : true; // Default to true
      updateExtensionToggleUI();
    } catch (error) {
      console.error('Failed to load extension settings:', error);
      isExtensionEnabled = true;
      updateExtensionToggleUI();
    }
  }
  
  /**
   * Update extension toggle UI
   */
  function updateExtensionToggleUI() {
    if (extensionToggle) {
      extensionToggle.checked = isExtensionEnabled;
    }
    if (toggleLabel) {
      toggleLabel.textContent = isExtensionEnabled ? 'Enabled' : 'Disabled';
    }
    if (footerStatus) {
      footerStatus.textContent = isExtensionEnabled 
        ? 'Extension active on all tabs'
        : 'Extension disabled';
    }
    if (popupContainer) {
      popupContainer.classList.toggle('disabled', !isExtensionEnabled);
    }
  }
  
  /**
   * Handle extension toggle change
   */
  async function handleExtensionToggle() {
    try {
      isExtensionEnabled = extensionToggle.checked;
      
      // Save to storage
      await browserAPI.storage.local.set({ extensionEnabled: isExtensionEnabled });
      
      // Notify background script
      await sendMessage({ 
        type: 'EXTENSION_TOGGLE',
        enabled: isExtensionEnabled
      });
      
      // Update UI
      updateExtensionToggleUI();
      
      // Refresh data
      loadTabsData();
      
    } catch (error) {
      console.error('Failed to toggle extension:', error);
      showError('Failed to toggle extension');
    }
  }
  
  /**
   * Load tabs data from background script
   */
  async function loadTabsData() {
    try {
      const response = await sendMessage({ type: 'GET_ACTIVE_TABS' });
      
      console.log('DEBUG: Received response from GET_ACTIVE_TABS:', response);
      
      if (response) {
        updateUI(response);
      } else {
        console.log('DEBUG: No response received, showing empty state');
        // Show empty state instead of error
        updateUI({ activeTabs: [], currentPlaying: null });
      }
    } catch (error) {
      console.error('Failed to load tabs data:', error);
      showError('Failed to load media tabs');
    }
  }
  
  /**
   * Update the popup UI with current tab data
   */
  function updateUI(data) {
    const { activeTabs = [], currentPlaying } = data;
    currentTabs = activeTabs;
    
    console.log('DEBUG: updateUI called with data:', data);
    console.log('DEBUG: activeTabs:', activeTabs);
    console.log('DEBUG: currentPlaying:', currentPlaying);
    
    // Update status indicator
    updateStatus(activeTabs.length, currentPlaying);
    
    // Update tabs list
    updateTabsList(activeTabs, currentPlaying);
    
    // Update controls
    updateControls(activeTabs.length);
    
    // Update speed controls
    updateSpeedControls(activeTabs);
  }
  
  /**
   * Update status indicator
   */
  function updateStatus(activeCount, currentPlaying) {
    if (!statusDot || !statusText) return;
    
    if (!isExtensionEnabled) {
      statusDot.className = 'status-dot inactive';
      statusText.textContent = 'Extension disabled';
    } else if (activeCount === 0) {
      statusDot.className = 'status-dot inactive';
      statusText.textContent = 'No active media';
    } else if (currentPlaying) {
      statusDot.className = 'status-dot active';
      statusText.textContent = `Media playing (${activeCount} tab${activeCount !== 1 ? 's' : ''})`;
    } else {
      statusDot.className = 'status-dot inactive';
      statusText.textContent = `${activeCount} tab${activeCount !== 1 ? 's' : ''} with media`;
    }
  }
  
  /**
   * Update the tabs list
   */
  function updateTabsList(tabs, currentPlaying) {
    if (!tabsList || !noTabsMessage) return;
    
    // Clear existing content
    tabsList.innerHTML = '';
    
    if (tabs.length === 0) {
      // Show no tabs message
      tabsList.style.display = 'none';
      noTabsMessage.style.display = 'block';
      return;
    }
    
    // Hide no tabs message and show tabs list
    noTabsMessage.style.display = 'none';
    tabsList.style.display = 'flex';
    
    // Create tab items
    tabs.forEach((tabData) => {
      const { tabId, ...tabInfo } = tabData;
      const tabItem = createTabItem(tabId, tabInfo, tabId === currentPlaying);
      tabsList.appendChild(tabItem);
    });
  }
  
  /**
   * Create a tab item element
   */
  function createTabItem(tabId, tabInfo, isPlaying) {
    const tabItem = document.createElement('div');
    tabItem.className = `tab-item ${isPlaying ? 'playing' : 'paused'} fade-in`;
    tabItem.setAttribute('data-tab-id', tabId);
    
    // Create favicon
    let favicon = document.createElement('img');
    favicon.className = 'tab-favicon';
    if (tabInfo.favicon) {
      favicon.src = tabInfo.favicon;
      favicon.onerror = () => {
        const placeholder = createFaviconPlaceholder(favicon, tabInfo.mediaType);
        if (placeholder && favicon.parentNode) {
          // createFaviconPlaceholder already handled the replacement
        }
      };
    } else {
      // No favicon URL, use placeholder directly
      const placeholder = createFaviconPlaceholder(favicon, tabInfo.mediaType);
      if (placeholder) {
        favicon = placeholder; // Use the placeholder element instead
      }
    }
    
    // Create tab info
    const tabInfoDiv = document.createElement('div');
    tabInfoDiv.className = 'tab-info';
    
    const tabTitle = document.createElement('div');
    tabTitle.className = 'tab-title';
    tabTitle.textContent = tabInfo.title || 'Unknown Title';
    tabTitle.title = tabInfo.title || 'Unknown Title';
    
    const tabUrl = document.createElement('div');
    tabUrl.className = 'tab-url';
    const urlText = formatUrl(tabInfo.url);
    tabUrl.textContent = urlText;
    tabUrl.title = tabInfo.url;
    
    tabInfoDiv.appendChild(tabTitle);
    tabInfoDiv.appendChild(tabUrl);
    
    // Create status indicator
    const statusDiv = document.createElement('div');
    statusDiv.className = `tab-status ${isPlaying ? 'playing' : 'paused'}`;
    
    const statusIcon = document.createElement('span');
    statusIcon.textContent = isPlaying ? '▶️' : '⏸️';
    
    const statusText = document.createElement('span');
    const playbackRate = tabInfo.playbackRate || 1.0;
    statusText.textContent = isPlaying ? `Playing (${playbackRate.toFixed(2)}x)` : 'Paused';
    
    statusDiv.appendChild(statusIcon);
    statusDiv.appendChild(statusText);
    
    // Create controls
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'tab-controls';
    
    // Pause button (only show if playing)
    const pauseBtn = document.createElement('button');
    pauseBtn.className = 'tab-control-btn';
    pauseBtn.innerHTML = '⏸️';
    pauseBtn.title = 'Pause this tab';
    pauseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      pauseTab(tabId);
    });
    pauseBtn.style.display = isPlaying ? 'flex' : 'none';
    
    const focusBtn = document.createElement('button');
    focusBtn.className = 'tab-control-btn';
    focusBtn.innerHTML = '🔍';
    focusBtn.title = 'Switch to this tab';
    focusBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      switchToTab(tabId);
    });
    
    controlsDiv.appendChild(pauseBtn);
    controlsDiv.appendChild(focusBtn);
    
    // Add click handler for tab item
    tabItem.addEventListener('click', () => switchToTab(tabId));
    
    // Assemble the tab item
    tabItem.appendChild(favicon);
    tabItem.appendChild(tabInfoDiv);
    tabItem.appendChild(statusDiv);
    tabItem.appendChild(controlsDiv);
    
    return tabItem;
  }
  
  /**
   * Create a placeholder favicon when image fails to load
   */
  function createFaviconPlaceholder(imgElement, mediaType) {
    // Replace img with div for placeholder
    const placeholder = document.createElement('div');
    placeholder.className = 'tab-favicon placeholder';
    placeholder.textContent = mediaType === 'video' ? '📹' : '🎵';
    
    // Check if imgElement has a parent before replacing
    if (imgElement.parentNode) {
      imgElement.parentNode.replaceChild(placeholder, imgElement);
    } else {
      // If no parent, copy the className and return the placeholder
      // This handles cases where the element isn't in the DOM yet
      placeholder.className = imgElement.className + ' placeholder';
      return placeholder;
    }
  }
  
  /**
   * Format URL for display
   */
  function formatUrl(url) {
    if (!url) return 'Unknown URL';
    
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (error) {
      return url.length > 30 ? url.substring(0, 30) + '...' : url;
    }
  }
  
  /**
   * Update control buttons state
   */
  function updateControls(activeCount) {
    if (!pauseAllButton) return;
    
    pauseAllButton.disabled = activeCount === 0 || !isExtensionEnabled;
  }
  
  /**
   * Handle pause all button click
   */
  async function handlePauseAll() {
    try {
      showLoading(pauseAllButton);
      
      // Pause all active tabs
      for (const tabData of currentTabs) {
        await pauseTab(tabData.tabId);
      }
      
      // Refresh data after a short delay
      setTimeout(() => {
        loadTabsData();
        hideLoading(pauseAllButton);
      }, 1000);
      
    } catch (error) {
      console.error('Failed to pause all tabs:', error);
      hideLoading(pauseAllButton);
      showError('Failed to pause all media');
    }
  }
  
  /**
   * Handle refresh button click
   */
  async function handleRefresh() {
    try {
      showLoading(refreshButton);
      await loadTabsData();
      hideLoading(refreshButton);
    } catch (error) {
      console.error('Failed to refresh data:', error);
      hideLoading(refreshButton);
      showError('Failed to refresh data');
    }
  }

  /**
   * Handle options button click
   */
  async function handleOptions() {
    try {
      await browserAPI.runtime.openOptionsPage();
    } catch (error) {
      console.error('Failed to open options page:', error);
      showError('Failed to open options page');
    }
  }
  
  /**
   * Pause media in a specific tab
   */
  async function pauseTab(tabId) {
    try {
      await sendMessage({ type: 'PAUSE_TAB', tabId });
    } catch (error) {
      console.error(`Failed to pause tab ${tabId}:`, error);
      throw error;
    }
  }
  

  
  /**
   * Switch to a specific tab
   */
  async function switchToTab(tabId) {
    try {
      await browserAPI.tabs.update(parseInt(tabId), { active: true });
      window.close(); // Close popup after switching
    } catch (error) {
      console.error(`Failed to switch to tab ${tabId}:`, error);
      showError('Failed to switch to tab');
    }
  }
  
  /**
   * Update speed controls based on current tab data
   */
  function updateSpeedControls(tabs) {
    if (!speedControlSection) return;
    
    const playingTabs = tabs.filter(tab => tab.isPlaying);
    const hasPlayingMedia = playingTabs.length > 0;
    
    // Show/hide speed controls based on media presence
    if (hasPlayingMedia) {
      speedControlSection.classList.remove('disabled');
      
      // Get the speed of the first playing tab (assume all have same speed for simplicity)
      const firstPlayingTab = playingTabs[0];
      if (firstPlayingTab.playbackRate !== undefined) {
        updateSpeedDisplay(firstPlayingTab.playbackRate);
      }
    } else {
      speedControlSection.classList.add('disabled');
      updateSpeedDisplay(1.0);
    }
  }

  /**
   * Update speed display in the popup
   */
  function updateSpeedDisplay(speed) {
    if (currentSpeedDisplay) {
      currentSpeed = speed;
      currentSpeedDisplay.textContent = speed.toFixed(2) + 'x';
    }
  }

  /**
   * Send message to background script
   */
  function sendMessage(message) {
    return new Promise((resolve, reject) => {
      try {
        // Firefox compatibility - sometimes the callback isn't needed
        if (typeof browser !== 'undefined' && browser.runtime) {
          // Firefox approach
          const result = browserAPI.runtime.sendMessage(message);
          if (result && typeof result.then === 'function') {
            // Firefox returns a Promise
            result.then(resolve).catch(reject);
          } else {
            // Fallback to callback approach
            browserAPI.runtime.sendMessage(message, (response) => {
              if (browserAPI.runtime.lastError) {
                reject(new Error(browserAPI.runtime.lastError.message));
              } else {
                resolve(response);
              }
            });
          }
        } else {
          // Chrome approach
          browserAPI.runtime.sendMessage(message, (response) => {
            if (browserAPI.runtime.lastError) {
              reject(new Error(browserAPI.runtime.lastError.message));
            } else {
              resolve(response);
            }
          });
        }
      } catch (error) {
        reject(error);
      }
    });
  }
  
  /**
   * Show loading state on button
   */
  function showLoading(button) {
    if (!button) return;
    
    button.disabled = true;
    const originalText = button.querySelector('.button-text')?.textContent;
    const textElement = button.querySelector('.button-text');
    
    if (textElement) {
      textElement.textContent = 'Loading...';
      button.setAttribute('data-original-text', originalText);
    }
  }
  
  /**
   * Hide loading state on button
   */
  function hideLoading(button) {
    if (!button) return;
    
    button.disabled = false;
    const originalText = button.getAttribute('data-original-text');
    const textElement = button.querySelector('.button-text');
    
    if (textElement && originalText) {
      textElement.textContent = originalText;
      button.removeAttribute('data-original-text');
    }
  }
  
  /**
   * Show error message
   */
  function showError(message) {
    // Create a simple error toast
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: #dc3545;
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 1000;
      animation: fadeIn 0.3s ease;
    `;
    errorDiv.textContent = message;
    
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
      errorDiv.remove();
    }, 3000);
  }

  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
  
})(); 