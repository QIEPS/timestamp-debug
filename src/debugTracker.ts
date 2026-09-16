import { joinVariablePath } from './dapTraversal';
import type {
    DapScope,
    DapVariable
} from './types';

export type DapVariablesRequest = {
    sequence: number;
    variablesReference: number;
};

export type DapVariablesResponse = {
    requestSequence: number;
    variables: DapVariable[];
};

export type TrackedTimestampCandidate = {
    path: string;
    name: string;
    value: string;
};

type TrackedVariablesRequest = {
    variablesReference: number;
    scanRevision: number;
};

export class DebugTrackerState {
    private readonly paths =
        new Map<number, string>();

    private readonly variableRequests =
        new Map<number, TrackedVariablesRequest>();

    clear(): void {
        this.paths.clear();
        this.variableRequests.clear();
    }

    recordVariablesRequest(
        request: DapVariablesRequest,
        scanRevision: number
    ): void {
        this.variableRequests.set(
            request.sequence,
            {
                variablesReference:
                    request.variablesReference,
                scanRevision
            }
        );
    }

    captureScopes(
        scopes: DapScope[],
        scanExpensiveScopes = true
    ): void {
        for (const scope of scopes) {
            if (
                scope.variablesReference > 0 &&
                (
                    scanExpensiveScopes ||
                    scope.expensive !== true
                )
            ) {
                this.paths.set(
                    scope.variablesReference,
                    ''
                );
            }
        }
    }

    consumeVariablesResponse(
        response: DapVariablesResponse,
        scanRevision: number
    ): TrackedTimestampCandidate[] {
        const request = this.variableRequests.get(
            response.requestSequence
        );

        if (!request) {
            return [];
        }

        this.variableRequests.delete(
            response.requestSequence
        );

        if (request.scanRevision !== scanRevision) {
            return [];
        }

        const parentPath = this.paths.get(
            request.variablesReference
        );

        if (parentPath === undefined) {
            return [];
        }

        return response.variables.map(variable => {
            const path = joinVariablePath(
                parentPath,
                variable.name
            );

            if (variable.variablesReference > 0) {
                this.paths.set(
                    variable.variablesReference,
                    path
                );
            }

            return {
                path,
                name: variable.name,
                value: variable.value
            };
        });
    }
}

export function getStoppedThreadId(
    message: unknown
): number | undefined {
    if (
        !isMessage(message, 'event', 'stopped') ||
        !isRecord(message.body)
    ) {
        return undefined;
    }

    return readNumber(message.body.threadId);
}

export function isStoppedEvent(
    message: unknown
): boolean {
    return isMessage(message, 'event', 'stopped');
}

export function isContinuedEvent(
    message: unknown
): boolean {
    return isMessage(message, 'event', 'continued');
}

export function getScopesResponse(
    message: unknown
): DapScope[] | undefined {
    if (!isMessage(message, 'response', 'scopes')) {
        return undefined;
    }

    const scopes = isRecord(message.body) &&
        Array.isArray(message.body.scopes)
        ? message.body.scopes
        : [];

    return scopes.flatMap(scope => {
        if (!isRecord(scope)) {
            return [];
        }

        const name = scope.name;
        const variablesReference = readNumber(
            scope.variablesReference
        );

        if (
            typeof name !== 'string' ||
            variablesReference === undefined
        ) {
            return [];
        }

        const expensive = typeof scope.expensive === 'boolean'
            ? scope.expensive
            : undefined;

        return [{
            name,
            variablesReference,
            ...(expensive === undefined
                ? {}
                : { expensive })
        }];
    });
}

export function getVariablesRequest(
    message: unknown
): DapVariablesRequest | undefined {
    if (
        !isMessage(message, 'request', 'variables') ||
        !isRecord(message.arguments)
    ) {
        return undefined;
    }

    const sequence = readNumber(message.seq);
    const variablesReference = readNumber(
        message.arguments.variablesReference
    );

    if (
        sequence === undefined ||
        variablesReference === undefined
    ) {
        return undefined;
    }

    return { sequence, variablesReference };
}

export function getVariablesResponse(
    message: unknown
): DapVariablesResponse | undefined {
    if (!isMessage(message, 'response', 'variables')) {
        return undefined;
    }

    const requestSequence = readNumber(
        message.request_seq
    );

    if (requestSequence === undefined) {
        return undefined;
    }

    const variables = isRecord(message.body) &&
        Array.isArray(message.body.variables)
        ? message.body.variables
        : [];

    return {
        requestSequence,
        variables: variables.flatMap(readVariable)
    };
}

function readVariable(value: unknown): DapVariable[] {
    if (!isRecord(value)) {
        return [];
    }

    const variablesReference = readNumber(
        value.variablesReference
    );

    if (
        typeof value.name !== 'string' ||
        typeof value.value !== 'string' ||
        variablesReference === undefined
    ) {
        return [];
    }

    return [{
        name: value.name,
        value: value.value,
        type: typeof value.type === 'string'
            ? value.type
            : undefined,
        variablesReference
    }];
}

function isMessage(
    value: unknown,
    type: string,
    name: string
): value is Record<string, unknown> {
    if (!isRecord(value) || value.type !== type) {
        return false;
    }

    return type === 'event'
        ? value.event === name
        : value.command === name;
}

function isRecord(
    value: unknown
): value is Record<string, unknown> {
    return typeof value === 'object' &&
        value !== null;
}

function readNumber(value: unknown): number | undefined {
    return typeof value === 'number' &&
        Number.isFinite(value)
        ? value
        : undefined;
}
