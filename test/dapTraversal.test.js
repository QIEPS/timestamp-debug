const assert = require('node:assert/strict');
const test = require('node:test');

const {
    joinVariablePath,
    scanDapThread
} = require('../out/dapTraversal');

function createClient(
    variablesByReference,
    scopes = [{
        name: 'Locals',
        variablesReference: 1
    }]
) {
    const variableRequests = [];
    const variableRequestArguments = [];

    return {
        variableRequests,
        variableRequestArguments,
        async request(command, argumentsValue) {
            if (command === 'stackTrace') {
                return { stackFrames: [{ id: 100 }] };
            }

            if (command === 'scopes') {
                return { scopes };
            }

            if (command === 'variables') {
                const reference =
                    argumentsValue.variablesReference;

                variableRequests.push(reference);
                variableRequestArguments.push(
                    argumentsValue
                );

                const variables =
                    variablesByReference.get(reference) ?? [];
                const start = argumentsValue.start ?? 0;
                const count = argumentsValue.count ??
                    variables.length;

                return {
                    variables: variables.slice(
                        start,
                        start + count
                    )
                };
            }

            throw new Error(`Unexpected command: ${command}`);
        }
    };
}

function variable(
    name,
    value,
    variablesReference = 0,
    type
) {
    return {
        name,
        value,
        variablesReference,
        ...(type ? { type } : {})
    };
}

const limits = {
    maxScanDepth: 4,
    maxVariablesPerLevel: 100,
    maxTotalVariables: 1000
};

test('uses bracket notation for numeric DAP child names', () => {
    assert.equal(
        joinVariablePath('items', '0'),
        'items[0]'
    );
    assert.equal(
        joinVariablePath('items', '[1]'),
        'items[1]'
    );
});

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
        ]]
    ]));
    const paths = [];

    const result = await scanDapThread(
        client,
        7,
        { add: path => paths.push(path) },
        limits
    );

    assert.deepEqual(client.variableRequests, [1, 2, 3]);
    assert.deepEqual(result, {
        failed: false,
        limitsReached: [],
        skippedExpensiveScopes: 0
    });
    assert.deepEqual(paths, [
        'segments',
        'CreatedAt',
        'segments[0]',
        'segments[0].End',
        'segments[0].parent'
    ]);
});

test('optionally skips scopes marked expensive by DAP', async () => {
    const client = createClient(
        new Map([
            [1, [variable('CreatedAt', '1783024209229')]],
            [9, [variable('UpdatedAt', '1783024209229')]],
            [10, [variable('EndTime', '1783024209229')]]
        ]),
        [
            {
                name: 'Locals',
                variablesReference: 1,
                expensive: false
            },
            {
                name: 'Global',
                variablesReference: 9,
                expensive: true
            },
            {
                name: 'Unspecified',
                variablesReference: 10
            }
        ]
    );
    const paths = [];

    const result = await scanDapThread(
        client,
        7,
        { add: path => paths.push(path) },
        limits,
        { scanExpensiveScopes: false }
    );

    assert.deepEqual(client.variableRequests, [1, 10]);
    assert.deepEqual(paths, ['CreatedAt', 'EndTime']);
    assert.deepEqual(result, {
        failed: false,
        limitsReached: [],
        skippedExpensiveScopes: 1
    });
});

test('scans DAP scopes without relying on language-specific names', async () => {
    const client = createClient(
        new Map([
            [1, [variable('CreatedAt', '1783024209229')]],
            [9, [variable('UpdatedAt', '1783024209229')]]
        ]),
        [
            { name: 'Variables', variablesReference: 1 },
            {
                name: 'Closure',
                variablesReference: 9,
                expensive: true
            },
            { name: 'Unavailable', variablesReference: 0 }
        ]
    );
    const paths = [];

    const result = await scanDapThread(
        client,
        7,
        { add: path => paths.push(path) },
        limits
    );

    assert.deepEqual(client.variableRequests, [1, 9]);
    assert.deepEqual(paths, ['CreatedAt', 'UpdatedAt']);
    assert.deepEqual(result.limitsReached, []);
});

