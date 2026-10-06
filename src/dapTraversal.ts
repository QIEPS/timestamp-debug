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

type ScanContext = {
    client: DapClient;
    sink: TimestampVariableSink;
    budget: ScanBudget;
    visitedVariablesReferences: Set<number>;
    limitsReached: Set<DapScanLimit>;
    isActive: () => boolean;
};

export async function scanDapThread(
    client: DapClient,
    threadId: number,
    sink: TimestampVariableSink,
    limits: ScanLimits,
    options: DapScanOptions = {}
): Promise<DapScanResult> {
    const result: DapScanResult = {
        failed: false,
        limitsReached: [],
        skippedExpensiveScopes: 0
    };
    const isActive = options.isActive ?? (() => true);
    const scanExpensiveScopes =
        options.scanExpensiveScopes ?? true;

    if (!isActive()) {
        return result;
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
        return result;
    }

    const frame = stack.stackFrames?.[0];

    if (!frame) {
        return result;
    }

    const scopes = await client.request(
        'scopes',
        {
            frameId: frame.id
        }
    ) as ScopesResponse;

    if (!isActive()) {
        return result;
    }

    const context: ScanContext = {
        client,
        sink,
        budget: new ScanBudget(limits),
        visitedVariablesReferences: new Set(),
        limitsReached: new Set(),
        isActive
    };
    const availableScopes = scopes.scopes ?? [];
    const scopesToScan = scanExpensiveScopes
        ? availableScopes
        : availableScopes.filter(
            scope => scope.expensive !== true
        );
    result.skippedExpensiveScopes =
        availableScopes.length - scopesToScan.length;

    for (const scope of scopesToScan) {
        if (!isActive()) {
            break;
        }

        if (!context.budget.hasRemainingVariables()) {
            context.limitsReached.add('maxTotalVariables');
            break;
        }

        const rootResponse = await requestVariables(
            context,
            {
                variablesReference:
                    scope.variablesReference,
                parentPath: '',
                depth: 0
            }
        );

        if (!rootResponse) {
            continue;
        }

        const children = processVariables(context, rootResponse);

        await scanBranches(
            context,
            children.map(variable => [variable])
        );
    }

    result.limitsReached = [...context.limitsReached];
    return result;
}

async function scanBranches(
    context: ScanContext,
    branches: PendingVariables[][]
): Promise<void> {
    const { budget, limitsReached, isActive } = context;

    while (
        branches.length > 0 &&
        budget.hasRemainingVariables()
    ) {
        if (!isActive()) {
            return;
        }

        for (
            let offset = 0;
            offset < branches.length;
            offset += MAX_CONCURRENT_VARIABLE_REQUESTS
        ) {
            if (!isActive()) {
                return;
            }

            if (!budget.hasRemainingVariables()) {
                limitsReached.add('maxTotalVariables');
                return;
            }

            const batch = branches.slice(
                offset,
                offset + MAX_CONCURRENT_VARIABLE_REQUESTS
            );
            // Read one group per root branch in each round. Requests may
            // finish out of order; apply them below in stable branch order.
            const requests = await Promise.all(
                batch.map(branch => {
                    const pending = branch.shift();

                    return pending
                        ? requestVariables(context, pending)
                        : undefined;
                })
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

                batch[index].push(
                    ...processVariables(context, request)
                );
            }
        }

        branches = branches.filter(branch => branch.length > 0);
    }

    if (
        branches.length > 0 &&
        !budget.hasRemainingVariables()
    ) {
        limitsReached.add('maxTotalVariables');
    }
}

async function requestVariables(
    context: ScanContext,
    pending: PendingVariables
): Promise<RequestedVariables | undefined> {
    const {
        client, budget, visitedVariablesReferences,
        limitsReached, isActive
    } = context;

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
    context: ScanContext,
    request: RequestedVariables
): PendingVariables[] {
    const { sink, budget, limitsReached, isActive } = context;
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
