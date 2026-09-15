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

export type DapTraversalPolicy = {
    shouldScanScope(scope: DapScope): boolean;
    shouldDescend(variable: DapVariable): boolean;
};

export async function scanDapThread(
    client: DapClient,
    threadId: number,
    sink: TimestampVariableSink,
    limits: ScanLimits,
    policy: DapTraversalPolicy,
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
            break;
        }

        if (!policy.shouldScanScope(scope)) {
            continue;
        }

        await scanVariables(
            client,
            scope.variablesReference,
            '',
            0,
            sink,
            visitedVariablesReferences,
            budget,
            policy,
            isActive
        );
    }
}

async function scanVariables(
    client: DapClient,
    variablesReference: number,
    parentPath: string,
    depth: number,
    sink: TimestampVariableSink,
    visitedVariablesReferences: Set<number>,
    budget: ScanBudget,
    policy: DapTraversalPolicy,
    isActive: () => boolean
): Promise<void> {
    if (!isActive()) {
        return;
    }

    if (variablesReference <= 0) {
        return;
    }

    if (!budget.canScanDepth(depth)) {
        return;
    }

    if (!budget.hasRemainingVariables()) {
        return;
    }

    if (
        visitedVariablesReferences.has(
            variablesReference
        )
    ) {
        return;
    }

    visitedVariablesReferences.add(variablesReference);

    let response: VariablesResponse;

    try {
        response = await client.request(
            'variables',
            { variablesReference }
        ) as VariablesResponse;
    } catch {
        return;
    }

    if (!isActive()) {
        return;
    }

    const variables = budget.limitVariablesAtLevel(
        response.variables ?? []
    );

    for (const variable of variables) {
        if (!isActive()) {
            return;
        }

        if (!budget.tryProcessVariable()) {
            return;
        }

        const path = joinVariablePath(
            parentPath,
            variable.name
        );

        sink.add(path, variable.name, variable.value);

        if (
            variable.variablesReference > 0 &&
            budget.canDescendFrom(depth) &&
            budget.hasRemainingVariables() &&
            policy.shouldDescend(variable)
        ) {
            await scanVariables(
                client,
                variable.variablesReference,
                path,
                depth + 1,
                sink,
                visitedVariablesReferences,
                budget,
                policy,
                isActive
            );
        }
    }
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
