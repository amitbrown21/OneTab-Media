#!/usr/bin/env node

/**
 * UME Test Suite Runner
 * Automated test execution for Ultimate Media Extension
 */

const fs = require('fs');
const path = require('path');

class TestSuiteRunner {
    constructor() {
        this.testResults = [];
        this.startTime = Date.now();
    }

    log(message, type = 'INFO') {
        const timestamp = new Date().toISOString();
        const colored = this.colorize(message, type);
        console.log(`[${timestamp}] [${type}] ${colored}`);
    }

    colorize(message, type) {
        const colors = {
            'INFO': '\x1b[36m%s\x1b[0m',    // Cyan
            'PASS': '\x1b[32m%s\x1b[0m',    // Green
            'FAIL': '\x1b[31m%s\x1b[0m',    // Red
            'WARN': '\x1b[33m%s\x1b[0m',    // Yellow
        };
        
        if (colors[type]) {
            return message.replace('%s', colors[type]);
        }
        return message;
    }

    async runFileSystemTests() {
        this.log('🗂️ Running file system tests...', 'INFO');
        let passed = 0, failed = 0;

        const expectedFiles = [
            'test-media.html',
            'automated-tests.html', 
            'manual-testing-checklist.md',
            'test-runner.js',
            'cross-browser-tests.html',
            'keyboard-shortcuts-tests.html'
        ];

        for (const file of expectedFiles) {
            const filePath = path.join(__dirname, file);
            try {
                const stats = fs.statSync(filePath);
                if (stats.isFile()) {
                    this.log(`✅ ${file} exists (${stats.size} bytes)`, 'PASS');
                    passed++;
                } else {
                    this.log(`❌ ${file} is not a file`, 'FAIL');
                    failed++;
                }
            } catch (error) {
                this.log(`❌ ${file} not found: ${error.message}`, 'FAIL');
                failed++;
            }
        }

        return { passed, failed };
    }

    async runExtensionFileTests() {
        this.log('📦 Running extension file tests...', 'INFO');
        let passed = 0, failed = 0;

        const extensionPaths = [
            '../firefox-extension',
            '../chrome-extension'
        ];

        for (const extPath of extensionPaths) {
            const manifestPath = path.join(__dirname, extPath, 'manifest.json');
            const contentPath = path.join(__dirname, extPath, 'content.js');
            const backgroundPath = path.join(__dirname, extPath, 'background.js');
            const optionsPath = path.join(__dirname, extPath, 'options.js');

            try {
                // Check manifest.json
                const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                if (manifest.name && manifest.version) {
                    this.log(`✅ ${extPath}/manifest.json is valid`, 'PASS');
                    passed++;
                } else {
                    this.log(`❌ ${extPath}/manifest.json missing required fields`, 'FAIL');
                    failed++;
                }

                // Check content.js
                const contentScript = fs.readFileSync(contentPath, 'utf8');
                if (contentScript.includes('speedSettings') && contentScript.includes('volumeBooster')) {
                    this.log(`✅ ${extPath}/content.js contains new features`, 'PASS');
                    passed++;
                } else {
                    this.log(`❌ ${extPath}/content.js missing expected features`, 'FAIL');
                    failed++;
                }

                // Check background.js
                const backgroundScript = fs.readFileSync(backgroundPath, 'utf8');
                if (backgroundScript.includes('activeMediaTabs') && backgroundScript.includes('setupPeriodicCleanup')) {
                    this.log(`✅ ${extPath}/background.js contains tab tracking fixes`, 'PASS');
                    passed++;
                } else {
                    this.log(`❌ ${extPath}/background.js missing tab tracking improvements`, 'FAIL');
                    failed++;
                }

                // Check options.js
                const optionsScript = fs.readFileSync(optionsPath, 'utf8');
                if (optionsScript.includes('volumeBoosterEnabled') && optionsScript.includes('actionDescriptions')) {
                    this.log(`✅ ${extPath}/options.js contains new settings`, 'PASS');
                    passed++;
                } else {
                    this.log(`❌ ${extPath}/options.js missing new settings`, 'FAIL');
                    failed++;
                }

            } catch (error) {
                this.log(`❌ Error checking ${extPath}: ${error.message}`, 'FAIL');
                failed++;
            }
        }

        return { passed, failed };
    }

