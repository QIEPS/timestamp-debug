export type ScanLimits = {
    maxScanDepth: number;
    maxVariablesPerLevel: number;
    maxTotalVariables: number;
};

export type ScanLimitConfiguration = {
    maxScanDepth?: unknown;
    maxVariablesPerLevel?: unknown;
    maxTotalVariables?: unknown;
};

export const DEFAULT_SCAN_LIMITS: Readonly<ScanLimits> = {
    maxScanDepth: 4,
    maxVariablesPerLevel: 100,
    maxTotalVariables: 1000
};

export function resolveScanLimits(
    configuration: ScanLimitConfiguration
): ScanLimits {
    return {
        maxScanDepth: resolvePositiveInteger(
            configuration.maxScanDepth,
            DEFAULT_SCAN_LIMITS.maxScanDepth
        ),
        maxVariablesPerLevel: resolvePositiveInteger(
            configuration.maxVariablesPerLevel,
            DEFAULT_SCAN_LIMITS.maxVariablesPerLevel
        ),
        maxTotalVariables: resolvePositiveInteger(
            configuration.maxTotalVariables,
            DEFAULT_SCAN_LIMITS.maxTotalVariables
        )
    };
}

export class ScanBudget {
    private processedVariables = 0;

    constructor(
        readonly limits: Readonly<ScanLimits>
    ) {}

    canScanDepth(depth: number): boolean {
        return depth >= 0 &&
            depth <= this.limits.maxScanDepth;
    }

    canDescendFrom(depth: number): boolean {
        return this.canScanDepth(depth + 1);
    }

    hasRemainingVariables(): boolean {
        return this.processedVariables <
            this.limits.maxTotalVariables;
    }

    tryProcessVariable(): boolean {
        if (!this.hasRemainingVariables()) {
            return false;
        }

        this.processedVariables += 1;
        return true;
    }

    limitVariablesAtLevel<T>(
        variables: readonly T[]
    ): readonly T[] {
        return variables.slice(
            0,
            this.limits.maxVariablesPerLevel
        );
    }

    get totalProcessedVariables(): number {
        return this.processedVariables;
    }
}

function resolvePositiveInteger(
    value: unknown,
    fallback: number
): number {
    if (
        typeof value !== 'number' ||
        !Number.isSafeInteger(value) ||
        value < 1
    ) {
        return fallback;
    }

    return value;
}
