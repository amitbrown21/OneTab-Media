# Media Tab Manager - Firefox Extension

A Firefox extension that ensures only one tab can play audio/video at a time. When you start playing media in a new tab, it automatically pauses media in all other tabs.

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
   - Navigate to the `firefox-extension` folder

2. **Load in Firefox**:
   - Open Firefox
   - Type `about:debugging` in the address bar
   - Click "This Firefox" on the left sidebar
   - Click "Load Temporary Add-on..."
   - Navigate to the `firefox-extension` folder
   - Select the `manifest.json` file
   - Click "Open"

3. **Verify Installation**:
   - Look for the Media Tab Manager icon in your Firefox toolbar
   - Click the icon to open the popup interface
   - The extension will be listed in the temporary extensions section

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
   - Your preference is saved and restored when you restart Firefox

## File Structure

```
firefox-extension/
├── manifest.json          # Firefox extension manifest (Manifest V2)
├── background.js          # Background script
├── content.js            # Content script injected into web pages
├── popup/
│   ├── popup.html        # Popup interface HTML
│   ├── popup.css         # Modern popup styles
│   └── popup.js          # Popup interface logic
└── icons/
    └── *.png             # Extension icons (16x16, 48x48, 128x128)
```

## Technical Details

- **Manifest Version**: 2 (Firefox's current standard)
- **Permissions**: tabs, activeTab, storage, http://*/*, https://*/*
- **Content Script**: Runs on all HTTP/HTTPS pages
- **Background**: Non-persistent background script
- **Storage**: Uses Firefox's local storage for settings
- **Extension ID**: media-tab-manager@example.com

## Supported Media Types

- HTML5 `<video>` and `<audio>` elements
- Web Audio API (partial support)
- YouTube, Vimeo, and most video streaming sites
- Audio streaming services
- Web-based media players

## Firefox-Specific Notes

1. **Temporary Extension**:
   - Extensions loaded via `about:debugging` are temporary
   - They will be removed when Firefox restarts
   - For permanent installation, the extension needs to be signed by Mozilla

2. **Permissions**:
   - Firefox Manifest V2 requires explicit host permissions
   - The extension requests access to all HTTP/HTTPS sites

3. **API Differences**:
   - Uses `browser.runtime` API (Firefox standard)
   - Fallback to `chrome.runtime` for compatibility

## Troubleshooting

1. **Extension not working**:
   - Check that it's listed in `about:debugging#/runtime/this-firefox`
   - Refresh the page where you're trying to play media
   - Check browser console for any error messages

2. **Some media not detected**:
   - Some complex media players may not be fully supported
   - Try refreshing the page or restarting the browser

3. **Popup not opening**:
   - Make sure the extension is properly loaded
   - Try reloading the extension in `about:debugging`

4. **Extension disappeared**:
   - Temporary extensions are removed when Firefox restarts
   - Reload the extension via `about:debugging`

## Development

To modify this extension:

1. Make changes to the files in the `firefox-extension` folder
2. Go to `about:debugging#/runtime/this-firefox`
3. Click "Reload" next to "Media Tab Manager"
4. Test your changes

## Building for Production

To create a signed extension for Firefox:

1. Package the extension: `zip -r media-tab-manager.zip *`
2. Submit to [Firefox Add-ons](https://addons.mozilla.org/developers/)
3. Wait for review and signing process

## Privacy

This extension:
- Only runs on web pages you visit
- Does not collect or transmit any personal data
- Stores only your enable/disable preference locally
- Does not access your browsing history or personal information 