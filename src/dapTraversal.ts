import { ScanBudget } from './scanLimits';
import type { ScanLimits } from './scanLimits';
import type {
    DapScope,
    DapVariable
} from './types';

type StackTraceResponse = {
    stackFrames?: Array<{
        id: number;
    }>;
};

type ScopesResponse = {
    scopes?: DapScope[];
};

type VariablesResponse = {
    variables?: DapVariable[];
};

type PendingVariables = {
    variablesReference: number;
    parentPath: string;
    depth: number;
};

type RequestedVariables = {
    pending: PendingVariables;
    variables: DapVariable[];
};

const MAX_CONCURRENT_VARIABLE_REQUESTS = 4;

export type DapClient = {
    request(
        command: string,
        argumentsValue: Record<string, unknown>
    ): PromiseLike<unknown>;
};

export type TimestampVariableSink = {
    add(
        path: string,
        name: string,
        value: string
    ): void;
};

export type DapScanLimit = keyof ScanLimits;

export type DapScanResult = {
    failed: boolean;
    limitsReached: DapScanLimit[];
    skippedExpensiveScopes: number;
};

export type DapScanOptions = {
    isActive?: () => boolean;
    scanExpensiveScopes?: boolean;
};

export async function scanDapThread(
    client: DapClient,
    threadId: number,
    sink: TimestampVariableSink,
    limits: ScanLimits,
    options: DapScanOptions = {}
): Promise<DapScanResult> {
    const limitsReached = new Set<DapScanLimit>();
    const isActive = options.isActive ?? (() => true);
    const scanExpensiveScopes =
        options.scanExpensiveScopes ?? true;

    if (!isActive()) {
        return {
            failed: false,
            limitsReached: [],
            skippedExpensiveScopes: 0
        };
    }

    const stack = await client.request(
        'stackTrace',
        {
            threadId,
            startFrame: 0,
            levels: 1
        }
    ) as StackTraceResponse;

    if (!isActive()) {
        return {
            failed: false,
            limitsReached: [],
            skippedExpensiveScopes: 0
        };
    }

    const frame = stack.stackFrames?.[0];

    if (!frame) {
        return {
            failed: false,
            limitsReached: [],
            skippedExpensiveScopes: 0
        };
    }

    const scopes = await client.request(
        'scopes',
        {
            frameId: frame.id
        }
    ) as ScopesResponse;

    if (!isActive()) {
        return {
            failed: false,
            limitsReached: [],
            skippedExpensiveScopes: 0
        };
    }

    const visitedVariablesReferences = new Set<number>();
    const budget = new ScanBudget(limits);
    const availableScopes = scopes.scopes ?? [];
    const scopesToScan = scanExpensiveScopes
        ? availableScopes
        : availableScopes.filter(
            scope => scope.expensive !== true
        );
    const skippedExpensiveScopes =
        availableScopes.length - scopesToScan.length;

    for (const scope of scopesToScan) {
        if (!isActive()) {
            break;
        }

        if (!budget.hasRemainingVariables()) {
            limitsReached.add('maxTotalVariables');
            break;
        }

        const rootVariables = await scanVariables(
            client,
            {
                variablesReference:
                    scope.variablesReference,
                parentPath: '',
                depth: 0
            },
            sink,
            visitedVariablesReferences,
            budget,
            limitsReached,
            isActive
        );

        await scanBranches(
            client,
            rootVariables.map(variable => [variable]),
            sink,
            visitedVariablesReferences,
            budget,
            limitsReached,
            isActive
        );
    }

    return {
        failed: false,
        limitsReached: [...limitsReached],
        skippedExpensiveScopes
    };
}

async function scanBranches(
    client: DapClient,
    branches: PendingVariables[][],
    sink: TimestampVariableSink,
    visitedVariablesReferences: Set<number>,
    budget: ScanBudget,
    limitsReached: Set<DapScanLimit>,
    isActive: () => boolean
): Promise<void> {
    while (
        branches.length > 0 &&
        budget.hasRemainingVariables()
    ) {
        if (!isActive()) {
            return;
        }

        const round = branches.flatMap(branch => {
            const pending = branch.shift();

            return pending
                ? [{ branch, pending }]
                : [];
        });

        for (
            let offset = 0;
            offset < round.length;
            offset += MAX_CONCURRENT_VARIABLE_REQUESTS
        ) {
            if (!isActive()) {
                return;
            }

            if (!budget.hasRemainingVariables()) {
                limitsReached.add('maxTotalVariables');
                return;
            }

            const batch = round.slice(
                offset,
                offset + MAX_CONCURRENT_VARIABLE_REQUESTS
            );
            const requests = await Promise.all(
                batch.map(({ pending }) =>
                    requestVariables(
                        client,
                        pending,
                        visitedVariablesReferences,
                        budget,
                        limitsReached,
                        isActive
                    )
                )
            );

            for (const [index, request] of requests.entries()) {
                if (!isActive()) {
                    return;
                }

                if (!budget.hasRemainingVariables()) {
                    limitsReached.add('maxTotalVariables');
                    return;
                }

                if (!request) {
                    continue;
                }

                batch[index].branch.push(
                    ...processVariables(
                        request,
                        sink,
                        budget,
                        limitsReached,
                        isActive
                    )
                );
            }
        }

        for (let index = branches.length - 1; index >= 0; index--) {
            if (branches[index].length === 0) {
                branches.splice(index, 1);
            }
        }
    }

    if (
        branches.length > 0 &&
        !budget.hasRemainingVariables()
    ) {
        limitsReached.add('maxTotalVariables');
    }
}

