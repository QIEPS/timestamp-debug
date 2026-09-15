const assert = require('node:assert/strict');
const test = require('node:test');

const {
    detectTimestampValue,
    resolveDetectionMode
} = require('../out/timestampDetection');
const {
    createTimestampFieldMatcher
} = require('../out/timestampFieldMatcher');
const {
    parseUnixTimestamp
} = require('../out/timestampParser');

const timestamp = '1783024209229';
const matchesTimestampField = createTimestampFieldMatcher(
    ['BillingDate'],
    ['.*At$']
);

test('uses Safe mode for missing or invalid configuration', () => {
    assert.equal(resolveDetectionMode(undefined), 'safe');
    assert.equal(resolveDetectionMode('invalid'), 'safe');
    assert.equal(resolveDetectionMode('safe'), 'safe');
    assert.equal(
        resolveDetectionMode('aggressive'),
        'aggressive'
    );
});

test('Safe mode requires a built-in, custom or pattern field', () => {
    assert.ok(detectTimestampValue(
        'CreatedAt',
        timestamp,
        'safe',
        matchesTimestampField
    ));

    assert.ok(detectTimestampValue(
        'BillingDate',
        timestamp,
        'safe',
        matchesTimestampField
    ));

    assert.ok(detectTimestampValue(
        'RenewAt',
        timestamp,
        'safe',
        matchesTimestampField
    ));

    assert.equal(detectTimestampValue(
        'orderId',
        timestamp,
        'safe',
        matchesTimestampField
    ), undefined);

    assert.equal(detectTimestampValue(
        'CreatedAt',
        '123456789012',
        'safe',
        matchesTimestampField
    ), undefined);
});

test('Aggressive mode detects a timestamp regardless of field name', () => {
    const parsed = detectTimestampValue(
        'orderId',
        timestamp,
        'aggressive',
        matchesTimestampField
    );

    assert.equal(parsed?.raw, timestamp);
});

test('parses only supported Unix timestamp units', () => {
    const expectedMilliseconds = 1_783_024_209_229;

    const values = [
        ['1783024209', 1_783_024_209_000],
        ['1783024209229', expectedMilliseconds],
        ['1783024209229000', expectedMilliseconds],
        ['1783024209229000000', expectedMilliseconds]
    ];

    for (const [value, milliseconds] of values) {
        assert.equal(
            parseUnixTimestamp(value).date.getTime(),
            milliseconds
        );
    }

    const invalidLengths = [
        '178302420',
        '17830242092',
        '178302420922',
        '17830242092299',
        '178302420922999',
        '17830242092299999',
        '178302420922999999',
        '17830242092299999999'
    ];

    for (const value of invalidLengths) {
        assert.equal(parseUnixTimestamp(value), undefined);
    }
});

test('rejects embedded numeric substrings and unreasonable dates', () => {
    assert.equal(
        parseUnixTimestamp(`value=${timestamp}`),
        undefined
    );
    assert.equal(
        parseUnixTimestamp(`${timestamp}ms`),
        undefined
    );
    assert.equal(
        parseUnixTimestamp('0946684799000'),
        undefined
    );
    assert.equal(
        parseUnixTimestamp('4133980800000'),
        undefined
    );
});

test('Aggressive mode still rejects invalid timestamp values', () => {
    assert.equal(detectTimestampValue(
        'value',
        '123456789012',
        'aggressive',
        matchesTimestampField
    ), undefined);
});
