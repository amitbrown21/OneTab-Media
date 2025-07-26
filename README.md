# OneTab Media Extension

A browser extension that ensures only one tab can play audio/video at a time. When you start playing media in a new tab, it automatically pauses media in all other tabs.

## 🚀 Quick Start

This project contains two separate, complete browser extensions:

- **[Chrome Extension](./chrome-extension/)** - For Google Chrome (Manifest V3)
- **[Firefox Extension](./firefox-extension/)** - For Mozilla Firefox (Manifest V2)

Each folder contains a complete, ready-to-install extension with its own README and installation instructions.

## ✨ Features

- 🎵 **Automatic Media Detection** - Detects when media starts playing in any tab
- ⏸️ **Smart Pausing** - Automatically pauses media in other tabs when new media begins
- ⏸️ **Individual Controls** - Pause buttons for each tab with media
- 🎛️ **Modern Interface** - Clean, modern popup to see and control all active media
- 🔧 **Extension Toggle** - Master switch to enable/disable the entire functionality
- 💾 **Persistent Settings** - Your preferences are saved across browser sessions
- 🌐 **Cross-Browser** - Separate optimized versions for Chrome and Firefox
- ☕ **Developer Support** - Easy way to support the developer with built-in link

## 📁 Project Structure

```
OneTab Media/
├── chrome-extension/          # Complete Chrome extension
│   ├── manifest.json         # Chrome Manifest V3
│   ├── background.js         # Service worker
│   ├── content.js           # Content script
│   ├── popup/               # Popup interface
│   │   ├── popup.html
│   │   ├── popup.css
│   │   └── popup.js
│   ├── icons/               # Extension icons
│   └── README.md            # Chrome-specific instructions
│
├── firefox-extension/         # Complete Firefox extension
│   ├── manifest.json         # Firefox Manifest V2
│   ├── background.js         # Background script
│   ├── content.js           # Content script
│   ├── popup/               # Popup interface
│   │   ├── popup.html
│   │   ├── popup.css
│   │   └── popup.js
│   ├── icons/               # Extension icons
│   └── README.md            # Firefox-specific instructions
│
├── test/                     # Test files
├── docs/                     # Documentation
└── README.md                # This file
```

## 🛠️ Installation

### Chrome Extension
1. Navigate to the `chrome-extension` folder
2. Follow the instructions in [chrome-extension/README.md](./chrome-extension/README.md)

### Firefox Extension
1. Navigate to the `firefox-extension` folder
2. Follow the instructions in [firefox-extension/README.md](./firefox-extension/README.md)

## 🎯 How It Works

1. **Media Detection**: Content scripts monitor all web pages for HTML5 video/audio elements and Web Audio API usage
2. **Cross-Tab Communication**: Background script coordinates between tabs to manage playback
3. **Smart Pausing**: When media starts in a new tab, the extension automatically pauses media in all other tabs
4. **User Control**: Popup interface allows manual control and shows the status of all media tabs

## 🎨 Modern UI Features

- **Toggle Switch**: Enable/disable the extension with a beautiful animated toggle
- **Real-time Status**: Live status indicators showing which tabs are playing/paused
- **Individual Controls**: Pause buttons for currently playing tabs
- **Tab Switching**: Click any tab to switch to it instantly
- **Modern Design**: Clean, responsive interface with smooth animations

## 🔧 Supported Media Types

- HTML5 `<video>` and `<audio>` elements
- Web Audio API (partial support)
- YouTube, Vimeo, Netflix, and most video streaming sites
- Spotify, SoundCloud, and audio streaming services
- Web-based media players (Plex, etc.)

## 🚀 Development

Each extension folder is completely independent:

- **Chrome**: Modern Manifest V3 with service workers
- **Firefox**: Manifest V2 with background scripts
- **Shared Logic**: Same core functionality, optimized for each browser

To modify either extension:
1. Navigate to the appropriate folder (`chrome-extension` or `firefox-extension`)
2. Make your changes
3. Reload the extension in the browser
4. Test your changes

## 📋 Testing

A test page is available at `test/test-media.html` to verify the extension functionality:

1. Start the test server: `python -m http.server 8000` (from the `test` directory)
2. Open `http://localhost:8000/test-media.html`
3. Test various media types and scenarios

## 🔒 Privacy

This extension:
- Only runs on web pages you visit
- Does not collect or transmit any personal data
- Stores only your enable/disable preference locally
- Does not access your browsing history or personal information
- All processing happens locally in your browser

## 📚 Documentation

- [Architecture Overview](./docs/ARCHITECTURE.md)
- [Installation Guide](./docs/INSTALLATION.md)
- [Chrome Extension README](./chrome-extension/README.md)
- [Firefox Extension README](./firefox-extension/README.md)

## 🤝 Contributing

1. Fork the repository
2. Choose the extension you want to work on (`chrome-extension` or `firefox-extension`)
3. Make your changes
4. Test thoroughly on the target browser
5. Submit a pull request

## 📄 License

This project is open source. Feel free to use, modify, and distribute as needed.

---

**Ready to install?** Choose your browser and follow the specific README:
- 🟢 [Chrome Extension](./chrome-extension/README.md)
- 🦊 [Firefox Extension](./firefox-extension/README.md) 