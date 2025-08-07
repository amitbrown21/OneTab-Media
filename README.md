# UME - Ultimate Media Extension v3.0

**The most comprehensive media control extension for your browser.** Take complete control over video speed, audio volume, and media playback across all your browser tabs with advanced keyboard shortcuts and intelligent tab management.

## 🚀 Version 3.0 - Critical Simultaneous Playback Fix

**BREAKTHROUGH UPDATE:** Version 3.0 completely resolves the simultaneous playback issue that was causing multiple tabs to play media at the same time. This critical fix ensures perfect media management across all your browser tabs.

## ✨ Complete Feature Set

### 🎮 Video Speed Control
- **Advanced Speed Control**: Adjust playback speed from 0.1x to 16x with precise increments
- **Custom Speed Presets**: Set your preferred default speeds for different content types
- **Visual Speed Controller**: Elegant on-screen overlay with real-time speed display
- **Speed Memory**: Automatically remembers and applies your last used speed to new videos
- **Per-Website Settings**: Different speed preferences for different websites

### 🔊 Volume Booster & Audio Control
- **Volume Amplification**: Boost audio volume up to 500% beyond browser limits
- **Per-Domain Volume**: Individual volume settings for each website
- **Audio Enhancement**: Professional-grade Web Audio API integration
- **Safety Limits**: Built-in protection against hearing damage
- **Persistent Settings**: Volume preferences saved across browser sessions

### ⌨️ Advanced Keyboard Shortcuts
- **Speed Control**: S (slower), D (faster), R (reset speed), G (preferred speed)
- **Navigation**: Z (rewind), X (advance), M (set marker), J (jump to marker)
- **Volume Control**: ↑ (louder), ↓ (quieter) - **NEW in v3.0!**
- **Display Toggle**: V (show/hide controller)
- **Fullscreen Support**: All shortcuts work perfectly in fullscreen mode
- **Customizable Bindings**: Modify any shortcut in the extension options

### 📊 Intelligent Media Tab Management
- **Ultra-Conservative Tracking**: Media tabs persist indefinitely until actually closed
- **Simultaneous Playback Prevention**: Only one tab plays audio/video at a time
- **Smart Pause Management**: Automatic pausing when switching between media tabs
- **Restart Resilience**: Tab tracking survives extension restarts and browser crashes
- **Network Fault Tolerance**: Communication failures don't break media management

### 🎛️ Professional Options Interface
- **Tabbed Settings Panel**: Organized settings across multiple categories
- **Real-Time Configuration**: Changes apply instantly without requiring restarts
- **Website Blacklisting**: Exclude specific domains from speed/volume control
- **Keyboard Shortcut Customization**: Full control over all key bindings
- **Import/Export Settings**: Backup and restore your configuration

## 🛠️ Installation

### Chrome Extension (Manifest V3)
1. Navigate to the `chrome-extension` folder
2. Follow the instructions in [chrome-extension/README.md](./chrome-extension/README.md)
3. Load the extension in Chrome's developer mode

### Firefox Extension (Manifest V2)
1. Navigate to the `firefox-extension` folder  
2. Follow the instructions in [firefox-extension/README.md](./firefox-extension/README.md)
3. Install as a temporary add-on or package as .xpi

## 🎯 How It Works

### Multi-Layer Media Detection
1. **HTML5 Element Monitoring**: Tracks all `<video>` and `<audio>` elements
2. **Web Audio API Integration**: Monitors Web Audio contexts and gain nodes
3. **Dynamic Content Support**: Handles SPA navigation and dynamically loaded media
4. **Cross-Frame Detection**: Works with embedded videos and iframes

### Intelligent Coordination System
1. **Background Script Orchestration**: Central coordination between all browser tabs
2. **Real-Time State Synchronization**: Instant communication between tabs and popup
3. **Persistent Storage**: Settings synchronized across devices via Chrome/Firefox sync
4. **Conflict Resolution**: Advanced algorithms prevent simultaneous playback issues

## 🔧 Supported Platforms & Media

### **Streaming Platforms**
- ✅ YouTube, Vimeo, Netflix, Disney+, Amazon Prime, Hulu
- ✅ Twitch, YouTube Live, Facebook Watch
- ✅ Spotify Web Player, SoundCloud, Pandora, YouTube Music
- ✅ Plex, Jellyfin, Emby, and self-hosted media servers

### **Educational & Professional**
- ✅ Coursera, Udemy, Khan Academy, edX
- ✅ LinkedIn Learning, Skillshare, MasterClass
- ✅ Zoom, Teams, Google Meet (recorded playbacks)

### **Technical Capabilities**
- ✅ HTML5 video/audio elements
- ✅ Web Audio API with gain control
- ✅ MediaSource Extensions (MSE)
- ✅ Encrypted Media Extensions (EME)
- ✅ WebRTC playback (recordings)

## 🧪 Testing & Quality Assurance

### Comprehensive Test Suite
A complete test environment is available at `test/test-media.html`:

```bash
cd test
python -m http.server 8080
# Open http://localhost:8080/test-media.html
```

