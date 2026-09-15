const assert = require('node:assert/strict');
const test = require('node:test');

const {
    createTimestampFieldMatcher
} = require('../out/timestampFieldMatcher');

test('preserves built-in timestamp field detection', () => {
    const matchesTimestampField =
        createTimestampFieldMatcher();

    assert.equal(matchesTimestampField('Start'), true);
    assert.equal(matchesTimestampField('created_at'), true);
    assert.equal(matchesTimestampField('orderId'), false);
});

test('matches custom field names exactly', () => {
    const matchesTimestampField =
        createTimestampFieldMatcher([
            'BillingDate',
            'RenewAt'
        ]);

    assert.equal(matchesTimestampField('BillingDate'), true);
    assert.equal(matchesTimestampField('RenewAt'), true);
    assert.equal(matchesTimestampField('billingdate'), false);
    assert.equal(matchesTimestampField('RenewAtSuffix'), false);
});

test('matches field names using configured patterns', () => {
    const matchesTimestampField =
        createTimestampFieldMatcher([], [
            '.*At$',
            '.*Timestamp$'
        ]);

    assert.equal(matchesTimestampField('RenewAt'), true);
    assert.equal(
        matchesTimestampField('BillingTimestamp'),
        true
    );
    assert.equal(matchesTimestampField('orderId'), false);
});

test('ignores invalid patterns without affecting valid rules', () => {
    assert.doesNotThrow(() => {
        const matchesTimestampField =
            createTimestampFieldMatcher(
                ['BillingDate'],
                ['[invalid', '.*At$']
            );

        assert.equal(
            matchesTimestampField('BillingDate'),
            true
        );
        assert.equal(matchesTimestampField('RenewAt'), true);
        assert.equal(matchesTimestampField('orderId'), false);
    });
});
