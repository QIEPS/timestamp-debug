const assert = require('node:assert/strict');
const test = require('node:test');

const {
    formatTimestampDate,
    parseFixedOffset
} = require('../out/timestampFormatter');

const sourceDate = new Date(
    '2026-07-02T20:30:09.229Z'
);

test('parses positive, negative and minute-precision offsets', () => {
    assert.deepEqual(parseFixedOffset('UTC+03:00'), {
        label: 'UTC+03:00',
        minutes: 180
    });

    assert.deepEqual(parseFixedOffset('UTC-04:00'), {
        label: 'UTC-04:00',
        minutes: -240
    });

    assert.deepEqual(parseFixedOffset('UTC+05:30'), {
        label: 'UTC+05:30',
        minutes: 330
    });

    assert.deepEqual(parseFixedOffset('UTC+05:45'), {
        label: 'UTC+05:45',
        minutes: 345
    });

    assert.deepEqual(parseFixedOffset('UTC+14:00'), {
        label: 'UTC+14:00',
        minutes: 840
    });

    assert.deepEqual(parseFixedOffset('UTC-14:00'), {
        label: 'UTC-14:00',
        minutes: -840
    });
});

test('rejects invalid fixed offsets', () => {
    const invalidOffsets = [
        'UTC+3:00',
        'UTC+05:60',
        'UTC+14:01',
        'UTC+15:00',
        'GMT+03:00',
        'UTC +03:00',
        180,
        null
    ];

    for (const offset of invalidOffsets) {
        assert.equal(parseFixedOffset(offset), undefined);
    }
});

test('formats a date using a positive fixed offset', () => {
    assert.equal(
        formatTimestampDate(sourceDate, {
            timezone: 'fixed',
            dateFormat: 'iso',
            fixedOffset: 'UTC+03:00'
        }),
        '2026-07-02 23:30:09.229 UTC+03:00'
    );
});

test('formats a date using a negative fixed offset', () => {
    assert.equal(
        formatTimestampDate(sourceDate, {
            timezone: 'fixed',
            dateFormat: 'iso',
            fixedOffset: 'UTC-04:00'
        }),
        '2026-07-02 16:30:09.229 UTC-04:00'
    );
});

test('supports minute precision and date rollover', () => {
    assert.equal(
        formatTimestampDate(sourceDate, {
            timezone: 'fixed',
            dateFormat: 'european',
            fixedOffset: 'UTC+05:45'
        }),
        '03.07.2026 02:15:09.229 UTC+05:45'
    );
});

test('falls back to UTC+00:00 for an invalid fixed offset', () => {
    assert.equal(
        formatTimestampDate(sourceDate, {
            timezone: 'fixed',
            dateFormat: 'iso',
            fixedOffset: 'UTC+15:00'
        }),
        '2026-07-02 20:30:09.229 UTC+00:00'
    );
});

test('does not modify the source date while formatting', () => {
    const sourceTime = sourceDate.getTime();

    formatTimestampDate(sourceDate, {
        timezone: 'fixed',
        dateFormat: 'iso',
        fixedOffset: 'UTC+05:30'
    });

    assert.equal(sourceDate.getTime(), sourceTime);
});

test('preserves existing UTC formatting', () => {
    assert.equal(
        formatTimestampDate(sourceDate, {
            timezone: 'utc',
            dateFormat: 'iso'
        }),
        '2026-07-02 20:30:09.229 UTC'
    );
});

test('preserves existing local formatting', () => {
    const pad = (value, size = 2) =>
        value.toString().padStart(size, '0');

    const expected =
        `${sourceDate.getFullYear()}-` +
        `${pad(sourceDate.getMonth() + 1)}-` +
        `${pad(sourceDate.getDate())} ` +
        `${pad(sourceDate.getHours())}:` +
        `${pad(sourceDate.getMinutes())}:` +
        `${pad(sourceDate.getSeconds())}.` +
        `${pad(sourceDate.getMilliseconds(), 3)} Local`;

    assert.equal(
        formatTimestampDate(sourceDate, {
            timezone: 'local',
            dateFormat: 'iso'
        }),
        expected
    );
});