    async runConfigurationTests() {
        this.log('⚙️ Running configuration tests...', 'INFO');
        let passed = 0, failed = 0;

        try {
            // Test default settings structure
            const firefoxContentPath = path.join(__dirname, '../firefox-extension/content.js');
            const contentScript = fs.readFileSync(firefoxContentPath, 'utf8');

            // Check for key features in content script
            const requiredFeatures = [
                'rememberSpeed: true',
                'audioBoolean: true', 
                'controllerOpacity: 0.8',
                'volumeBoosterEnabled: true',
                'mark.*key.*77',
                'jump.*key.*74',
                'volumeUp.*key.*38',
                'volumeDown.*key.*40'
            ];

            for (const feature of requiredFeatures) {
                const regex = new RegExp(feature, 'i');
                if (regex.test(contentScript)) {
                    this.log(`✅ Feature found: ${feature}`, 'PASS');
                    passed++;
                } else {
                    this.log(`❌ Feature missing: ${feature}`, 'FAIL');
                    failed++;
                }
            }

            // Test background script settings
            const backgroundPath = path.join(__dirname, '../firefox-extension/background.js');
            const backgroundScript = fs.readFileSync(backgroundPath, 'utf8');

            const backgroundFeatures = [
                'staleThreshold.*2.*60.*60.*1000', // 2 hours  
                'cleanup.*10.*60.*1000', // 10 minutes
                'GET_MEDIA_STATE'
            ];

            for (const feature of backgroundFeatures) {
                const regex = new RegExp(feature, 'i');
                if (regex.test(backgroundScript)) {
                    this.log(`✅ Background feature found: ${feature}`, 'PASS');
                    passed++;
                } else {
                    this.log(`❌ Background feature missing: ${feature}`, 'FAIL');
                    failed++;
                }
            }

        } catch (error) {
            this.log(`❌ Configuration test error: ${error.message}`, 'FAIL');
            failed++;
        }

        return { passed, failed };
    }

    async runHTMLValidationTests() {
        this.log('🌐 Running HTML validation tests...', 'INFO');
        let passed = 0, failed = 0;

        const htmlFiles = [
            'test-media.html',
            'automated-tests.html',
            'cross-browser-tests.html', 
            'keyboard-shortcuts-tests.html'
        ];

        for (const file of htmlFiles) {
            try {
                const content = fs.readFileSync(path.join(__dirname, file), 'utf8');
                
                // Basic HTML validation
                if (content.includes('<!DOCTYPE html>') && 
                    content.includes('<html') && 
                    content.includes('</html>')) {
                    this.log(`✅ ${file} has valid HTML structure`, 'PASS');
                    passed++;
                } else {
                    this.log(`❌ ${file} has invalid HTML structure`, 'FAIL');
                    failed++;
                }

                // Check for JavaScript
                if (content.includes('<script>') || content.includes('<script ')) {
                    this.log(`✅ ${file} contains JavaScript functionality`, 'PASS');
                    passed++;
                } else {
                    this.log(`❌ ${file} missing JavaScript`, 'FAIL');
                    failed++;
                }

                // Check for CSS
                if (content.includes('<style>') || content.includes('<style ')) {
                    this.log(`✅ ${file} contains CSS styling`, 'PASS');
                    passed++;
                } else {
                    this.log(`❌ ${file} missing CSS styling`, 'FAIL');
                    failed++;
                }

            } catch (error) {
                this.log(`❌ Error validating ${file}: ${error.message}`, 'FAIL');
                failed++;
            }
        }

        return { passed, failed };
    }

    generateTestReport() {
        const endTime = Date.now();
        const duration = endTime - this.startTime;
        
        const totalPassed = this.testResults.reduce((sum, result) => sum + result.passed, 0);
        const totalFailed = this.testResults.reduce((sum, result) => sum + result.failed, 0);
        const totalTests = totalPassed + totalFailed;
        
        const successRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : 0;

        console.log('\n' + '='.repeat(60));
        console.log('🧪 UME TEST SUITE RESULTS');
        console.log('='.repeat(60));
        console.log(`📊 Total Tests: ${totalTests}`);
        console.log(`✅ Passed: ${totalPassed}`);
        console.log(`❌ Failed: ${totalFailed}`);
        console.log(`📈 Success Rate: ${successRate}%`);
        console.log(`⏱️ Duration: ${duration}ms`);
        console.log('='.repeat(60));

        if (totalFailed === 0) {
            console.log('🎉 ALL TESTS PASSED! Extension is ready for use.');
        } else {
            console.log(`⚠️ ${totalFailed} tests failed. Please review the issues above.`);
        }

        return {
            totalTests,
            passed: totalPassed,
            failed: totalFailed,
            successRate: parseFloat(successRate),
            duration
        };
    }

    async runAllTests() {
        this.log('🚀 Starting UME comprehensive test suite...', 'INFO');
        
        try {
            this.testResults.push(await this.runFileSystemTests());
            this.testResults.push(await this.runExtensionFileTests());
            this.testResults.push(await this.runConfigurationTests());
            this.testResults.push(await this.runHTMLValidationTests());
            // Run the new full extension test suite
            try {
                const { runFullExtensionTests } = require('./full-extension-tests');
                const res = await runFullExtensionTests(this.log.bind(this));
                this.testResults.push(res);
            } catch (e) {
                this.log(`❌ Failed to execute full extension tests: ${e.message}`, 'FAIL');
                this.testResults.push({ passed: 0, failed: 1 });
            }
            
            return this.generateTestReport();
        } catch (error) {
            this.log(`💥 Test suite failed: ${error.message}`, 'FAIL');
            throw error;
        }
    }
}

// Main execution
async function main() {
    const runner = new TestSuiteRunner();
    
    try {
        const results = await runner.runAllTests();
        process.exit(results.failed === 0 ? 0 : 1);
    } catch (error) {
        console.error('💥 Test execution failed:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = TestSuiteRunner;
