/**
 * UME Test Runner Utilities
 * Comprehensive testing utilities for Ultimate Media Extension
 */

class UMETestRunner {
    constructor() {
        this.testResults = [];
        this.currentTest = null;
        this.startTime = null;
        this.mediaElements = new Map();
        this.extensionState = {};
        this.mockData = {};
    }

    /**
     * Initialize test environment
     */
    async initialize() {
        console.log('🚀 Initializing UME Test Runner...');
        
        // Detect available media elements
        this.detectMediaElements();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Initialize mock extension APIs
        this.initializeMockAPIs();
        
        // Load test configuration
        await this.loadTestConfig();
        
        console.log('✅ UME Test Runner initialized');
        return this;
    }

    /**
     * Detect and catalog media elements on the page
     */
    detectMediaElements() {
        const videos = document.querySelectorAll('video');
        const audios = document.querySelectorAll('audio');
        
        videos.forEach((video, index) => {
            this.mediaElements.set(`video-${index}`, {
                element: video,
                type: 'video',
                id: `video-${index}`,
                initialState: {
                    currentTime: video.currentTime,
                    playbackRate: video.playbackRate,
                    volume: video.volume,
                    muted: video.muted,
                    paused: video.paused
                }
            });
        });

        audios.forEach((audio, index) => {
            this.mediaElements.set(`audio-${index}`, {
                element: audio,
                type: 'audio',
                id: `audio-${index}`,
                initialState: {
                    currentTime: audio.currentTime,
                    playbackRate: audio.playbackRate || 1.0,
                    volume: audio.volume,
                    muted: audio.muted,
                    paused: audio.paused
                }
            });
        });

        console.log(`📺 Detected ${videos.length} videos, ${audios.length} audio elements`);
    }

