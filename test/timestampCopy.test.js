const assert = require('node:assert/strict');
const test = require('node:test');

const {
    getTimestampCopyValue
} = require('../out/timestampCopy');

const timestampItem = {
    path: 'timeSegments[0].Start',
    raw: '1783024209229',
    date: '2026-07-02 20:30:09.229 UTC'
};

test('returns only the raw timestamp for copying', () => {
    assert.equal(
        getTimestampCopyValue(
            timestampItem,
            'timestamp'
        ),
        '1783024209229'
    );
});

test('returns only the formatted date for copying', () => {
    assert.equal(
        getTimestampCopyValue(
            timestampItem,
            'formattedDate'
        ),
        '2026-07-02 20:30:09.229 UTC'
    );
});

test('returns only the variable path for copying', () => {
    assert.equal(
        getTimestampCopyValue(
            timestampItem,
            'variablePath'
        ),
        'timeSegments[0].Start'
    );
});

test('preserves the original ISO debugger value for copying', () => {
    const isoItem = {
        path: 'payload.CreatedAt',
        raw: '"2026-07-02T20:30:09.229Z"',
        date: '2026-07-02 20:30:09.229 UTC'
    };

    assert.equal(
        getTimestampCopyValue(isoItem, 'timestamp'),
        '"2026-07-02T20:30:09.229Z"'
    );
});