### Test Coverage
- ✅ **Multi-Tab Simultaneous Playback Prevention**
- ✅ **Volume Booster Safety & Functionality**
- ✅ **Keyboard Shortcuts in All Scenarios**
- ✅ **Speed Control Precision & Memory**
- ✅ **Extension Restart Persistence**
- ✅ **Network Failure Recovery**

## 🔒 Privacy & Security

### Privacy-First Design
- ✅ **Zero Data Collection**: No personal information is gathered or transmitted
- ✅ **Local Processing**: All functionality runs entirely in your browser
- ✅ **No External Connections**: Extension doesn't communicate with any servers
- ✅ **Transparent Permissions**: Only requests necessary browser APIs
- ✅ **Open Source**: Complete source code available for inspection

### Security Features
- ✅ **Content Security Policy**: Strict CSP prevents XSS attacks
- ✅ **Isolated Execution**: Content scripts run in isolated environments
- ✅ **Permission Minimization**: Requests only essential permissions
- ✅ **Safe Volume Limits**: Built-in protection against hearing damage

## 📈 Performance & Compatibility

### Optimized Performance
- ⚡ **Minimal CPU Impact**: Efficient event-driven architecture
- ⚡ **Low Memory Footprint**: Smart resource management and cleanup
- ⚡ **Battery Friendly**: Optimized for laptop and mobile device usage
- ⚡ **Fast Startup**: Instant initialization and response times

### Browser Compatibility
- 🟢 **Chrome 88+**: Full Manifest V3 support with service workers
- 🦊 **Firefox 79+**: Complete Manifest V2 implementation
- ✅ **Edge Chromium**: Compatible with Chrome extension
- ✅ **Cross-Platform**: Windows, macOS, Linux support

## 📋 Version 3.0 Changelog Highlights

### 🚨 Critical Fixes
- **✅ RESOLVED: Simultaneous Playback Issue** - Complete fix for multiple tabs playing audio simultaneously
- **✅ FIXED: Tab Persistence** - Media tabs no longer disappear unexpectedly  
- **✅ ENHANCED: Volume Control Integration** - Volume shortcuts now appear in options page
- **✅ IMPROVED: Extension Stability** - Bulletproof tracking system survives restarts and errors

### 🎯 Impact Summary
**Before v3.0:** ❌ Unreliable tab tracking, simultaneous playback issues, missing volume shortcuts  
**After v3.0:** ✅ **Perfect media control**, zero simultaneous playback, complete feature integration

## 🤝 Contributing

### Development Setup
1. Fork the repository
2. Choose your target browser (`chrome-extension` or `firefox-extension`)
3. Make changes and test thoroughly
4. Run the test suite to ensure no regressions
5. Submit a detailed pull request

### Code Standards
- ES6+ JavaScript with proper error handling
- Comprehensive console logging for debugging
- Cross-browser compatibility testing required
- Performance impact assessment for all changes

## 📚 Documentation

- [📖 Architecture Overview](./docs/ARCHITECTURE.md)
- [🔧 Installation Guide](./docs/INSTALLATION.md)  
- [📝 Release Notes v3.0](./docs/RELEASE_NOTES_v3.0.md)
- [📊 Complete Changelog](./CHANGELOG.md)

## 🙏 Credits & Acknowledgments

UME v3.0 integrates and builds upon the excellent work of these open-source projects:

### 🎬 Video Speed Controller Integration
- **Original Project**: [Video Speed Controller](https://github.com/igrigorik/videospeed) by [@igrigorik](https://github.com/igrigorik)
- **Repository**: https://github.com/igrigorik/videospeed  
- **License**: MIT License
- **Features Integrated**: Advanced speed control system, keyboard shortcuts, visual overlay controller
- **Our Enhancement**: Enhanced fullscreen support, per-domain settings, improved UI/UX, and integrated tab management

### 🔊 Volume Booster Integration  
- **Original Project**: [Better-Volume-Booster](https://github.com/zWolfrost/Better-Volume-Booster)
- **Developer**: [@zWolfrost](https://github.com/zWolfrost)
- **Features Integrated**: Web Audio API volume amplification, gain node management, audio enhancement
- **Our Enhancement**: Per-domain volume memory, popup controls, keyboard shortcuts, safety limits, and seamless integration with speed controls

### 🛠️ Additional Acknowledgments
- **Original Media Tab Management Concept**: Inspired by various "one tab audio" extensions
- **Cross-Browser Compatibility**: Built on standard Web Extensions API
- **UI/UX Design**: Modern design principles with accessibility in mind

**Thank you** to all the original developers whose work made UME possible. This extension stands on the shoulders of giants in the open-source browser extension community.

## 📄 License

Open source project available under standard open source terms. Free to use, modify, and distribute.

**Note**: Please respect the licenses of the original integrated projects when using or modifying this code.

---

## 🎉 Ready to Transform Your Media Experience?

**Choose your browser and get started:**
- 🟢 **[Chrome Extension](./chrome-extension/README.md)** - Modern Manifest V3
- 🦊 **[Firefox Extension](./firefox-extension/README.md)** - Optimized Manifest V2

**UME v3.0** - Where media control meets perfection. 🎬🎵