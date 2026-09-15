const assert = require('node:assert/strict');
const test = require('node:test');

const {
    resolveTimestampDebugConfiguration
} = require('../out/configuration');
const {
    DEFAULT_SCAN_LIMITS
} = require('../out/scanLimits');

test('resolves one safe configuration snapshot from defaults', () => {
    assert.deepEqual(
        resolveTimestampDebugConfiguration({}),
        {
            timezone: 'utc',
            fixedOffset: 'UTC+00:00',
            dateFormat: 'iso',
            detectionMode: 'safe',
            customFields: [],
            fieldPatterns: [],
            scanLimits: DEFAULT_SCAN_LIMITS
        }
    );
});

test('preserves valid timestamp settings in the snapshot', () => {
    assert.deepEqual(
        resolveTimestampDebugConfiguration({
            timezone: 'fixed',
            fixedOffset: 'UTC+05:45',
            dateFormat: 'european',
            detectionMode: 'aggressive',
            customFields: ['BillingDate'],
            fieldPatterns: ['.*At$'],
            maxScanDepth: 6,
            maxVariablesPerLevel: 25,
            maxTotalVariables: 250
        }),
        {
            timezone: 'fixed',
            fixedOffset: 'UTC+05:45',
            dateFormat: 'european',
            detectionMode: 'aggressive',
            customFields: ['BillingDate'],
            fieldPatterns: ['.*At$'],
            scanLimits: {
                maxScanDepth: 6,
                maxVariablesPerLevel: 25,
                maxTotalVariables: 250
            }
        }
    );
});

test('normalizes invalid workspace values without leaking them', () => {
    assert.deepEqual(
        resolveTimestampDebugConfiguration({
            timezone: 'invalid',
            fixedOffset: 'UTC+14:01',
            dateFormat: 'invalid',
            detectionMode: 'invalid',
            customFields: ['CreatedAt', 42, null],
            fieldPatterns: '.*At$',
            maxScanDepth: 0,
            maxVariablesPerLevel: '25',
            maxTotalVariables: Number.NaN
        }),
        {
            timezone: 'utc',
            fixedOffset: 'UTC+00:00',
            dateFormat: 'iso',
            detectionMode: 'safe',
            customFields: ['CreatedAt'],
            fieldPatterns: [],
            scanLimits: DEFAULT_SCAN_LIMITS
        }
    );
});
