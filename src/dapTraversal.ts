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
};

export async function scanDapThread(
    client: DapClient,
    threadId: number,
    sink: TimestampVariableSink,
    limits: ScanLimits,
    isActive: () => boolean = () => true
): Promise<DapScanResult> {
    const limitsReached = new Set<DapScanLimit>();

    if (!isActive()) {
        return { failed: false, limitsReached: [] };
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
        return { failed: false, limitsReached: [] };
    }

    const frame = stack.stackFrames?.[0];

    if (!frame) {
        return { failed: false, limitsReached: [] };
    }

    const scopes = await client.request(
        'scopes',
        {
            frameId: frame.id
        }
    ) as ScopesResponse;

    if (!isActive()) {
        return { failed: false, limitsReached: [] };
    }

    const visitedVariablesReferences = new Set<number>();
    const budget = new ScanBudget(limits);

    for (const scope of scopes.scopes ?? []) {
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
        limitsReached: [...limitsReached]
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

        for (let index = 0; index < branches.length;) {
            if (!isActive()) {
                return;
            }

            if (!budget.hasRemainingVariables()) {
                limitsReached.add('maxTotalVariables');
                return;
            }

            const branch = branches[index];
            const pending = branch.shift();

            if (!pending) {
                branches.splice(index, 1);
                continue;
            }

            const children = await scanVariables(
                client,
                pending,
                sink,
                visitedVariablesReferences,
                budget,
                limitsReached,
                isActive
            );

            branch.push(...children);

            if (branch.length === 0) {
                branches.splice(index, 1);
            } else {
                index += 1;
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
    if (!budget.canScanDepth(pending.depth)) {
        limitsReached.add('maxScanDepth');
        return [];
    }

    if (!budget.hasRemainingVariables()) {
        limitsReached.add('maxTotalVariables');
        return [];
    }

    if (
        !isActive() ||
        pending.variablesReference <= 0 ||
        visitedVariablesReferences.has(
            pending.variablesReference
        )
    ) {
        return [];
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
        return [];
    }

    if (!isActive()) {
        return [];
    }

    const children: PendingVariables[] = [];
    const responseVariables = response.variables ?? [];

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
