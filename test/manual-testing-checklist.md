# UME - Ultimate Media Extension - Manual Testing Checklist

## Overview
This comprehensive checklist ensures all features of the Ultimate Media Extension are working correctly across different scenarios, browsers, and media types.

---

## 🚀 Pre-Testing Setup

### Extension Installation
- [ ] **Chrome Installation**
  - [ ] Extension loads without errors in chrome://extensions
  - [ ] All permissions granted correctly
  - [ ] Extension icon appears in toolbar
  - [ ] No console errors on extension load

- [ ] **Firefox Installation** 
  - [ ] Extension loads without errors in about:addons
  - [ ] All permissions granted correctly
  - [ ] Extension icon appears in toolbar
  - [ ] No console errors on extension load

### Test Environment
- [ ] Open test/test-media.html in browser
- [ ] Open browser developer tools (F12)
- [ ] Clear browser cache and storage
- [ ] Ensure audio/speakers are working at reasonable volume
- [ ] ⚠️ **IMPORTANT**: Start with low volume for volume booster tests

---

## 📺 Core Media Tab Tracking Tests

### Basic Media Detection
- [ ] **Video Detection**
  - [ ] Play video on test page → extension popup shows the tab
  - [ ] Video shows correct title and media type
  - [ ] Tab count badge updates correctly
  - [ ] Pause video → tab remains in popup (doesn't disappear)

- [ ] **Audio Detection**
  - [ ] Play audio on test page → extension popup shows the tab  
  - [ ] Audio shows correct title and media type
  - [ ] Both video and audio tabs can be tracked simultaneously

### Multi-Tab Behavior
- [ ] **Cross-Tab Media Control**
  - [ ] Open test page in 2+ tabs
  - [ ] Play video in Tab 1 → extension popup shows Tab 1
  - [ ] Play audio in Tab 2 → video in Tab 1 pauses automatically
  - [ ] Extension popup shows both tabs
  - [ ] Switch between tabs using popup controls

### Fixed Tab Tracking (Critical Fix)
- [ ] **Long-Term Tracking**
  - [ ] Play media in tab
  - [ ] Wait 15+ minutes → tab should STILL be in popup
  - [ ] Wait 1+ hour → tab should STILL be in popup
  - [ ] Previous issue: tabs were being removed after 30 minutes ✅ FIXED

- [ ] **SPA Navigation (Critical Fix)**
  - [ ] Play media in tab
  - [ ] Change URL parameters (?test=123)
  - [ ] Use browser back/forward buttons
  - [ ] Click internal links (same domain)
  - [ ] Tab should REMAIN tracked throughout ✅ FIXED
  - [ ] Previous issue: URL changes removed tabs from tracking

- [ ] **Cross-Domain Navigation**
  - [ ] Play media in tab
  - [ ] Navigate to completely different domain
  - [ ] Tab should be REMOVED from tracking (this is correct behavior)

---

## ⚡ Speed Control System Tests

### Basic Speed Controls
- [ ] **Manual Speed Testing**
  - [ ] Click 0.5x speed button → video plays at half speed
  - [ ] Click 1.0x speed button → video returns to normal speed
  - [ ] Click 1.5x speed button → video plays faster
  - [ ] Click 2.0x speed button → video plays at double speed
  - [ ] Speed changes apply immediately and smoothly

### Keyboard Shortcuts (All New/Enhanced)
**Test each shortcut with video focused:**
- [ ] **V Key** - Show/Hide speed controller overlay
  - [ ] Hover over video → controller appears
  - [ ] Press V → controller visibility toggles
  - [ ] Controller shows current speed

- [ ] **S Key** - Decrease Speed (by 0.25x)
  - [ ] Press S repeatedly → speed decreases: 1.0 → 0.75 → 0.5 → 0.25
  - [ ] Visual feedback shows current speed
  - [ ] Audio pitch changes correctly

- [ ] **D Key** - Increase Speed (by 0.25x)  
  - [ ] Press D repeatedly → speed increases: 1.0 → 1.25 → 1.5 → 1.75 → 2.0+
  - [ ] No upper limit enforced (matches original extension)

- [ ] **R Key** - Reset to 1.0x Speed
  - [ ] Change speed to any value
  - [ ] Press R → immediately returns to 1.0x speed

- [ ] **G Key** - Fast Speed (1.8x)
  - [ ] Press G → jumps to 1.8x speed directly
  - [ ] Matches original Video Speed Controller behavior

- [ ] **Z Key** - Rewind 10 seconds
  - [ ] Press Z → video jumps back 10 seconds
  - [ ] Works at any playback position
  - [ ] Respects video boundaries (doesn't go below 0:00)

- [ ] **X Key** - Advance 10 seconds
  - [ ] Press X → video jumps forward 10 seconds
  - [ ] Works at any playback position  
  - [ ] Respects video boundaries (doesn't exceed duration)

### Marker Functionality (New Feature)
- [ ] **M Key** - Set Marker
  - [ ] Play video for 30+ seconds
  - [ ] Press M → notification shows "Marker set at X:XX"
  - [ ] Multiple markers can be set (overwrites per video)
  - [ ] Marker persists for current URL/video source

- [ ] **J Key** - Jump to Marker
  - [ ] Set marker at specific time (e.g., 1:30)
  - [ ] Seek to different time (e.g., 3:00)
  - [ ] Press J → video jumps back to marker (1:30)
  - [ ] Shows notification "Jumped to marker at X:XX"
  - [ ] If no marker set → shows "No marker found"

### Speed Persistence
- [ ] **Remember Speed Setting**
  - [ ] Enable "Remember Speed" in options
  - [ ] Set video to 1.5x speed
  - [ ] Reload page → video should start at 1.5x speed
  - [ ] Test with different speeds (0.5x, 2.0x, etc.)

- [ ] **Per-Video Speed Memory**
  - [ ] Play video A at 1.5x speed
  - [ ] Play video B at 2.0x speed  
  - [ ] Return to video A → should remember 1.5x speed
  - [ ] Different videos maintain individual speeds

---

## 🔊 Volume Booster Tests

### ⚠️ SAFETY WARNING
**Before starting volume tests:**
- [ ] Set system volume to 25-50%
- [ ] Use headphones/speakers that can handle increased volume
- [ ] Have volume control easily accessible
- [ ] Stop test immediately if volume becomes uncomfortable

### Basic Volume Controls  
- [ ] **Manual Volume Testing**
  - [ ] Click 100% volume → audio at normal level
  - [ ] Click 150% volume → audio noticeably louder
  - [ ] Click 200% volume → audio significantly louder
  - [ ] Click 300% volume → audio very loud (be careful!)
  - [ ] Volume changes apply immediately

### Volume Keyboard Shortcuts (New Feature)
**Test with media element focused:**
- [ ] **Up Arrow (↑)** - Increase Volume
  - [ ] Press ↑ repeatedly → volume increases by 10% each press
  - [ ] Volume indicator updates visually
  - [ ] Audio gets progressively louder
  - [ ] Maximum limit enforced (500% / 5.0x)

- [ ] **Down Arrow (↓)** - Decrease Volume
  - [ ] Press ↓ repeatedly → volume decreases by 10% each press
  - [ ] Minimum limit enforced (10% / 0.1x)
  - [ ] Volume never goes to complete silence

### Per-Domain Volume Memory
- [ ] **Domain-Specific Settings**
  - [ ] Set test page to 200% volume
  - [ ] Navigate to different domain → volume resets to global default
  - [ ] Return to test page → volume returns to 200%
  - [ ] Different domains maintain individual volume levels

### Volume Safety Features
- [ ] **Safety Limits**
  - [ ] Volume cannot exceed 500% (5.0x multiplier)
  - [ ] Warning appears for volumes above 200%
  - [ ] Extension respects safety limit setting
  - [ ] No way to bypass safety limit through UI

### Web Audio API Integration  
- [ ] **Audio Context Management**
  - [ ] First volume change may require user interaction
  - [ ] Audio context resumes properly after browser restrictions
  - [ ] No audio glitches or distortion at higher volumes
  - [ ] Volume boost works with both video and audio elements

---

## ⚙️ Settings System Tests (Complete Overhaul)

### Options Page Access
- [ ] **Opening Options**
  - [ ] Right-click extension icon → Options opens
  - [ ] Or: chrome://extensions → UME → Options
  - [ ] Options page loads without errors
  - [ ] All sections and tabs visible

### Settings Categories
- [ ] **General Settings**
  - [ ] Extension Enable/Disable toggle works
  - [ ] Show Controller toggle works
  - [ ] Start Hidden setting works
  - [ ] Remember Speed toggle works
  - [ ] Audio Boolean (enable on audio) works

- [ ] **Speed Settings (New)**
  - [ ] Force Last Saved Speed toggle
  - [ ] Default Speed input (accepts 0.25 - 4.0)
  - [ ] Settings validation prevents invalid values

- [ ] **Volume Booster Settings (New)**
  - [ ] Enable Volume Booster toggle
  - [ ] Global Volume multiplier (0.1 - 5.0)
  - [ ] Volume Boost Limit (1.0 - 5.0)
  - [ ] Safety warning displayed

- [ ] **Blacklist Settings (New)**
  - [ ] Blacklist textarea accepts domain list
  - [ ] One domain per line format
  - [ ] Blacklisted sites are excluded from extension

### Keyboard Shortcuts Configuration
- [ ] **Shortcut Customization**
  - [ ] All shortcuts listed with descriptions
  - [ ] Key codes can be modified
  - [ ] Values (speed increments, time jumps) adjustable
  - [ ] Reset to defaults button works
  - [ ] Invalid shortcuts prevented

### Settings Persistence
- [ ] **Save/Load Cycle**
  - [ ] Change multiple settings
  - [ ] Click Save → success message appears
  - [ ] Reload options page → all changes preserved
  - [ ] Restart browser → settings still saved

- [ ] **Cross-Device Sync**
  - [ ] Settings use chrome.storage.sync (not local)
  - [ ] Changes sync across signed-in browser profiles
  - [ ] Settings survive browser reinstallation

### Settings Migration
- [ ] **Default Settings on Install**
  - [ ] Fresh install gets all default values
  - [ ] Missing settings filled in on update
  - [ ] No undefined/null settings

---

## 🎮 Extension Popup Tests

### Popup Interface
- [ ] **Popup Display**
  - [ ] Click extension icon → popup opens instantly
  - [ ] Shows current extension status (enabled/disabled)
  - [ ] Lists all tabs with active media
  - [ ] Shows media type icons (video/audio)
  - [ ] Tab titles and URLs correct

### Popup Controls  
- [ ] **Media Controls in Popup**
  - [ ] Play/pause buttons work for each tab
  - [ ] "Pause All" button pauses all media
  - [ ] Individual tab controls work independently
  - [ ] Controls reflect actual media state

- [ ] **Tab Navigation**
  - [ ] Click tab in popup → switches to that browser tab
  - [ ] Works across multiple browser windows
  - [ ] Popup closes after tab switch

### Popup State Management
- [ ] **Real-Time Updates**
  - [ ] Start media → tab appears in popup immediately
  - [ ] Pause media → popup reflects state change
  - [ ] Close tab with media → tab disappears from popup
  - [ ] Badge count updates in real-time

---

## 🌐 Cross-Browser Compatibility Tests

### Chrome (Manifest V3)
- [ ] **Chrome-Specific Features**
  - [ ] Service worker background script works
  - [ ] chrome.storage.sync API functions correctly
  - [ ] chrome.tabs API integration works
  - [ ] All popup features functional
  - [ ] No manifest V3 compatibility issues

### Firefox (Manifest V2)
- [ ] **Firefox-Specific Features**
  - [ ] Background script (non-service worker) works
  - [ ] browser.storage.sync API functions correctly
  - [ ] browser.tabs API integration works
  - [ ] All popup features functional
  - [ ] No manifest V2 compatibility issues

### Cross-Browser Consistency
- [ ] **Feature Parity**
  - [ ] All keyboard shortcuts work identically
  - [ ] Volume booster functions the same
  - [ ] Settings sync behaves consistently
  - [ ] UI appearance consistent
  - [ ] Performance similar between browsers

---

## 🧪 Edge Cases & Error Handling

### Media Element Edge Cases
- [ ] **Dynamic Content**
  - [ ] Media added via JavaScript detected
  - [ ] Media removed from DOM handled gracefully
  - [ ] SPA (Single Page App) navigation works
  - [ ] Multiple media elements per page work

- [ ] **Media States**
  - [ ] Paused media still tracked
  - [ ] Ended media handled correctly  
  - [ ] Muted media still controlled
  - [ ] Media with errors don't break extension

### Extension Error Scenarios
- [ ] **Storage Errors**
  - [ ] Extension works with storage API disabled
  - [ ] Gracefully handles storage quota exceeded
  - [ ] Default settings load if storage corrupted

- [ ] **Permission Errors**  
  - [ ] Extension handles missing permissions gracefully
  - [ ] Clear error messages for permission issues
  - [ ] No critical failures from permission denial

### Performance & Resource Usage
- [ ] **Resource Management**
  - [ ] Extension doesn't cause noticeable browser slowdown
  - [ ] Memory usage remains reasonable with many tabs
  - [ ] CPU usage acceptable during media playback
  - [ ] No memory leaks with long-term usage

---

## 🔧 Developer & Debug Testing

### Console Output
- [ ] **Debug Messages**
  - [ ] Extension logs helpful debug information
  - [ ] No excessive/spam logging
  - [ ] Error messages are descriptive
  - [ ] Log levels appropriate for production

### Developer Tools Integration
- [ ] **Extension Inspection**
  - [ ] Extension pages can be inspected
  - [ ] Service worker/background script inspectable
  - [ ] Content script debug information available
  - [ ] Storage contents can be viewed/modified

---

## ✅ Sign-Off Checklist

### Critical Features (Must Pass)
- [ ] ✅ Media tab tracking works for extended periods (2+ hours)
- [ ] ✅ SPA navigation doesn't break tab tracking
- [ ] ✅ All keyboard shortcuts function correctly  
- [ ] ✅ Marker functionality (M/J keys) works reliably
- [ ] ✅ Volume booster increases volume safely
- [ ] ✅ Settings save and persist correctly
- [ ] ✅ Extension works in both Chrome and Firefox
- [ ] ✅ No critical console errors

### Performance Requirements
- [ ] ✅ Extension loads quickly (< 2 seconds)
- [ ] ✅ Keyboard shortcuts respond instantly (< 100ms)
- [ ] ✅ Volume changes apply immediately
- [ ] ✅ Settings save within 1 second
- [ ] ✅ Popup opens quickly (< 500ms)

### User Experience Requirements
- [ ] ✅ All features discoverable and intuitive
- [ ] ✅ Visual feedback for all actions
- [ ] ✅ Error messages helpful and clear
- [ ] ✅ No unexpected behavior or crashes
- [ ] ✅ Consistent behavior across test scenarios

---

## 🐛 Bug Report Template

When issues are found, document using this format:

**Bug Title**: Brief description
**Severity**: Critical/High/Medium/Low
**Browser**: Chrome/Firefox/Both
**Steps to Reproduce**:
1. Step 1
2. Step 2  
3. Step 3

**Expected Result**: What should happen
**Actual Result**: What actually happens
**Console Errors**: Any error messages
**Screenshots**: Visual proof if applicable

---

## 📊 Test Results Summary

### Test Session Information
- **Tester Name**: _______________
- **Date/Time**: _______________
- **Browser Version**: _______________
- **Extension Version**: _______________
- **Test Duration**: _______________

### Results
- **Total Tests**: _______ 
- **Passed**: _______
- **Failed**: _______
- **Critical Issues**: _______
- **Overall Status**: PASS / FAIL

### Notes
Use this space for additional observations, recommendations, or concerns:

---

**🎉 Testing Complete!**

If all critical features pass and no critical issues are found, the extension is ready for release. Document any remaining issues for future updates and maintain this checklist for future testing cycles.