async function scanVariables(
    client: DapClient,
    pending: PendingVariables,
    sink: TimestampVariableSink,
    visitedVariablesReferences: Set<number>,
    budget: ScanBudget,
    limitsReached: Set<DapScanLimit>,
    isActive: () => boolean
): Promise<PendingVariables[]> {
    const request = await requestVariables(
        client,
        pending,
        visitedVariablesReferences,
        budget,
        limitsReached,
        isActive
    );

    return request
        ? processVariables(
            request,
            sink,
            budget,
            limitsReached,
            isActive
        )
        : [];
}

async function requestVariables(
    client: DapClient,
    pending: PendingVariables,
    visitedVariablesReferences: Set<number>,
    budget: ScanBudget,
    limitsReached: Set<DapScanLimit>,
    isActive: () => boolean
): Promise<RequestedVariables | undefined> {
    if (!budget.canScanDepth(pending.depth)) {
        limitsReached.add('maxScanDepth');
        return undefined;
    }

    if (!budget.hasRemainingVariables()) {
        limitsReached.add('maxTotalVariables');
        return undefined;
    }

    if (
        !isActive() ||
        pending.variablesReference <= 0 ||
        visitedVariablesReferences.has(
            pending.variablesReference
        )
    ) {
        return undefined;
    }

    visitedVariablesReferences.add(
        pending.variablesReference
    );

    let response: VariablesResponse;

    try {
        const activeLimit = Math.min(
            budget.limits.maxVariablesPerLevel,
            budget.remainingVariables
        );
        const maximumResponseSize = activeLimit ===
            Number.MAX_SAFE_INTEGER
            ? Number.MAX_SAFE_INTEGER
            : activeLimit + 1;

        response = await client.request(
            'variables',
            {
                variablesReference:
                    pending.variablesReference,
                start: 0,
                count: maximumResponseSize
            }
        ) as VariablesResponse;
    } catch {
        return undefined;
    }

    if (!isActive()) {
        return undefined;
    }

    return {
        pending,
        variables: response.variables ?? []
    };
}

function processVariables(
    request: RequestedVariables,
    sink: TimestampVariableSink,
    budget: ScanBudget,
    limitsReached: Set<DapScanLimit>,
    isActive: () => boolean
): PendingVariables[] {
    const { pending, variables: responseVariables } = request;
    const children: PendingVariables[] = [];

    if (
        responseVariables.length >
        budget.limits.maxVariablesPerLevel
    ) {
        limitsReached.add('maxVariablesPerLevel');
    }

    const variables = budget.limitVariablesAtLevel(
        responseVariables
    );

    for (const variable of variables) {
        if (!isActive()) {
            return [];
        }

        if (!budget.tryProcessVariable()) {
            limitsReached.add('maxTotalVariables');
            break;
        }

        const path = joinVariablePath(
            pending.parentPath,
            variable.name
        );

        sink.add(path, variable.name, variable.value);

        if (variable.variablesReference <= 0) {
            continue;
        }

        if (!budget.canDescendFrom(pending.depth)) {
            limitsReached.add('maxScanDepth');
        } else if (!budget.hasRemainingVariables()) {
            limitsReached.add('maxTotalVariables');
        } else {
            children.push({
                variablesReference:
                    variable.variablesReference,
                parentPath: path,
                depth: pending.depth + 1
            });
        }
    }

    return children;
}

export function joinVariablePath(
    parent: string,
    name: string
): string {
    if (!parent) {
        return name;
    }

    if (
        name.startsWith('[') ||
        /^\d+$/.test(name)
    ) {
        return name.startsWith('[')
            ? `${parent}${name}`
            : `${parent}[${name}]`;
    }

    return `${parent}.${name}`;
}
