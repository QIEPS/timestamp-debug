const assert = require('node:assert/strict');
const test = require('node:test');

const {
    buildTimestampTree,
    formatTimestampDescription,
    splitVariablePath
} = require('../out/timestampTree');

const date = '2026-07-02 20:30:09.229 UTC';

function timestamp(path, raw = '1783024209229') {
    return { path, raw, date };
}

test('builds a collapsible hierarchy from debugger paths', () => {
    const roots = buildTimestampTree([
        timestamp('timeSegments[0].Start'),
        timestamp('timeSegments[0].End'),
        timestamp('timeSegments[1].Start')
    ]);

    assert.equal(roots.length, 1);
    assert.equal(roots[0].label, 'timeSegments');
    assert.deepEqual(
        roots[0].children.map(node => node.label),
        ['[0]', '[1]']
    );
    assert.deepEqual(
        roots[0].children[0].children.map(
            node => node.label
        ),
        ['Start', 'End']
    );
    assert.equal(
        roots[0].children[0].children[0].timestamp.path,
        'timeSegments[0].Start'
    );
});

test('keeps bracket keys containing dots as one path segment', () => {
    assert.deepEqual(
        splitVariablePath("payload['created.at'].Timestamp"),
        ['payload', "['created.at']", 'Timestamp']
    );
});

test('formats both supported timestamp display modes', () => {
    const item = timestamp('payload.CreatedAt');

    assert.equal(
        formatTimestampDescription(item, 'date'),
        date
    );
    assert.equal(
        formatTimestampDescription(
            item,
            'timestampAndDate'
        ),
        `1783024209229 → ${date}`
    );
});
