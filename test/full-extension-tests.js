// full-extension-tests.js
// Heuristic test suite for UME - validates presence of unified tracking logic and QoL hooks

const fs = require('fs');
const path = require('path');

function safeRead(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (e) {
    return '';
  }
}

function fileContains(filePath, patterns) {
  const content = safeRead(filePath);
  if (!content) return false;
  return patterns.every((p) => new RegExp(p, 'i').test(content));
}

async function runFullExtensionTests(log) {
  let passed = 0;
  let failed = 0;

  const chromeBg = path.join(__dirname, '../chrome-extension/background.js');
  const ffBg = path.join(__dirname, '../firefox-extension/background.js');
  const popupJs = path.join(__dirname, '../chrome-extension/popup/popup.js');
  const optionsJs = path.join(__dirname, '../chrome-extension/options.js');

  // Background unified tracking checks
  const bgChecks = [
    {
      file: chromeBg,
      desc: 'Chrome BG adds potential tab on MEDIA_STARTED even if unknown site',
      pats: ['MEDIA_STARTED', 'addPotentialTab\\('],
    },
    {
      file: chromeBg,
      desc: 'Chrome BG clears tracking on any URL change',
      pats: ['onUpdated', 'changeInfo\\.url', 'potentialMediaTabs\\.delete', 'activeMediaTabs\\.delete'],
    },
    {
      file: chromeBg,
      desc: 'Chrome BG proactively checks for media after load complete',
      pats: ['changeInfo\\.status === \\\'complete\\\'', 'CHECK_FOR_MEDIA', 'hasMedia', 'status = \\\'has_media\\\''],
    },
    {
      file: ffBg,
      desc: 'Firefox BG mirrors proactive media detection',
      pats: ['changeInfo\\.status === \\\'complete\\\'', 'CHECK_FOR_MEDIA', 'hasMedia', 'status = \\\'has_media\\\''],
    },
    {
      file: chromeBg,
      desc: 'Cleanup constants present (staleThreshold, cleanupIntervalMs)',
      pats: ['staleThreshold', 'cleanupIntervalMs'],
    },
  ];

  for (const check of bgChecks) {
    if (fileContains(check.file, check.pats)) {
      log(`✅ ${check.desc}`, 'PASS');
      passed++;
    } else {
      log(`❌ ${check.desc}`, 'FAIL');
      failed++;
    }
  }

  // Popup basic UI hooks
  if (fileContains(popupJs, ['GET_ACTIVE_TABS', 'updateTabsList', 'pauseTab'])) {
    log('✅ Popup has core hooks to render and control tabs', 'PASS');
    passed++;
  } else {
    log('❌ Popup missing core hooks', 'FAIL');
    failed++;
  }

  // Options page export/import QoL (optional; warn if missing)
  if (/export/i.test(safeRead(optionsJs)) && /import/i.test(safeRead(optionsJs))) {
    log('✅ Options has export/import settings hooks', 'PASS');
    passed++;
  } else {
    log('⚠️ Options export/import not detected (optional QoL)', 'WARN');
  }

  return { passed, failed };
}

module.exports = { runFullExtensionTests };


