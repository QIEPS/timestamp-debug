import * as vscode from 'vscode';
import {
    TimestampDateFormat,
    TimestampDetectionMode,
    TimestampTimezone
} from './types';
import {
    createTimestampFieldMatcher,
    TimestampFieldMatcher
} from './timestampFieldMatcher';
import {
    DEFAULT_FIXED_OFFSET,
    formatTimestampDate
} from './timestampFormatter';
import {
    detectTimestampValue,
    resolveDetectionMode
} from './timestampDetection';

let configuredFieldMatcher:
    TimestampFieldMatcher | undefined;

let configuredDetectionMode:
    TimestampDetectionMode | undefined;

export function isTimestampName(name: string): boolean {
    return getConfiguredFieldMatcher()(name);
}

export function resetTimestampDetectionConfiguration(): void {
    configuredFieldMatcher = undefined;
    configuredDetectionMode = undefined;
}

export function convertTimestamp(
    name: string,
    value: string
): { raw: string; date: string } | undefined {
    const parsed = detectTimestampValue(
        name,
        value,
        getConfiguredDetectionMode(),
        getConfiguredFieldMatcher()
    );

    if (!parsed) {
        return undefined;
    }

    return {
        raw: parsed.raw,
        date: formatDate(parsed.date)
    };
}

function formatDate(date: Date): string {
    const config = vscode.workspace
        .getConfiguration('timestampDebug');

    const timezone = config.get<TimestampTimezone>(
        'timezone',
        'utc'
    );

    const dateFormat = config.get<TimestampDateFormat>(
        'dateFormat',
        'iso'
    );

    const fixedOffset = config.get<unknown>(
        'fixedOffset',
        DEFAULT_FIXED_OFFSET
    );

    return formatTimestampDate(date, {
        timezone,
        dateFormat,
        fixedOffset
    });
}

function getConfiguredFieldMatcher(): TimestampFieldMatcher {
    if (configuredFieldMatcher) {
        return configuredFieldMatcher;
    }

    const config = vscode.workspace
        .getConfiguration('timestampDebug');

    const customFields = readStringArray(
        config.get<unknown>('customFields', [])
    );

    const fieldPatterns = readStringArray(
        config.get<unknown>('fieldPatterns', [])
    );

    configuredFieldMatcher = createTimestampFieldMatcher(
        customFields,
        fieldPatterns
    );

    return configuredFieldMatcher;
}

function getConfiguredDetectionMode(): TimestampDetectionMode {
    if (configuredDetectionMode) {
        return configuredDetectionMode;
    }

    const config = vscode.workspace
        .getConfiguration('timestampDebug');

    configuredDetectionMode = resolveDetectionMode(
        config.get<unknown>('detectionMode', 'safe')
    );

    return configuredDetectionMode;
}

function readStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter(
        (item): item is string =>
            typeof item === 'string'
    );
}
