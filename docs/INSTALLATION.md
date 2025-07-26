# Installation Guide - Media Tab Manager

This guide will help you install the Media Tab Manager extension in both Chrome and Firefox browsers.

## Prerequisites

Before installing, ensure you have:
- Google Chrome 88+ or Firefox 57+
- Extension icons (see `/icons/create_icons.md` for details)
- Basic understanding of browser extension development

## Chrome Installation

### Development Mode (Recommended for Testing)

1. **Enable Developer Mode**
   - Open Chrome and navigate to `chrome://extensions/`
   - Toggle the "Developer mode" switch in the top right corner

2. **Load the Extension**
   - Click "Load unpacked" button
   - Navigate to and select the `src/chrome/` folder
   - The extension should now appear in your extensions list

3. **Verify Installation**
   - Look for the Media Tab Manager icon in your Chrome toolbar
   - Click the icon to open the popup interface
   - Check that the extension badge shows the correct status

### Chrome Web Store (Production)

1. **Package the Extension**
   - Zip the entire `src/chrome/` folder contents
   - Ensure all referenced files are included

2. **Upload to Chrome Web Store**
   - Visit the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
   - Create a new item and upload your zip file
   - Fill in all required metadata
   - Submit for review

## Firefox Installation

### Temporary Add-on (Development)

1. **Access Debug Mode**
   - Open Firefox and navigate to `about:debugging`
   - Click "This Firefox" in the left sidebar

2. **Load the Extension**
   - Click "Load Temporary Add-on..."
   - Navigate to `src/firefox/` folder
   - Select the `manifest.json` file
   - The extension will be loaded temporarily

3. **Verify Installation**
   - Check the Firefox toolbar for the extension icon
   - Test the popup functionality
   - Verify permissions are granted correctly

### Firefox Add-ons (Production)

1. **Package the Extension**
   - Create a zip file containing all files from `src/firefox/`
   - Include the common files referenced in the manifest

2. **Submit to Firefox Add-ons**
   - Visit [Firefox Add-on Developer Hub](https://addons.mozilla.org/developers/)
   - Submit your extension for review
   - Wait for approval process

## Post-Installation Setup

### Required Icons

Before the extension works properly, you need to create icon files:

1. Create three PNG files:
   - `icons/icon16.png` (16x16 pixels)
   - `icons/icon48.png` (48x48 pixels) 
   - `icons/icon128.png` (128x128 pixels)

2. Use the guidelines in `/icons/create_icons.md` for design recommendations

### Testing the Installation

1. **Basic Functionality Test**
   - Open YouTube in one tab
   - Start playing a video
   - Open Spotify or another media site in a new tab
   - Start playing audio
   - Verify that the first video pauses automatically

2. **Popup Interface Test**
   - Click the extension icon
   - Verify that active media tabs are displayed
   - Test the "Pause All" button
   - Try switching between tabs using the popup

3. **Cross-Site Test**
   - Test with various media sites:
     - YouTube
     - Netflix
     - Spotify
     - Plex
     - SoundCloud
     - Local HTML5 video/audio files

## Troubleshooting

### Common Issues

1. **Extension Not Loading**
   - Check that all file paths in manifest.json are correct
   - Ensure all referenced files exist
   - Verify manifest syntax is valid JSON

2. **Media Not Being Detected**
   - Open browser console to check for JavaScript errors
   - Verify content script is injecting properly
   - Check that website isn't blocking extension access

3. **Popup Not Working**
   - Ensure popup HTML, CSS, and JS files are in correct locations
   - Check browser console for errors
   - Verify popup dimensions are appropriate

4. **Cross-Tab Communication Issues**
   - Check background script console for errors
   - Verify extension permissions are sufficient
   - Test message passing between content and background scripts

### Debug Mode

To enable verbose logging:

1. **Chrome**: Open Chrome DevTools → Console, filter by "Media Tab Manager"
2. **Firefox**: Open Browser Console (Ctrl+Shift+J), filter by extension messages

### Permission Issues

If the extension can't access certain sites:

1. Check that host permissions include the target domain
2. Verify the site doesn't have Content Security Policy blocking extensions
3. Some sites may require manual permission grants

## Updating the Extension

### Development Updates

1. Make changes to source files
2. Chrome: Click refresh icon on extensions page
3. Firefox: Remove and reload the temporary add-on

### Production Updates

1. Increment version number in manifest.json
2. Package and upload to respective stores
3. Users will receive automatic updates

## Uninstallation

### Chrome
1. Go to `chrome://extensions/`
2. Find Media Tab Manager
3. Click "Remove"

### Firefox
1. Go to `about:addons`
2. Find Media Tab Manager
3. Click "Remove"

## Support

If you encounter issues:

1. Check this documentation first
2. Review browser console for errors
3. Test with minimal test cases
4. Report bugs with detailed reproduction steps

## Security Considerations

- The extension requires broad host permissions to work on all sites
- Content scripts have access to page content but are sandboxed
- Background script manages cross-tab communication securely
- No external network requests are made by the extension 