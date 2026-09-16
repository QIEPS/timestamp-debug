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
    scanLimits: ScanLimits;
};

export function resolveTimestampDebugConfiguration(
    raw: RawTimestampDebugConfiguration
): TimestampDebugConfiguration {
    return {
        timezone: resolveTimezone(raw.timezone),
        fixedOffset: resolveFixedOffset(raw.fixedOffset),
        dateFormat: resolveDateFormat(raw.dateFormat),
        displayMode: resolveDisplayMode(raw.displayMode),
        detectionMode: resolveDetectionMode(
            raw.detectionMode
        ),
        customFields: resolveStringArray(
            raw.customFields
        ),
        fieldPatterns: resolveStringArray(
            raw.fieldPatterns
        ),
        scanLimits: resolveScanLimits({
            maxScanDepth: raw.maxScanDepth,
            maxVariablesPerLevel:
                raw.maxVariablesPerLevel,
            maxTotalVariables:
                raw.maxTotalVariables
        })
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

function resolveFixedOffset(value: unknown): string {
    if (typeof value !== 'string') {
        return DEFAULT_FIXED_OFFSET;
    }

    return parseFixedOffset(value)?.label ??
        DEFAULT_FIXED_OFFSET;
}

function resolveDateFormat(
    value: unknown
): TimestampDateFormat {
    return value === 'european'
        ? 'european'
        : 'iso';
}

function resolveDisplayMode(
    value: unknown
): TimestampDisplayMode {
    return value === 'date'
        ? 'date'
        : 'timestampAndDate';
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
