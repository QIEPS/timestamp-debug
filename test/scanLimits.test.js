const assert = require('node:assert/strict');
const test = require('node:test');

const {
    DEFAULT_SCAN_LIMITS,
    resolveScanLimits,
    ScanBudget
} = require('../out/scanLimits');

test('uses safe defaults when scan limits are not configured', () => {
    assert.deepEqual(
        resolveScanLimits({}),
        DEFAULT_SCAN_LIMITS
    );
});

test('preserves valid configured scan limits', () => {
    assert.deepEqual(
        resolveScanLimits({
            maxScanDepth: 6,
            maxVariablesPerLevel: 25,
            maxTotalVariables: 250
        }),
        {
            maxScanDepth: 6,
            maxVariablesPerLevel: 25,
            maxTotalVariables: 250
        }
    );
});

test('replaces invalid scan limits with individual defaults', () => {
    const invalidValues = [
        0,
        -1,
        1.5,
        Number.NaN,
        Number.POSITIVE_INFINITY,
        '10',
        null
    ];

    for (const invalidValue of invalidValues) {
        assert.deepEqual(
            resolveScanLimits({
                maxScanDepth: invalidValue,
                maxVariablesPerLevel: invalidValue,
                maxTotalVariables: invalidValue
            }),
            DEFAULT_SCAN_LIMITS
        );
    }

    assert.deepEqual(
        resolveScanLimits({
            maxScanDepth: -1,
            maxVariablesPerLevel: 25,
            maxTotalVariables: 250
        }),
        {
            maxScanDepth: 4,
            maxVariablesPerLevel: 25,
            maxTotalVariables: 250
        }
    );
});

test('stops descending after the configured scan depth', () => {
    const budget = new ScanBudget({
        maxScanDepth: 2,
        maxVariablesPerLevel: 10,
        maxTotalVariables: 10
    });

    assert.equal(budget.canScanDepth(0), true);
    assert.equal(budget.canScanDepth(2), true);
    assert.equal(budget.canScanDepth(3), false);
    assert.equal(budget.canDescendFrom(1), true);
    assert.equal(budget.canDescendFrom(2), false);
});

test('limits variables processed at one level', () => {
    const budget = new ScanBudget({
        maxScanDepth: 4,
        maxVariablesPerLevel: 2,
        maxTotalVariables: 10
    });

    assert.deepEqual(
        budget.limitVariablesAtLevel([1, 2, 3, 4]),
        [1, 2]
    );
});

test('stops after the configured total variable count', () => {
    const budget = new ScanBudget({
        maxScanDepth: 4,
        maxVariablesPerLevel: 10,
        maxTotalVariables: 2
    });

    assert.equal(budget.tryProcessVariable(), true);
    assert.equal(budget.tryProcessVariable(), true);
    assert.equal(budget.tryProcessVariable(), false);
    assert.equal(budget.hasRemainingVariables(), false);
    assert.equal(budget.totalProcessedVariables, 2);
});
