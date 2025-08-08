# UME - Ultimate Media Extension - Changelog

## Version 3.2 (August 2025)

### ✨ UI/UX
- New Options v3 design using `options.v3.css` (Chrome/Firefox)
- Themeable light/dark with cross-device sync and toggles in Popup/Options
- Dark-mode parity for Keyboard Shortcuts, inputs, sliders, toggles
- Subtle animations (card lift, button sheen, toggle sweep) and refined header visuals

### ⚙️ Settings & Reliability
- Robust initialization: migrate local→sync first; fill only missing keys
- Prevent defaults from reapplying on every open via `settingsInitialized`

### 📦 Packaging
- Bump manifests to version 3.2

## Version 3.0 (December 2024)

### 🚨 CRITICAL BUG FIX: Simultaneous Playback Prevention

**MAJOR BREAKTHROUGH:** Completely resolved the simultaneous playback issue that was causing media to play in multiple tabs at the same time.

#### Root Cause Identified & Fixed
The extension's `activeMediaTabs` tracking system was being inappropriately cleared in three critical scenarios:

1. **Extension Startup Clearing (FIXED)** 🔧
   - **Problem:** `activeMediaTabs.clear()` was called on every background script restart
   - **Impact:** All tracked media tabs would disappear, causing simultaneous playback
   - **Solution:** Removed startup clearing - tabs are now preserved across extension restarts

2. **Media Ended Removal (FIXED)** 🔧  
   - **Problem:** Tabs were deleted from tracking when media finished playing
   - **Impact:** Tabs couldn't be properly managed for replay, leading to conflicts
   - **Solution:** Keep tabs tracked after media ends for potential replay

3. **Communication Failure Removal (FIXED)** 🔧
   - **Problem:** Network issues or suspended tabs caused tabs to be removed from tracking  
   - **Impact:** Temporary communication failures would break tab management
   - **Solution:** Maintain tab tracking despite communication errors

#### New Ultra-Conservative Tab Tracking System
- ✅ **Persistent Across Restarts:** Media tabs survive extension background script restarts
- ✅ **Indefinite Paused Media Tracking:** Paused media tabs NEVER disappear based on time
- ✅ **Network Resilience:** Communication failures don't remove tabs from tracking
- ✅ **Replay Support:** Tabs remain tracked after media ends for potential replay
- ✅ **Smart Cleanup:** Only removes tabs when actually closed or navigated to different domains

#### Volume Booster Enhancements
- ✅ **Added Volume Shortcuts to Options Page:** Up/Down arrow keys now appear in Settings → Keyboard Shortcuts
- ✅ **Customizable Volume Controls:** Users can modify volume shortcuts in extension options
- ✅ **Cross-Browser Compatibility:** Fixed volume control issues in both Chrome and Firefox popups

#### Testing & Quality Assurance
- ✅ **Comprehensive Test Suite:** Updated test page with specific simultaneous playback tests
- ✅ **Enhanced Debug Logging:** Improved console logging for easier troubleshooting
- ✅ **Multi-Tab Verification:** Extensive testing across multiple browser tabs

### 🎯 Impact Summary
**Before Version 3.0:**
- ❌ Multiple tabs could play media simultaneously 
- ❌ Paused media tabs disappeared after a few minutes
- ❌ Extension restarts broke media tracking
- ❌ Communication failures removed tabs inappropriately
- ❌ Volume shortcuts missing from options page

**After Version 3.0:**
- ✅ **ZERO simultaneous playback issues**
- ✅ **Perfect tab persistence** - tabs tracked until actually closed
- ✅ **Bulletproof tracking system** - survives restarts and network issues  
- ✅ **Complete volume control integration**
- ✅ **Professional-grade reliability**

### 🙏 Credits & Acknowledgments

Version 3.0 integrates and builds upon excellent open-source projects:

