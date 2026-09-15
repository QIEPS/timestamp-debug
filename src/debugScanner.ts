import * as vscode from 'vscode';
import { TimestampProvider } from './timestampProvider';
import { DapVariable } from './types';
import {
    resolveScanLimits,
    ScanBudget
} from './scanLimits';

export async function scanStoppedSession(
    session: vscode.DebugSession,
    threadId: number,
    provider: TimestampProvider
): Promise<void> {
    try {
        const stack = await session.customRequest(
            'stackTrace',
            {
                threadId,
                startFrame: 0,
                levels: 1
            }
        );

        const frame = stack.stackFrames?.[0];

        if (!frame) {
            return;
        }

        const scopes = await session.customRequest(
            'scopes',
            {
                frameId: frame.id
            }
        );

        const localScopes = (scopes.scopes ?? []).filter(
            (scope: { name: string }) =>
                scope.name.toLowerCase().includes('local')
        );

        const visited = new Set<number>();
        const budget = createScanBudget();

        for (const scope of localScopes) {
            if (!budget.hasRemainingVariables()) {
                break;
            }

            await scanVariables(
                session,
                scope.variablesReference,
                '',
                0,
                provider,
                visited,
                budget
            );
        }
    } catch (error) {
        console.error(
            '[Timestamp Debug] Scan error:',
            error
        );
    }
}

async function scanVariables(
    session: vscode.DebugSession,
    variablesReference: number,
    parentPath: string,
    depth: number,
    provider: TimestampProvider,
    visited: Set<number>,
    budget: ScanBudget
): Promise<void> {
    if (!variablesReference) {
        return;
    }

    if (!budget.canScanDepth(depth)) {
        return;
    }

    if (!budget.hasRemainingVariables()) {
        return;
    }

    if (visited.has(variablesReference)) {
        return;
    }

    visited.add(variablesReference);

    let response: {
        variables?: DapVariable[];
    };

    try {
        response = await session.customRequest(
            'variables',
            {
                variablesReference
            }
        );
    } catch {
        return;
    }

    const variables = budget.limitVariablesAtLevel(
        response.variables ?? []
    );

    for (const variable of variables) {
        if (!budget.tryProcessVariable()) {
            return;
        }

        const path = joinPath(
            parentPath,
            variable.name
        );

        provider.add(
            path,
            variable.name,
            variable.value
        );

        if (
            variable.variablesReference > 0 &&
            shouldDescend(variable, depth, budget)
        ) {
            await scanVariables(
                session,
                variable.variablesReference,
                path,
                depth + 1,
                provider,
                visited,
                budget
            );
        }
    }
}

function shouldDescend(
    variable: DapVariable,
    depth: number,
    budget: ScanBudget
): boolean {
    if (!budget.canDescendFrom(depth)) {
        return false;
    }

    if (!budget.hasRemainingVariables()) {
        return false;
    }

    const value = variable.value.trim();
    const type =
        (variable.type ?? '').toLowerCase();

    if (value === 'nil') {
        return false;
    }

    if (
        value.startsWith('*') ||
        type.startsWith('*')
    ) {
        return false;
    }

    if (type.includes('time.time')) {
        return false;
    }

    if (
        type.includes('map[') ||
        value.startsWith('map[')
    ) {
        return false;
    }

    return true;
}

function createScanBudget(): ScanBudget {
    const config = vscode.workspace
        .getConfiguration('timestampDebug');

    const limits = resolveScanLimits({
        maxScanDepth: config.get<unknown>(
            'maxScanDepth'
        ),
        maxVariablesPerLevel: config.get<unknown>(
            'maxVariablesPerLevel'
        ),
        maxTotalVariables: config.get<unknown>(
            'maxTotalVariables'
        )
    });

    return new ScanBudget(limits);
}

export function joinPath(
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
