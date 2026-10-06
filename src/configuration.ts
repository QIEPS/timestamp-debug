import {
    resolveScanLimits
} from './scanLimits';
import type { ScanLimits } from './scanLimits';
import {
    resolveDetectionMode
} from './timestampDetection';
import {
    DEFAULT_FIXED_OFFSET,
    parseFixedOffset
} from './timestampFormatter';
import type {
    TimestampDateFormat,
    TimestampDetectionMode,
    TimestampDisplayMode,
    TimestampTimezone
} from './types';

export type RawTimestampDebugConfiguration = {
    timezone?: unknown;
    fixedOffset?: unknown;
    dateFormat?: unknown;
    displayMode?: unknown;
    detectionMode?: unknown;
    customFields?: unknown;
    fieldPatterns?: unknown;
    scanExpensiveScopes?: unknown;
    maxScanDepth?: unknown;
    maxVariablesPerLevel?: unknown;
    maxTotalVariables?: unknown;
};

export type TimestampDebugConfiguration = {
    timezone: TimestampTimezone;
    fixedOffset: string;
    dateFormat: TimestampDateFormat;
    displayMode: TimestampDisplayMode;
    detectionMode: TimestampDetectionMode;
    customFields: string[];
    fieldPatterns: string[];
    scanExpensiveScopes: boolean;
    scanLimits: ScanLimits;
};

export function resolveTimestampDebugConfiguration(
    raw: RawTimestampDebugConfiguration
): TimestampDebugConfiguration {
    return {
        timezone: resolveTimezone(raw.timezone),
        fixedOffset: parseFixedOffset(raw.fixedOffset)?.label ??
            DEFAULT_FIXED_OFFSET,
        dateFormat: raw.dateFormat === 'european' ? 'european' : 'iso',
        displayMode: raw.displayMode === 'date' ? 'date' : 'timestampAndDate',
        detectionMode: resolveDetectionMode(
            raw.detectionMode
        ),
        customFields: resolveStringArray(
            raw.customFields
        ),
        fieldPatterns: resolveStringArray(
            raw.fieldPatterns
        ),
        scanExpensiveScopes: typeof raw.scanExpensiveScopes === 'boolean'
            ? raw.scanExpensiveScopes
            : true,
        scanLimits: resolveScanLimits(raw)
    };
}

function resolveTimezone(
    value: unknown
): TimestampTimezone {
    if (value === 'local' || value === 'fixed') {
        return value;
    }

    return 'utc';
}

function resolveStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter(
        (item): item is string =>
            typeof item === 'string'
    );
}