- **[Video Speed Controller](https://github.com/igrigorik/videospeed) by @igrigorik**: Core speed control functionality, keyboard shortcuts, and visual overlay system
- **[Better-Volume-Booster](https://github.com/zWolfrost/Better-Volume-Booster) by @zWolfrost**: Web Audio API volume amplification and audio enhancement

UME enhances these foundations with seamless integration, ultra-conservative tab tracking, cross-browser compatibility, and comprehensive media management.

----

## Version 2.5 (December 2024)

### 🎮 Complete Fullscreen Keyboard Shortcuts Fix

#### Fixed: Critical Edge Cases in Fullscreen Mode
- **Problem**: Keyboard shortcuts worked for playing videos in fullscreen, but failed in two critical scenarios:
  1. **Paused videos in fullscreen** - shortcuts completely non-functional when video was paused
  2. **Fullscreen transitions** - shortcuts stopped working when entering/exiting fullscreen mode
- **Root Cause**: Extension logic only processed actively playing media, ignoring paused media elements
- **Solution**: Comprehensive media detection and event handling overhaul:
  - **Universal Media Processing**: Now works with both playing AND paused media elements
  - **Multi-Layer Event Capture**: Window-level + Document-level + Page-level script injection
  - **Aggressive Event Prevention**: Added `stopImmediatePropagation()` to prevent player interference
  - **Enhanced Media Detection**: Processes all media elements on page, not just tracked active ones
  - **Transition State Handling**: Robust handling of fullscreen entry/exit states

### 🔧 Technical Architecture Improvements
- **Page-Level Script Injection**: Injects event handlers directly into page context for maximum effectiveness
- **Comprehensive Media Query**: `document.querySelectorAll('video, audio')` finds all media regardless of state
- **Smart Media Processing**: Prioritizes tracked elements but falls back to all page media if needed
- **Cross-Context Communication**: Window message passing between page-level and content script contexts
- **Enhanced Event Cleanup**: Proper cleanup of multi-layer event listeners

### 🎯 User Experience Enhancements
- **Complete Fullscreen Coverage**: Shortcuts now work in ALL fullscreen scenarios
- **Paused Media Control**: Change speed, rewind, advance even when video is paused in fullscreen
- **Seamless Transitions**: No interruption of shortcut functionality when entering/exiting fullscreen
- **Universal Compatibility**: Works across all video sites and HTML5 players
- **Consistent Behavior**: Identical functionality whether media is playing or paused

### 📊 Scenarios Now Supported
✅ **Playing video in fullscreen** - Full shortcut support  
✅ **Paused video in fullscreen** - Full shortcut support (NEW!)  
✅ **During fullscreen transitions** - Full shortcut support (NEW!)  
✅ **Regular windowed mode** - Full shortcut support (unchanged)  

---

## Version 2.3-2.4 (December 2024)

### 🎮 Initial Fullscreen Keyboard Shortcuts Implementation
- **Foundation Work**: Initial implementation of fullscreen keyboard shortcut support
- **Basic Event Handling**: Added dual event listeners and fullscreen detection
- **Cross-Browser Support**: Implemented webkit, moz, ms, and standard fullscreen prefixes
- **Focus Management**: Basic video element focusing for keyboard events

---

## Version 2.2 (December 2024)

### 🐛 Critical Bug Fix: Media Tab Tracking

#### Fixed: Media Tab Tracking Issues
- **Problem**: Tabs with media that were open for extended periods would stop being recognized as media tabs, causing the pause functionality to fail when switching between tabs
- **Root Cause**: Overly aggressive URL change cleanup logic was removing tabs from tracking for any URL modification, including:
  - Single Page Application (SPA) routing changes
  - Hash fragment changes (`#section1` → `#section2`)
  - Query parameter updates (`?t=30` → `?t=60`)
  - Video player URL updates during playback
- **Solution**: Implemented intelligent tab cleanup system with two key improvements:

#### 1. Smart URL Change Detection
- **Before**: Removed tabs on ANY URL change
- **After**: Only removes tabs when hostname changes (actual navigation to different sites)
- **Preserves tracking for**: SPA routing, hash changes, query parameters, and other same-site URL updates
- **Activity tracking**: Updates timestamp when URLs change on same hostname to mark tab as active

#### 2. Periodic Cleanup System
- **Frequency**: Runs every 5 minutes to verify tracked tabs
- **Stale threshold**: Removes tabs inactive for 30+ minutes
- **Handles**: Discarded tabs, closed tabs, and inaccessible tabs
- **Logging**: Detailed console logging for debugging purposes

### 🔧 Technical Improvements

- **Enhanced URL parsing**: Better error handling for malformed URLs
- **Improved memory management**: More efficient cleanup of stale tab references
- **Better error recovery**: Graceful handling of tab access failures
- **Enhanced debugging**: Added comprehensive logging for tab tracking operations

### 🎯 User Experience Improvements

- **Long-running tabs**: Media tabs can now stay tracked for hours without losing functionality
- **Complex web apps**: Better support for single-page applications with dynamic routing
- **Reliable pause behavior**: Switching between old media tabs now consistently pauses other playing media
- **Background cleanup**: Automatic maintenance ensures optimal performance

### 📊 Impact

- **Fixes reported issue**: Resolves the primary complaint about media tabs losing tracking over time
- **Improved reliability**: More stable media management across browser sessions
- **Better performance**: Reduced unnecessary tab cleanup operations
- **Enhanced compatibility**: Better support for modern web applications

---

## Version 2.1 (Previous Release)

### ⚙️ Settings System Overhaul
- Complete settings system redesign matching original VideoSpeed extension
- Cross-device sync using chrome.storage.sync
- Website blacklist functionality
- Force last saved speed option
- Default speed settings for videos
- Enhanced options UI with tabbed navigation
- Real-time settings broadcasting to content scripts
- Default settings initialization on extension startup

### 🎨 UI Improvements
- Modern, professional options page design
- Read-only popup showing current speed with instructions
- Better visual feedback and user guidance

### 🔧 Technical Enhancements
- Migration from local to sync storage
- Comprehensive settings validation
- Cleanup of deprecated settings
- Enhanced error handling and logging

---

## Installation Notes

### For Chrome
1. Download the latest release
2. Open Chrome Extensions (chrome://extensions)
3. Enable Developer Mode
4. Load unpacked extension from `chrome-extension` folder

### For Firefox
1. Download the latest release  
2. Open Firefox Add-ons (about:addons)
3. Click gear icon → Install Add-on From File
4. Select the extension file from `firefox-extension` folder

---

## Support

If you encounter any issues with version 2.2, please check the browser console for detailed logging information and report issues with:
- Browser version
- Extension version (2.2)
- Website where the issue occurs
- Console log output related to "OneTab Media" or "UME"