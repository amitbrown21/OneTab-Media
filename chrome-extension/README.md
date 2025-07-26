# Media Tab Manager - Chrome Extension

A Chrome extension that ensures only one tab can play audio/video at a time. When you start playing media in a new tab, it automatically pauses media in all other tabs.

## Features

- 🎵 Automatically detects when media starts playing in any tab
- ⏸️ Pauses media in other tabs when new media begins
- ▶️ Play/pause controls for individual tabs
- 🔄 Works with HTML5 video, audio, and web-based media players
- 🎛️ Modern popup interface to see and control active media
- 🔧 Toggle to enable/disable the extension functionality
- 💾 Persistent settings storage

## Installation (Development Mode)

1. **Download the Extension**:
   - Download or clone this repository
   - Navigate to the `chrome-extension` folder

2. **Load in Chrome**:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right corner)
   - Click "Load unpacked"
   - Select the `chrome-extension` folder
   - The extension should now appear in your extensions list

3. **Verify Installation**:
   - Look for the Media Tab Manager icon in your Chrome toolbar
   - Click the icon to open the popup interface

## Usage

1. **Basic Operation**:
   - The extension works automatically once installed
   - Play any video or audio in a tab
   - When you play media in another tab, the first tab will automatically pause

2. **Popup Interface**:
   - Click the extension icon to see all tabs with media
   - Use the toggle switch to enable/disable the extension
   - Click play/pause buttons to control individual tabs
   - Click the tab name to switch to that tab

3. **Extension Toggle**:
   - Use the toggle switch in the popup header to disable the extension
   - When disabled, tabs won't automatically pause each other
   - Your preference is saved and restored when you restart Chrome

## File Structure

```
chrome-extension/
├── manifest.json          # Chrome extension manifest (Manifest V3)
├── background.js          # Background service worker
├── content.js            # Content script injected into web pages
├── popup/
│   ├── popup.html        # Popup interface HTML
│   ├── popup.css         # Modern popup styles
│   └── popup.js          # Popup interface logic
└── icons/
    └── *.png             # Extension icons (16x16, 48x48, 128x128)
```

## Technical Details

- **Manifest Version**: 3 (Chrome's latest standard)
- **Permissions**: tabs, activeTab, storage
- **Content Script**: Runs on all HTTP/HTTPS pages
- **Background**: Service worker for cross-tab communication
- **Storage**: Uses Chrome's local storage for settings

## Supported Media Types

- HTML5 `<video>` and `<audio>` elements
- Web Audio API (partial support)
- YouTube, Vimeo, and most video streaming sites
- Audio streaming services
- Web-based media players

## Troubleshooting

1. **Extension not working**:
   - Check that it's enabled in `chrome://extensions/`
   - Refresh the page where you're trying to play media
   - Check browser console for any error messages

2. **Some media not detected**:
   - Some complex media players may not be fully supported
   - Try refreshing the page or restarting the browser

3. **Popup not opening**:
   - Make sure the extension is properly loaded
   - Try disabling and re-enabling the extension

## Development

To modify this extension:

1. Make changes to the files in the `chrome-extension` folder
2. Go to `chrome://extensions/`
3. Click the refresh button next to "Media Tab Manager"
4. Test your changes

## Privacy

This extension:
- Only runs on web pages you visit
- Does not collect or transmit any personal data
- Stores only your enable/disable preference locally
- Does not access your browsing history or personal information 