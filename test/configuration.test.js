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
            displayMode: 'timestampAndDate',
            detectionMode: 'safe',
            customFields: [],
            fieldPatterns: [],
            scanExpensiveScopes: true,
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
            displayMode: 'date',
            detectionMode: 'aggressive',
            customFields: ['BillingDate'],
            fieldPatterns: ['.*At$'],
            scanExpensiveScopes: false,
            maxScanDepth: 6,
            maxVariablesPerLevel: 25,
            maxTotalVariables: 250
        }),
        {
            timezone: 'fixed',
            fixedOffset: 'UTC+05:45',
            dateFormat: 'european',
            displayMode: 'date',
            detectionMode: 'aggressive',
            customFields: ['BillingDate'],
            fieldPatterns: ['.*At$'],
            scanExpensiveScopes: false,
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
            displayMode: 'invalid',
            detectionMode: 'invalid',
            customFields: ['CreatedAt', 42, null],
            fieldPatterns: '.*At$',
            scanExpensiveScopes: 'false',
            maxScanDepth: 0,
            maxVariablesPerLevel: '25',
            maxTotalVariables: Number.NaN
        }),
        {
            timezone: 'utc',
            fixedOffset: 'UTC+00:00',
            dateFormat: 'iso',
            displayMode: 'timestampAndDate',
            detectionMode: 'safe',
            customFields: ['CreatedAt'],
            fieldPatterns: [],
            scanExpensiveScopes: true,
            scanLimits: DEFAULT_SCAN_LIMITS
        }
    );
});
