import * as vscode from 'vscode';
import { TimestampProvider } from './timestampProvider';
import { isTimestampName } from './timestamp';
import { DapVariable } from './types';

const MAX_DEPTH = 4;
const MAX_VARIABLES_PER_LEVEL = 100;

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

        for (const scope of localScopes) {
            await scanVariables(
                session,
                scope.variablesReference,
                '',
                0,
                provider,
                visited
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
    visited: Set<number>
): Promise<void> {
    if (!variablesReference) {
        return;
    }

    if (depth > MAX_DEPTH) {
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

    const variables =
        response.variables ?? [];

    for (
        const variable of variables.slice(
            0,
            MAX_VARIABLES_PER_LEVEL
        )
    ) {
        const path = joinPath(
            parentPath,
            variable.name
        );

        if (isTimestampName(variable.name)) {
            provider.add(
                path,
                variable.value
            );
        }

        if (
            variable.variablesReference > 0 &&
            shouldDescend(variable, depth)
        ) {
            await scanVariables(
                session,
                variable.variablesReference,
                path,
                depth + 1,
                provider,
                visited
            );
        }
    }
}

function shouldDescend(
    variable: DapVariable,
    depth: number
): boolean {
    if (depth >= MAX_DEPTH) {
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