    /**
     * Set up event listeners for testing
     */
    setupEventListeners() {
        // Listen for media events
        this.mediaElements.forEach((mediaInfo) => {
            const element = mediaInfo.element;
            
            ['play', 'pause', 'ended', 'ratechange', 'volumechange', 'timeupdate'].forEach(eventType => {
                element.addEventListener(eventType, (e) => {
                    this.logMediaEvent(mediaInfo.id, eventType, e);
                });
            });
        });

        // Listen for keyboard events
        document.addEventListener('keydown', (e) => {
            this.logKeyboardEvent(e);
        });

        // Listen for extension messages (if available)
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                this.logExtensionMessage('received', message);
                sendResponse({ testRunner: true, timestamp: Date.now() });
            });
        }
    }

    /**
     * Initialize mock extension APIs for testing
     */
    initializeMockAPIs() {
        this.mockAPI = {
            storage: {
                sync: {
                    data: {},
                    get: async (keys) => {
                        if (keys === null) return this.mockAPI.storage.sync.data;
                        const result = {};
                        if (Array.isArray(keys)) {
                            keys.forEach(key => {
                                if (this.mockAPI.storage.sync.data.hasOwnProperty(key)) {
                                    result[key] = this.mockAPI.storage.sync.data[key];
                                }
                            });
                        } else if (typeof keys === 'string') {
                            result[keys] = this.mockAPI.storage.sync.data[keys];
                        }
                        return result;
                    },
                    set: async (items) => {
                        Object.assign(this.mockAPI.storage.sync.data, items);
                        this.logEvent('Mock Storage Set', items);
                        return true;
                    },
                    remove: async (keys) => {
                        const keysArray = Array.isArray(keys) ? keys : [keys];
                        keysArray.forEach(key => {
                            delete this.mockAPI.storage.sync.data[key];
                        });
                        this.logEvent('Mock Storage Remove', keysArray);
                        return true;
                    }
                }
            },
            
            tabs: {
                activeTabs: new Map(),
                get: async (tabId) => {
                    return this.mockAPI.tabs.activeTabs.get(tabId);
                },
                query: async (queryInfo) => {
                    return Array.from(this.mockAPI.tabs.activeTabs.values())
                        .filter(tab => {
                            if (queryInfo.active && !tab.active) return false;
                            if (queryInfo.url && !tab.url.includes(queryInfo.url)) return false;
                            return true;
                        });
                }
            },
            
            runtime: {
                sendMessage: async (message) => {
                    this.logExtensionMessage('sent', message);
                    return { success: true, testRunner: true };
                }
            }
        };

        // Populate with default test data
        this.mockAPI.storage.sync.data = {
            extensionEnabled: true,
            rememberSpeed: true,
            audioBoolean: true,
            controllerOpacity: 0.8,
            speed: 1.0,
            volumeBoosterEnabled: true,
            globalVolume: 1.0,
            volumeBoostLimit: 5.0,
            keyBindings: [
                { action: 'display', key: 86, value: 0, force: false },
                { action: 'slower', key: 83, value: 0.25, force: false },
                { action: 'faster', key: 68, value: 0.25, force: false },
                { action: 'reset', key: 82, value: 1.0, force: false },
                { action: 'fast', key: 71, value: 1.8, force: false },
                { action: 'mark', key: 77, value: 0, force: false },
                { action: 'jump', key: 74, value: 0, force: false },
                { action: 'volumeUp', key: 38, value: 0.1, force: false },
                { action: 'volumeDown', key: 40, value: 0.1, force: false }
            ]
        };
    }

    /**
     * Load test configuration
     */
    async loadTestConfig() {
        this.testConfig = {
            timeouts: {
                short: 1000,
                medium: 3000,
                long: 10000
            },
            thresholds: {
                speedChangeTolerance: 0.01,
                volumeChangeTolerance: 0.01,
                timeSeekTolerance: 0.5
            },
            retryAttempts: 3,
            debugMode: true
        };
    }

    /**
     * Core Testing Methods
     */

    async startTest(testName, description = '') {
        this.currentTest = {
            name: testName,
            description,
            startTime: performance.now(),
            events: [],
            assertions: [],
            status: 'running'
        };
        
        this.logEvent('Test Started', { name: testName, description });
        console.log(`🧪 Starting test: ${testName}`);
    }

    async endTest(passed = true, reason = '') {
        if (!this.currentTest) {
            console.warn('No active test to end');
            return;
        }

        const endTime = performance.now();
        const duration = endTime - this.currentTest.startTime;

        this.currentTest.endTime = endTime;
        this.currentTest.duration = duration;
        this.currentTest.status = passed ? 'passed' : 'failed';
        this.currentTest.reason = reason;

        this.testResults.push({ ...this.currentTest });
        
        const status = passed ? '✅' : '❌';
        console.log(`${status} Test completed: ${this.currentTest.name} (${duration.toFixed(2)}ms)`);
        
        if (!passed && reason) {
            console.log(`   Reason: ${reason}`);
        }

        this.currentTest = null;
        return { passed, duration };
    }

    /**
     * Media Element Testing Utilities
     */

    async testSpeedControl(mediaId, targetSpeed, tolerance = 0.01) {
        const mediaInfo = this.mediaElements.get(mediaId);
        if (!mediaInfo) {
            throw new Error(`Media element ${mediaId} not found`);
        }

        const element = mediaInfo.element;
        const initialSpeed = element.playbackRate;
        
        this.logEvent('Speed Test Start', { mediaId, targetSpeed, initialSpeed });
        
        // Set the speed
        element.playbackRate = targetSpeed;
        
        // Wait for change to apply
        await this.waitForCondition(
            () => Math.abs(element.playbackRate - targetSpeed) <= tolerance,
            this.testConfig.timeouts.short,
            `Speed change to ${targetSpeed}x`
        );

        const finalSpeed = element.playbackRate;
        const success = Math.abs(finalSpeed - targetSpeed) <= tolerance;
        
        this.assert(success, `Speed should be ${targetSpeed}, got ${finalSpeed}`);
        
        this.logEvent('Speed Test Complete', { 
            mediaId, 
            targetSpeed, 
            finalSpeed, 
            success 
        });

        return { success, initialSpeed, finalSpeed };
    }

    async testVolumeControl(mediaId, targetVolume, tolerance = 0.01) {
        const mediaInfo = this.mediaElements.get(mediaId);
        if (!mediaInfo) {
            throw new Error(`Media element ${mediaId} not found`);
        }

        const element = mediaInfo.element;
        const initialVolume = element.volume;
        
        this.logEvent('Volume Test Start', { mediaId, targetVolume, initialVolume });
        
        // Set the volume
        element.volume = Math.max(0, Math.min(1, targetVolume));
        
        // Wait for change to apply
        await this.waitForCondition(
            () => Math.abs(element.volume - Math.max(0, Math.min(1, targetVolume))) <= tolerance,
            this.testConfig.timeouts.short,
            `Volume change to ${targetVolume}`
        );

        const finalVolume = element.volume;
        const expectedVolume = Math.max(0, Math.min(1, targetVolume));
        const success = Math.abs(finalVolume - expectedVolume) <= tolerance;
        
        this.assert(success, `Volume should be ${expectedVolume}, got ${finalVolume}`);
        
        this.logEvent('Volume Test Complete', { 
            mediaId, 
            targetVolume, 
            finalVolume, 
            success 
        });

        return { success, initialVolume, finalVolume };
    }

    async testSeekOperation(mediaId, targetTime, tolerance = 0.5) {
        const mediaInfo = this.mediaElements.get(mediaId);
        if (!mediaInfo) {
            throw new Error(`Media element ${mediaId} not found`);
        }

        const element = mediaInfo.element;
        const initialTime = element.currentTime;
        
        this.logEvent('Seek Test Start', { mediaId, targetTime, initialTime });
        
        // Perform seek
        element.currentTime = targetTime;
        
        // Wait for seek to complete
        await this.waitForCondition(
            () => Math.abs(element.currentTime - targetTime) <= tolerance,
            this.testConfig.timeouts.medium,
            `Seek to ${targetTime}s`
        );

        const finalTime = element.currentTime;
        const success = Math.abs(finalTime - targetTime) <= tolerance;
        
        this.assert(success, `Time should be ${targetTime}s, got ${finalTime}s`);
        
        this.logEvent('Seek Test Complete', { 
            mediaId, 
            targetTime, 
            finalTime, 
            success 
        });

        return { success, initialTime, finalTime };
    }

    /**
     * Keyboard Shortcut Testing
     */

    async testKeyboardShortcut(keyCode, expectedAction, mediaId = null) {
        this.logEvent('Keyboard Test Start', { keyCode, expectedAction, mediaId });

        // Get media element if specified
        const mediaInfo = mediaId ? this.mediaElements.get(mediaId) : null;
        const element = mediaInfo?.element;

        // Record initial state
        const initialState = element ? {
            currentTime: element.currentTime,
            playbackRate: element.playbackRate,
            volume: element.volume,
            paused: element.paused
        } : {};

        // Focus element if specified
        if (element) {
            element.focus();
        }

        // Simulate keypress
        const keyEvent = new KeyboardEvent('keydown', {
            keyCode: keyCode,
            which: keyCode,
            code: `Key${String.fromCharCode(keyCode)}`,
            bubbles: true,
            cancelable: true
        });

        document.dispatchEvent(keyEvent);

        // Wait for potential changes
        await this.sleep(500);

        // Record final state
        const finalState = element ? {
            currentTime: element.currentTime,
            playbackRate: element.playbackRate,
            volume: element.volume,
            paused: element.paused
        } : {};

        this.logEvent('Keyboard Test Complete', { 
            keyCode, 
            expectedAction, 
            initialState, 
            finalState 
        });

        return { initialState, finalState, keyEvent };
    }

    /**
     * Extension API Testing
     */

    async testStorageOperations() {
        await this.startTest('Storage Operations', 'Test storage get/set/remove operations');

        try {
            // Test set operation
            const testData = { testKey: 'testValue', timestamp: Date.now() };
            await this.mockAPI.storage.sync.set(testData);

            // Test get operation
            const retrieved = await this.mockAPI.storage.sync.get(['testKey', 'timestamp']);
            this.assert(retrieved.testKey === testData.testKey, 'Storage set/get should work');

            // Test remove operation
            await this.mockAPI.storage.sync.remove(['testKey']);
            const afterRemove = await this.mockAPI.storage.sync.get(['testKey']);
            this.assert(!afterRemove.testKey, 'Storage remove should work');

            await this.endTest(true);
        } catch (error) {
            await this.endTest(false, error.message);
        }
    }

    async testSettingsValidation() {
        await this.startTest('Settings Validation', 'Test settings format and validation');

        try {
            // Test valid settings
            const validSettings = {
                speed: 1.5,
                volumeBoostLimit: 3.0,
                keyBindings: [
                    { action: 'faster', key: 68, value: 0.25 }
                ]
            };

            await this.mockAPI.storage.sync.set(validSettings);
            const retrieved = await this.mockAPI.storage.sync.get(['speed', 'volumeBoostLimit']);
            
            this.assert(retrieved.speed === 1.5, 'Speed setting should be preserved');
            this.assert(retrieved.volumeBoostLimit === 3.0, 'Volume limit should be preserved');

            await this.endTest(true);
        } catch (error) {
            await this.endTest(false, error.message);
        }
    }

    /**
     * Utility Methods
     */

    async waitForCondition(condition, timeout = 5000, description = 'Condition') {
        const startTime = performance.now();
        const checkInterval = 100;

        while (performance.now() - startTime < timeout) {
            if (condition()) {
                return true;
            }
            await this.sleep(checkInterval);
        }

        throw new Error(`Timeout waiting for: ${description}`);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    assert(condition, message) {
        const assertion = {
            condition,
            message,
            timestamp: Date.now(),
            passed: !!condition
        };

        if (this.currentTest) {
            this.currentTest.assertions.push(assertion);
        }

        if (!condition) {
            throw new Error(`Assertion failed: ${message}`);
        }
    }

    /**
     * Logging and Reporting
     */

    logEvent(type, data) {
        const event = {
            type,
            data,
            timestamp: Date.now(),
            testName: this.currentTest?.name
        };

        if (this.currentTest) {
            this.currentTest.events.push(event);
        }

        if (this.testConfig.debugMode) {
            console.log(`📝 ${type}:`, data);
        }
    }

    logMediaEvent(mediaId, eventType, event) {
        const mediaInfo = this.mediaElements.get(mediaId);
        const element = mediaInfo?.element;

        this.logEvent('Media Event', {
            mediaId,
            eventType,
            currentTime: element?.currentTime,
            playbackRate: element?.playbackRate,
            volume: element?.volume,
            paused: element?.paused
        });
    }

    logKeyboardEvent(event) {
        this.logEvent('Keyboard Event', {
            keyCode: event.keyCode,
            key: event.key,
            target: event.target.tagName,
            ctrlKey: event.ctrlKey,
            shiftKey: event.shiftKey,
            altKey: event.altKey
        });
    }

    logExtensionMessage(direction, message) {
        this.logEvent('Extension Message', {
            direction,
            message,
            type: message?.type,
            data: message?.data
        });
    }

    /**
     * Generate comprehensive test report
     */
    generateReport() {
        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(t => t.status === 'passed').length;
        const failedTests = this.testResults.filter(t => t.status === 'failed').length;
        const totalDuration = this.testResults.reduce((sum, t) => sum + (t.duration || 0), 0);

        const report = {
            summary: {
                totalTests,
                passedTests,
                failedTests,
                successRate: totalTests > 0 ? (passedTests / totalTests * 100).toFixed(2) + '%' : '0%',
                totalDuration: totalDuration.toFixed(2) + 'ms',
                timestamp: new Date().toISOString()
            },
            tests: this.testResults,
            environment: {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                language: navigator.language,
                cookieEnabled: navigator.cookieEnabled,
                webAudioSupport: !!(window.AudioContext || window.webkitAudioContext),
                extensionAPIs: {
                    chrome: !!window.chrome,
                    browser: !!window.browser
                }
            },
            mediaElements: Array.from(this.mediaElements.entries()).map(([id, info]) => ({
                id,
                type: info.type,
                duration: info.element.duration,
                src: info.element.src || info.element.currentSrc
            }))
        };

        return report;
    }

    /**
     * Export test results
     */
    exportResults(format = 'json') {
        const report = this.generateReport();
        
        switch (format.toLowerCase()) {
            case 'json':
                return JSON.stringify(report, null, 2);
            
            case 'csv':
                const csvHeaders = 'Test Name,Status,Duration (ms),Assertions,Events\n';
                const csvRows = this.testResults.map(test => 
                    `"${test.name}",${test.status},${test.duration || 0},${test.assertions?.length || 0},${test.events?.length || 0}`
                ).join('\n');
                return csvHeaders + csvRows;
            
            case 'html':
                return this.generateHTMLReport(report);
            
            default:
                return report;
        }
    }

    generateHTMLReport(report) {
        return `
<!DOCTYPE html>
<html>
<head>
    <title>UME Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .test-pass { color: #28a745; }
        .test-fail { color: #dc3545; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h1>UME Test Report</h1>
    <div class="summary">
        <h3>Summary</h3>
        <p><strong>Total Tests:</strong> ${report.summary.totalTests}</p>
        <p><strong>Passed:</strong> <span class="test-pass">${report.summary.passedTests}</span></p>
        <p><strong>Failed:</strong> <span class="test-fail">${report.summary.failedTests}</span></p>
        <p><strong>Success Rate:</strong> ${report.summary.successRate}</p>
        <p><strong>Total Duration:</strong> ${report.summary.totalDuration}</p>
        <p><strong>Generated:</strong> ${report.summary.timestamp}</p>
    </div>
    <table>
        <tr><th>Test Name</th><th>Status</th><th>Duration</th><th>Description</th></tr>
        ${report.tests.map(test => `
            <tr>
                <td>${test.name}</td>
                <td class="${test.status === 'passed' ? 'test-pass' : 'test-fail'}">${test.status}</td>
                <td>${(test.duration || 0).toFixed(2)}ms</td>
                <td>${test.description || '-'}</td>
            </tr>
        `).join('')}
    </table>
</body>
</html>
        `;
    }
}

// Export for use in other test files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UMETestRunner;
} else {
    window.UMETestRunner = UMETestRunner;
}

// Auto-initialize if in browser
if (typeof window !== 'undefined') {
    window.testRunner = null;
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', async () => {
            window.testRunner = await new UMETestRunner().initialize();
            console.log('🧪 UME Test Runner ready! Use window.testRunner to access.');
        });
    } else {
        // DOM already ready
        (async () => {
            window.testRunner = await new UMETestRunner().initialize();
            console.log('🧪 UME Test Runner ready! Use window.testRunner to access.');
        })();
    }
}
