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
    parseIsoTimestamp,
    parseTimestamp,
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

test('parses supported strict ISO timestamp strings', () => {
    const values = [
        [
            '2026-07-02T20:30:09Z',
            '2026-07-02T20:30:09.000Z'
        ],
        [
            '2026-07-02T20:30:09.229Z',
            '2026-07-02T20:30:09.229Z'
        ],
        [
            '2026-07-02T20:30:09+03:00',
            '2026-07-02T17:30:09.000Z'
        ],
        [
            '2026-07-02T20:30:09.229+03:00',
            '2026-07-02T17:30:09.229Z'
        ],
        [
            '2026-07-02 20:30:09.229+00:00',
            '2026-07-02T20:30:09.229Z'
        ]
    ];

    for (const [value, expected] of values) {
        assert.equal(
            parseIsoTimestamp(value)?.date.toISOString(),
            expected
        );
    }
});

test('parses quoted debugger ISO values and preserves raw text', () => {
    const doubleQuoted =
        '"2026-07-02T20:30:09.229Z"';
    const singleQuoted =
        "'2026-07-02T20:30:09.229Z'";

    assert.equal(
        parseTimestamp(doubleQuoted)?.raw,
        doubleQuoted
    );
    assert.equal(
        parseTimestamp(singleQuoted)?.raw,
        singleQuoted
    );
});

test('rejects malformed or out-of-range ISO timestamp strings', () => {
    const invalidValues = [
        '2026-07-02',
        '2026-07-02T20:30:09',
        '2026-07-02T20:30:09z',
        '2026-07-02T20:30:09.2Z',
        '2026-07-02T20:30:09.2290Z',
        '2026-02-29T20:30:09Z',
        '2026-13-02T20:30:09Z',
        '2026-07-02T24:00:00Z',
        '2026-07-02T20:60:00Z',
        '2026-07-02T20:30:60Z',
        '2026-07-02T20:30:09+14:01',
        '2026-07-02T20:30:09+15:00',
        'value=2026-07-02T20:30:09Z',
        '"2026-07-02T20:30:09Z\'',
        '1999-12-31T23:59:59.999Z',
        '2101-01-01T00:00:00.000Z'
    ];

    for (const value of invalidValues) {
        assert.equal(parseIsoTimestamp(value), undefined);
    }
});

test('accepts ISO boundary years and valid leap days', () => {
    assert.ok(parseIsoTimestamp(
        '2000-01-01T00:00:00.000Z'
    ));
    assert.ok(parseIsoTimestamp(
        '2100-12-31T23:59:59.999Z'
    ));
    assert.ok(parseIsoTimestamp(
        '2024-02-29T12:00:00Z'
    ));
});

test('applies Safe and Aggressive detection to ISO values', () => {
    const isoValue = '2026-07-02T20:30:09.229Z';

    assert.ok(detectTimestampValue(
        'CreatedAt',
        isoValue,
        'safe',
        matchesTimestampField
    ));
    assert.equal(detectTimestampValue(
        'value',
        isoValue,
        'safe',
        matchesTimestampField
    ), undefined);
    assert.ok(detectTimestampValue(
        'value',
        isoValue,
        'aggressive',
        matchesTimestampField
    ));
});
