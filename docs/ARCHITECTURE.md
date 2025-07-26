# Technical Architecture - Media Tab Manager

This document explains the technical architecture and implementation details of the Media Tab Manager extension.

## Overview

The Media Tab Manager extension uses a distributed architecture with three main components:

1. **Background Script** - Central coordinator and state manager
2. **Content Scripts** - Media detection and control in each tab
3. **Popup Interface** - User interface for monitoring and control

## Architecture Diagram

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Background    │    │   Content       │    │   Popup         │
│   Script        │◄──►│   Scripts       │    │   Interface     │
│                 │    │   (Each Tab)    │    │                 │
│ • State Mgmt    │    │ • Media Detect  │    │ • UI Display   │
│ • Tab Tracking  │    │ • Event Listen  │    │ • User Control │
│ • Cross-tab Msg │    │ • Media Control │    │ • Tab Switch   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Component Details

### Background Script (`src/common/background.js`)

**Purpose**: Acts as the central coordinator for all media-related activities across tabs.

**Key Responsibilities**:
- Maintains global state of all active media tabs
- Handles cross-tab communication
- Enforces "one tab playing" policy
- Updates extension badge
- Manages tab lifecycle events

**Data Structures**:
```javascript
// Global state tracking
activeMediaTabs: Map<tabId, {
  url: string,
  title: string,
  mediaType: 'video' | 'audio' | 'webaudio',
  timestamp: number,
  favicon: string
}>

currentPlayingTab: number | null
```

**Message Handling**:
- `MEDIA_STARTED` - When media begins in any tab
- `MEDIA_PAUSED` - When media pauses in any tab
- `MEDIA_ENDED` - When media ends in any tab
- `GET_ACTIVE_TABS` - For popup to get current state
- `PAUSE_TAB` - Command to pause specific tab

### Content Script (`src/common/content.js`)

**Purpose**: Injected into every webpage to detect and control media playback.

**Key Responsibilities**:
- Detect HTML5 video/audio elements
- Monitor Web Audio API usage
- Listen for media events (play, pause, ended)
- Control media elements when commanded
- Handle dynamic content changes

**Detection Methods**:

1. **HTML5 Media Elements**
   ```javascript
   // Direct event listeners on <video> and <audio> tags
   element.addEventListener('play', handleMediaPlay);
   element.addEventListener('pause', handleMediaPause);
   element.addEventListener('ended', handleMediaEnd);
   ```

2. **Web Audio API Detection**
   ```javascript
   // Monkey-patch AudioContext to detect usage
   OriginalAudioContext.prototype.createGain = function() {
     // Track when audio nodes connect to destination
   };
   ```

3. **Dynamic Content Monitoring**
   ```javascript
   // MutationObserver for SPAs and dynamic content
   new MutationObserver(checkForNewMediaElements);
   ```

**Media Control Methods**:

1. **Direct Control**: Call `.pause()` on HTML5 elements
2. **Web Audio Control**: Suspend AudioContext when possible
3. **UI Fallback**: Click pause buttons using common selectors

### Popup Interface (`src/common/popup/`)

**Purpose**: Provides user interface for monitoring and controlling media tabs.

**Components**:
- `popup.html` - Structure and layout
- `popup.css` - Modern, responsive styling
- `popup.js` - Interactive functionality

**Features**:
- Real-time status display
- List of all active media tabs
- Individual tab controls (pause, switch)
- Bulk operations (pause all)
- Auto-refresh every 2 seconds

## Communication Flow

### Media Detection Flow

```
1. Content Script detects media start
   ↓
2. Sends MEDIA_STARTED message to Background
   ↓
3. Background checks if another tab is playing
   ↓
4. If yes: Sends PAUSE_MEDIA to previous tab
   ↓
5. Background updates state and badge
   ↓
6. Previous tab content script pauses media
```

### User Control Flow

```
1. User clicks "Pause" in popup
   ↓
2. Popup sends PAUSE_TAB message to Background
   ↓
3. Background forwards PAUSE_MEDIA to target tab
   ↓
4. Content script executes pause logic
   ↓
5. Media events trigger state updates
   ↓
6. Popup refreshes to show new state
```

## Browser Compatibility

### Chrome (Manifest V3)
- Uses Service Worker for background script
- `chrome.action` API for extension icon
- `chrome.runtime.sendMessage` for communication

### Firefox (Manifest V2)
- Uses persistent background page
- `browser.browserAction` API for extension icon
- `browser.runtime.sendMessage` for communication

### Cross-Browser Compatibility Layer
```javascript
const browserAPI = (function() {
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    return chrome;
  } else if (typeof browser !== 'undefined' && browser.runtime) {
    return browser;
  }
  return null;
})();
```

## Security Model

### Permissions Required

1. **`tabs`** - Access tab information and switching
2. **`activeTab`** - Access current tab content
3. **`storage`** - Store extension settings (future use)
4. **`http://*/*`, `https://*/*`** - Access all websites for media detection

### Security Considerations

1. **Content Script Sandbox**: Scripts run in isolated world
2. **Message Validation**: All cross-component messages are validated
3. **No External Network**: Extension makes no external requests
4. **Minimal Permissions**: Only requests necessary permissions

## Performance Optimizations

### Efficient Media Detection

1. **Event-Driven**: Uses native DOM events instead of polling
2. **Debounced Updates**: Prevents spam from rapid state changes
3. **WeakMap Storage**: Automatic cleanup of element references
4. **Lazy Loading**: Content scripts only activate when needed

### Memory Management

1. **Automatic Cleanup**: Removes closed tabs from state
2. **Weak References**: Uses WeakMap for DOM element tracking
3. **Limited State**: Only stores essential tab information
4. **Debounced Operations**: Prevents excessive function calls

### Cross-Tab Efficiency

1. **Centralized State**: Single source of truth in background
2. **Targeted Messages**: Only sends messages to relevant tabs
3. **State Reconciliation**: Periodic cleanup of stale data

## Extensibility

### Adding New Media Types

1. Extend content script detection methods
2. Add new mediaType values to data structures
3. Implement control methods for new media types
4. Update UI to display new types

### Adding New Features

1. **Whitelist/Blacklist**: Domain-based filtering
2. **Custom Rules**: Site-specific behavior
3. **Media Preferences**: User-defined priority rules
4. **Analytics**: Usage tracking and statistics

## Testing Strategy

### Unit Testing
- Background script message handling
- Content script media detection
- Popup interface interactions

### Integration Testing
- Cross-component communication
- End-to-end media control flow
- Browser compatibility testing

### Manual Testing
- Major media websites (YouTube, Netflix, Spotify)
- Different media types (video, audio, Web Audio)
- Edge cases (multiple media per page, dynamic content)

## Known Limitations

1. **Web Audio API**: Limited control over complex audio contexts
2. **Flash/Legacy Media**: No support for legacy plugin-based media
3. **Protected Content**: Some DRM-protected content may not be controllable
4. **Site-Specific Players**: Custom media players may require special handling
5. **iframe Content**: Media in cross-origin iframes may not be detected

## Future Improvements

1. **Machine Learning**: Better media detection using ML models
2. **Advanced Rules**: User-configurable priority and behavior rules
3. **Media Analytics**: Usage statistics and insights
4. **Cloud Sync**: Cross-device state synchronization
5. **Enhanced UI**: More detailed media information and controls 