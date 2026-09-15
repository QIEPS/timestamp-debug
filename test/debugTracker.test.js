const assert = require('node:assert/strict');
const test = require('node:test');

const {
    DebugTrackerState,
    getScopesResponse,
    getStoppedThreadId,
    getVariablesRequest,
    getVariablesResponse,
    isContinuedEvent,
    isStoppedEvent
} = require('../out/debugTracker');

function variable(name, value, variablesReference = 0) {
    return { name, value, variablesReference };
}

test('reads stopped and continued DAP events safely', () => {
    const stopped = {
        type: 'event',
        event: 'stopped',
        body: { threadId: 0 }
    };

    assert.equal(isStoppedEvent(stopped), true);
    assert.equal(getStoppedThreadId(stopped), 0);
    assert.equal(isContinuedEvent({
        type: 'event',
        event: 'continued'
    }), true);
    assert.equal(getStoppedThreadId(null), undefined);
});

test('reads valid scopes and filters malformed scope values', () => {
    assert.deepEqual(
        getScopesResponse({
            type: 'response',
            command: 'scopes',
            body: {
                scopes: [
                    {
                        name: 'Locals',
                        variablesReference: 4
                    },
                    {
                        name: 42,
                        variablesReference: 5
                    }
                ]
            }
        }),
        [{ name: 'Locals', variablesReference: 4 }]
    );

    assert.equal(getScopesResponse({
        type: 'response',
        command: 'variables'
    }), undefined);
});

test('correlates typed variables requests and responses', () => {
    assert.deepEqual(
        getVariablesRequest({
            type: 'request',
            command: 'variables',
            seq: 7,
            arguments: { variablesReference: 4 }
        }),
        { sequence: 7, variablesReference: 4 }
    );

    assert.deepEqual(
        getVariablesResponse({
            type: 'response',
            command: 'variables',
            request_seq: 7,
            body: {
                variables: [
                    {
                        name: 'CreatedAt',
                        value: '1783024209229',
                        type: 'int64',
                        variablesReference: 0
                    },
                    {
                        name: 'invalid',
                        variablesReference: 0
                    }
                ]
            }
        }),
        {
            requestSequence: 7,
            variables: [{
                name: 'CreatedAt',
                value: '1783024209229',
                type: 'int64',
                variablesReference: 0
            }]
        }
    );
});

test('builds nested variable paths from correlated DAP messages', () => {
    const state = new DebugTrackerState();

    state.captureScopes([
        { name: 'Locals', variablesReference: 1 }
    ]);

    state.recordVariablesRequest({
        sequence: 10,
        variablesReference: 1
    }, 3);

    assert.deepEqual(
        state.consumeVariablesResponse({
            requestSequence: 10,
            variables: [variable('segments', 'Array(1)', 2)]
        }, 3),
        [{
            path: 'segments',
            name: 'segments',
            value: 'Array(1)'
        }]
    );

    state.recordVariablesRequest({
        sequence: 11,
        variablesReference: 2
    }, 3);

    assert.equal(
        state.consumeVariablesResponse({
            requestSequence: 11,
            variables: [variable('[0]', 'Object', 3)]
        }, 3)[0].path,
        'segments[0]'
    );

    state.recordVariablesRequest({
        sequence: 12,
        variablesReference: 3
    }, 3);

    assert.equal(
        state.consumeVariablesResponse({
            requestSequence: 12,
            variables: [variable(
                'CreatedAt',
                '1783024209229'
            )]
        }, 3)[0].path,
        'segments[0].CreatedAt'
    );
});

test('discards responses from an older scan revision', () => {
    const state = new DebugTrackerState();

    state.recordVariablesRequest({
        sequence: 10,
        variablesReference: 1
    }, 3);

    const response = {
        requestSequence: 10,
        variables: [variable('CreatedAt', '1783024209229')]
    };

    assert.deepEqual(
        state.consumeVariablesResponse(response, 4),
        []
    );

    assert.deepEqual(
        state.consumeVariablesResponse(response, 3),
        []
    );
});
