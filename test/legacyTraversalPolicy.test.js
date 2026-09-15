const assert = require('node:assert/strict');
const test = require('node:test');

const {
    isLegacyLocalScope,
    passesLegacyTraversalPolicy
} = require('../out/legacyTraversalPolicy');

function variable(value, type) {
    return {
        name: 'value',
        value,
        type,
        variablesReference: 1
    };
}

test('preserves the existing local-scope selection', () => {
    assert.equal(isLegacyLocalScope({
        name: 'Locals',
        variablesReference: 1
    }), true);

    assert.equal(isLegacyLocalScope({
        name: 'Globals',
        variablesReference: 2
    }), false);
});

test('isolates the existing debugger-specific traversal exclusions', () => {
    assert.equal(
        passesLegacyTraversalPolicy(variable('nil')),
        false
    );
    assert.equal(
        passesLegacyTraversalPolicy(variable('*Object')),
        false
    );
    assert.equal(
        passesLegacyTraversalPolicy(variable('{}', '*Object')),
        false
    );
    assert.equal(
        passesLegacyTraversalPolicy(variable('{}', 'time.Time')),
        false
    );
    assert.equal(
        passesLegacyTraversalPolicy(variable('map[string]int {}')),
        false
    );
    assert.equal(
        passesLegacyTraversalPolicy(variable('{}', 'map[string]int')),
        false
    );
    assert.equal(
        passesLegacyTraversalPolicy(variable('Object', 'object')),
        true
    );
});