test('finishes an earlier scope before a large later scope consumes the budget', async () => {
    const client = createClient(
        new Map([
            [1, [variable('data', 'Object', 2)]],
            [2, [variable('CreatedAt', '1783024209229')]],
            [9, [
                variable('firstGlobal', 'Object', 10),
                variable('secondGlobal', 'Object', 11)
            ]]
        ]),
        [
            { name: 'Variables', variablesReference: 1 },
            { name: 'Global', variablesReference: 9 }
        ]
    );
    const paths = [];

    await scanDapThread(
        client,
        7,
        { add: path => paths.push(path) },
        {
            ...limits,
            maxTotalVariables: 3
        }
    );

    assert.deepEqual(client.variableRequests, [1, 2, 9]);
    assert.deepEqual(paths, [
        'data',
        'data.CreatedAt',
        'firstGlobal'
    ]);
});

test('follows pointer, map and object shapes only by variablesReference', async () => {
    const client = createClient(new Map([
        [1, [
            variable(
                'goPointer',
                '*main.Event',
                2,
                '*main.Event'
            ),
            variable(
                'goMap',
                'map[string]int [...]',
                3,
                'map[string]int'
            ),
            variable(
                'goTime',
                'time.Time(...)',
                4,
                'time.Time'
            ),
            variable('nilReference', 'nil', 5),
            variable('nodeObject', 'Object', 6, 'Object'),
            variable('pythonDict', "{'created_at': ...}", 7, 'dict')
        ]],
        [2, [variable('CreatedAt', '1783024209229')]],
        [3, [variable('[created_at]', '1783024209229')]],
        [4, [variable('UpdatedAt', '1783024209229')]],
        [5, [variable('End', '1783024209229')]],
        [6, [variable('items', 'Array(1)', 8)]],
        [7, [variable("['created_at']", '1783024209229')]],
        [8, [variable('[0]', 'Object', 9)]],
        [9, [variable('Timestamp', '1783024209229')]]
    ]));
    const paths = [];

    await scanDapThread(
        client,
        7,
        { add: path => paths.push(path) },
        limits
    );

    assert.deepEqual(
        client.variableRequests,
        [1, 2, 3, 4, 5, 6, 7, 8, 9]
    );
    assert.ok(paths.includes('goPointer.CreatedAt'));
    assert.ok(paths.includes('goMap[created_at]'));
    assert.ok(paths.includes('goTime.UpdatedAt'));
    assert.ok(paths.includes('nilReference.End'));
    assert.ok(paths.includes('nodeObject.items[0].Timestamp'));
    assert.ok(paths.includes("pythonDict['created_at']"));
});

test('scans shallow siblings before deeper aliases with new references', async () => {
    const client = createClient(new Map([
        [1, [
            variable('cycle', 'Object', 2),
            variable('data', 'Object', 3)
        ]],
        [2, [variable('parent', 'Object', 4)]],
        [3, [variable('CreatedAt', '1783024209229')]],
        [4, [
            variable('CreatedAt', '1783024209229'),
            variable('cycle', 'Object', 5)
        ]],
        [5, [variable('parent', 'Object', 6)]],
        [6, [variable('CreatedAt', '1783024209229')]]
    ]));
    const paths = [];

    await scanDapThread(
        client,
        7,
        { add: path => paths.push(path) },
        limits
    );

    assert.deepEqual(
        client.variableRequests,
        [1, 2, 3, 4, 5, 6]
    );
    assert.ok(
        paths.indexOf('data.CreatedAt') <
        paths.indexOf('cycle.parent.CreatedAt')
    );
});

