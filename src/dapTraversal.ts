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

export async function scanDapThread(
    client: DapClient,
    threadId: number,
    sink: TimestampVariableSink,
    limits: ScanLimits,
    isActive: () => boolean = () => true
): Promise<void> {
    if (!isActive()) {
        return;
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
        return;
    }

    const frame = stack.stackFrames?.[0];

    if (!frame) {
        return;
    }

    const scopes = await client.request(
        'scopes',
        {
            frameId: frame.id
        }
    ) as ScopesResponse;

    if (!isActive()) {
        return;
    }

    const visitedVariablesReferences = new Set<number>();
    const budget = new ScanBudget(limits);

    for (const scope of scopes.scopes ?? []) {
        if (!isActive()) {
            return;
        }

        if (!budget.hasRemainingVariables()) {
            return;
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
            isActive
        );

        await scanBranches(
            client,
            rootVariables.map(variable => [variable]),
            sink,
            visitedVariablesReferences,
            budget,
            isActive
        );
    }
}

async function scanBranches(
    client: DapClient,
    branches: PendingVariables[][],
    sink: TimestampVariableSink,
    visitedVariablesReferences: Set<number>,
    budget: ScanBudget,
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
}

async function scanVariables(
    client: DapClient,
    pending: PendingVariables,
    sink: TimestampVariableSink,
    visitedVariablesReferences: Set<number>,
    budget: ScanBudget,
    isActive: () => boolean
): Promise<PendingVariables[]> {
    if (
        !isActive() ||
        pending.variablesReference <= 0 ||
        !budget.canScanDepth(pending.depth) ||
        !budget.hasRemainingVariables() ||
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
        response = await client.request(
            'variables',
            {
                variablesReference:
                    pending.variablesReference
            }
        ) as VariablesResponse;
    } catch {
        return [];
    }

    if (!isActive()) {
        return [];
    }

    const children: PendingVariables[] = [];
    const variables = budget.limitVariablesAtLevel(
        response.variables ?? []
    );

    for (const variable of variables) {
        if (!isActive()) {
            return [];
        }

        if (!budget.tryProcessVariable()) {
            break;
        }

        const path = joinVariablePath(
            pending.parentPath,
            variable.name
        );

        sink.add(path, variable.name, variable.value);

        if (
            variable.variablesReference > 0 &&
            budget.canDescendFrom(pending.depth) &&
            budget.hasRemainingVariables()
        ) {
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

    if (name.startsWith('[')) {
        return `${parent}${name}`;
    }

    return `${parent}.${name}`;
}
