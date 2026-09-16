const assert = require('node:assert/strict');
const test = require('node:test');

const {
    resolveTimestampDebugConfiguration
} = require('../out/configuration');
const {
    TimestampConverter
} = require('../out/timestamp');

const timestamp = '1783024209229';

test('converter keeps Safe detection and formatting together', () => {
    const converter = new TimestampConverter(
        resolveTimestampDebugConfiguration({})
    );

    assert.deepEqual(
        converter.convert('CreatedAt', timestamp),
        {
            raw: timestamp,
            date: '2026-07-02 20:30:09.229 UTC'
        }
    );

    assert.equal(
        converter.convert('orderId', timestamp),
        undefined
    );
});

test('converter applies custom fields, patterns and fixed offset', () => {
    const converter = new TimestampConverter(
        resolveTimestampDebugConfiguration({
            timezone: 'fixed',
            fixedOffset: 'UTC+05:45',
            dateFormat: 'european',
            customFields: ['BillingDate'],
            fieldPatterns: ['.*At$']
        })
    );

    assert.equal(converter.isTimestampName('BillingDate'), true);
    assert.equal(converter.isTimestampName('RenewAt'), true);

    assert.deepEqual(
        converter.convert('BillingDate', timestamp),
        {
            raw: timestamp,
            date: '03.07.2026 02:15:09.229 UTC+05:45'
        }
    );
});

test('converter supports Aggressive mode without changing parsing', () => {
    const converter = new TimestampConverter(
        resolveTimestampDebugConfiguration({
            detectionMode: 'aggressive'
        })
    );

    assert.ok(converter.convert('orderId', timestamp));
    assert.equal(
        converter.convert('orderId', '12345'),
        undefined
    );
});

test('converter formats ISO timestamps and preserves the raw string', () => {
    const raw = '"2026-07-02T20:30:09.229+03:00"';
    const converter = new TimestampConverter(
        resolveTimestampDebugConfiguration({
            timezone: 'fixed',
            fixedOffset: 'UTC+05:45',
            dateFormat: 'european'
        })
    );

    assert.deepEqual(
        converter.convert('CreatedAt', raw),
        {
            raw,
            date: '02.07.2026 23:15:09.229 UTC+05:45'
        }
    );
});