test('bounds concurrent variable requests and preserves result order', async () => {
    const childCount = 8;
    const waiting = [];
    let activeRequests = 0;
    let maximumActiveRequests = 0;
    const client = {
        async request(command, argumentsValue) {
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

            const reference =
                argumentsValue.variablesReference;

            if (reference === 1) {
                return {
                    variables: Array.from(
                        { length: childCount },
                        (_, index) => variable(
                            `branch${index}`,
                            'Object',
                            index + 2
                        )
                    )
                };
            }

            activeRequests += 1;
            maximumActiveRequests = Math.max(
                maximumActiveRequests,
                activeRequests
            );

            return new Promise(resolve => {
                waiting.push(() => {
                    activeRequests -= 1;
                    resolve({
                        variables: [variable(
                            'CreatedAt',
                            '1783024209229'
                        )]
                    });
                });

                if (waiting.length === 4) {
                    queueMicrotask(() => {
                        for (const release of waiting.splice(0)) {
                            release();
                        }
                    });
                }
            });
        }
    };
    const paths = [];

    await scanDapThread(
        client,
        7,
        { add: path => paths.push(path) },
        limits
    );

    assert.equal(maximumActiveRequests, 4);
    assert.deepEqual(
        paths,
        [
            ...Array.from(
                { length: childCount },
                (_, index) => `branch${index}`
            ),
            ...Array.from(
                { length: childCount },
                (_, index) => `branch${index}.CreatedAt`
            )
        ]
    );
});

test('gives a deep branch time before a wide sibling exhausts the budget', async () => {
    const client = createClient(new Map([
        [1, [
            variable('data', 'Object', 2),
            variable('wide', 'Object', 9)
        ]],
        [2, [variable('items', 'Array(1)', 3)]],
        [3, [variable('[0]', 'Object', 4)]],
        [4, [variable('CreatedAt', '1783024209229')]],
        [9, [
            variable('first', 'Object', 10),
            variable('second', 'Object', 11),
            variable('third', 'Object', 12)
        ]],
        [10, [variable('child', 'Object', 20)]],
        [11, [variable('child', 'Object', 21)]],
        [12, [variable('child', 'Object', 22)]]
    ]));
    const paths = [];

    await scanDapThread(
        client,
        7,
        { add: path => paths.push(path) },
        {
            ...limits,
            maxTotalVariables: 10
        }
    );

    assert.ok(paths.includes('data.items[0].CreatedAt'));
    assert.deepEqual(
        client.variableRequests.slice(0, 7),
        [1, 2, 9, 3, 10, 4, 11]
    );
});

test('stops requesting children after the configured depth', async () => {
    const client = createClient(new Map([
        [1, [variable('root', 'Object', 2)]],
        [2, [variable('child', 'Object', 3)]],
        [3, [variable('CreatedAt', '1783024209229')]]
    ]));
    const paths = [];

    const result = await scanDapThread(
        client,
        7,
        { add: path => paths.push(path) },
        {
            ...limits,
            maxScanDepth: 1
        }
    );

    assert.deepEqual(client.variableRequests, [1, 2]);
    assert.deepEqual(paths, ['root', 'root.child']);
    assert.deepEqual(result.limitsReached, [
        'maxScanDepth'
    ]);
});

test('reports when variables are truncated at one level', async () => {
    const client = createClient(new Map([
        [1, [
            variable('first', '1'),
            variable('second', '2'),
            variable('third', '3')
        ]]
    ]));

    const result = await scanDapThread(
        client,
        7,
        { add() {} },
        {
            ...limits,
            maxVariablesPerLevel: 2
        }
    );

    assert.deepEqual(result.limitsReached, [
        'maxVariablesPerLevel'
    ]);
    assert.deepEqual(
        client.variableRequestArguments[0],
        {
            variablesReference: 1,
            start: 0,
            count: 3
        }
    );
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

    const result = await scanDapThread(
        client,
        7,
        { add: path => paths.push(path) },
        {
            ...limits,
            maxTotalVariables: 2
        }
    );

    assert.deepEqual(paths, ['first', 'second']);
    assert.deepEqual(result.limitsReached, [
        'maxTotalVariables'
    ]);
    assert.equal(
        client.variableRequestArguments[0].count,
        3
    );
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
        { isActive: () => active }
    );

    assert.deepEqual(paths, []);
});
