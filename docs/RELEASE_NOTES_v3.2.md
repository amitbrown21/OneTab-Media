# UME - Ultimate Media Extension v3.2 Release Notes

## Highlights
- New persistent light/dark theme with cross-device sync
- Complete Options page redesign (v3 UI) with modern visuals and responsive layout
- Theme toggle available in both Popup and Options
- Improved settings initialization and migration (prevents defaults from overwriting existing settings)
- Better dark-mode styles for Keyboard Shortcuts and all sections
- Minor performance and UX polish across the popup and options

## Details
- Theme
  - Adds `theme` setting stored in `storage.sync`
  - Toggle in popup and options, persists across sessions/devices
  - Instant application via `[data-theme]` with CSS variables
- Options Page v3
  - Clean, compact layout with sidebar navigation
  - Accessible focus states and consistent cards/inputs
  - Subtle animations: card lift, button sheen, toggle sweep
  - Fully dark-mode compatible
- Robust initialization
  - Migrate local→sync first
  - Only fill missing keys; avoids reapplying defaults
  - One-time sentinel `settingsInitialized` prevents repeat defaulting

## Files Changed (not exhaustive)
- Chrome: `manifest.json` → version 3.2
- Firefox: `manifest.json` → version 3.2
- Popup: theme toggle + persistence logic
- Options: `options.html` → use `options.v3.css` (new design)
- Options: `options.v3.css` (Chrome/Firefox) new stylesheet
- Options logic updates for initialization, theme I/O, and logging

## Upgrade
- Chrome/Firefox stores will auto-update.
- For manual install, load the updated folders and verify the version reads 3.2 in extension management.

## Verification Checklist
- Popup: toggle theme → close → reopen → remains in chosen theme
- Options: opening does not reset user settings; saving works
- Keyboard Shortcuts: text legible in dark mode; inputs/selects styled correctly
- Appearance → Opacity slider updates value live

## Notes
- Minor CSS warnings about standard `appearance` can be ignored; functional behavior unaffected.

---
Thanks for using UME! If you hit issues, please share console logs from Options and Popup to help diagnose.

