const assert = require('node:assert/strict');
const test = require('node:test');

const {
    scanDapThread
} = require('../out/dapTraversal');

function createClient(variablesByReference) {
    const variableRequests = [];

    return {
        variableRequests,
        async request(command, argumentsValue) {
            if (command === 'stackTrace') {
                return { stackFrames: [{ id: 100 }] };
            }

            if (command === 'scopes') {
                return {
                    scopes: [
                        {
                            name: 'Locals',
                            variablesReference: 1
                        },
                        {
                            name: 'Globals',
                            variablesReference: 9
                        }
                    ]
                };
            }

            if (command === 'variables') {
                const reference =
                    argumentsValue.variablesReference;

                variableRequests.push(reference);

                return {
                    variables:
                        variablesByReference.get(reference) ?? []
                };
            }

            throw new Error(`Unexpected command: ${command}`);
        }
    };
}

function variable(name, value, variablesReference = 0) {
    return { name, value, variablesReference };
}

const limits = {
    maxScanDepth: 4,
    maxVariablesPerLevel: 100,
    maxTotalVariables: 1000
};

test('traverses standard DAP references and protects against cycles', async () => {
    const client = createClient(new Map([
        [1, [
            variable('segments', 'Array(1)', 2),
            variable('CreatedAt', '1783024209229')
        ]],
        [2, [variable('[0]', 'Object', 3)]],
        [3, [
            variable('End', '1783024209229'),
            variable('parent', 'Object', 1)
        ]],
        [9, [variable('IgnoredAt', '1783024209229')]]
    ]));
    const candidates = [];

    await scanDapThread(
        client,
        7,
        {
            add(path, name, value) {
                candidates.push({ path, name, value });
            }
        },
        limits,
        {
            shouldScanScope: scope =>
                scope.name === 'Locals',
            shouldDescend: () => true
        }
    );

    assert.deepEqual(client.variableRequests, [1, 2, 3]);
    assert.deepEqual(
        candidates.map(candidate => candidate.path),
        [
            'segments',
            'segments[0]',
            'segments[0].End',
            'segments[0].parent',
            'CreatedAt'
        ]
    );
});

test('applies depth and traversal policy before requesting children', async () => {
    const client = createClient(new Map([
        [1, [variable('root', 'Object', 2)]],
        [2, [variable('child', 'Object', 3)]],
        [3, [variable('CreatedAt', '1783024209229')]]
    ]));
    const paths = [];

    await scanDapThread(
        client,
        7,
        {
            add(path) {
                paths.push(path);
            }
        },
        {
            ...limits,
            maxScanDepth: 1
        },
        {
            shouldScanScope: scope =>
                scope.name === 'Locals',
            shouldDescend: variableValue =>
                variableValue.name !== 'child'
        }
    );

    assert.deepEqual(client.variableRequests, [1, 2]);
    assert.deepEqual(paths, ['root', 'root.child']);
});

test('stops exactly at the total variable budget', async () => {
    const client = createClient(new Map([
        [1, [
            variable('first', '1'),
            variable('second', '2'),
            variable('third', '3')
        ]]
    ]));
    const paths = [];

    await scanDapThread(
        client,
        7,
        { add: path => paths.push(path) },
        {
            ...limits,
            maxTotalVariables: 2
        },
        {
            shouldScanScope: () => true,
            shouldDescend: () => true
        }
    );

    assert.deepEqual(paths, ['first', 'second']);
});

test('stops without publishing results after cancellation', async () => {
    let active = true;
    const paths = [];
    const client = {
        async request(command) {
            if (command === 'stackTrace') {
                return { stackFrames: [{ id: 100 }] };
            }

            if (command === 'scopes') {
                return {
                    scopes: [{
                        name: 'Locals',
                        variablesReference: 1
                    }]
                };
            }

            active = false;

            return {
                variables: [variable(
                    'CreatedAt',
                    '1783024209229'
                )]
            };
        }
    };

    await scanDapThread(
        client,
        7,
        { add: path => paths.push(path) },
        limits,
        {
            shouldScanScope: () => true,
            shouldDescend: () => true
        },
        () => active
    );

    assert.deepEqual(paths, []);
});
