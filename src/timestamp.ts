import * as vscode from 'vscode';
import {
    TimestampDateFormat,
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

let configuredFieldMatcher:
    TimestampFieldMatcher | undefined;

export function isTimestampName(name: string): boolean {
    return getConfiguredFieldMatcher()(name);
}

export function resetTimestampFieldMatcher(): void {
    configuredFieldMatcher = undefined;
}

export function convertTimestamp(
    value: string
): { raw: string; date: string } | undefined {
    const match = value.match(/-?\d{10,19}/);

    if (!match) {
        return undefined;
    }

    const raw = match[0];

    try {
        const number = BigInt(raw);
        const digits = raw.replace('-', '').length;

        let milliseconds: number;

        switch (digits) {
            case 10:
                milliseconds = Number(number * 1000n);
                break;
            case 13:
                milliseconds = Number(number);
                break;
            case 16:
                milliseconds = Number(number / 1000n);
                break;
            case 19:
                milliseconds = Number(number / 1_000_000n);
                break;
            default:
                return undefined;
        }

        const date = new Date(milliseconds);

        if (Number.isNaN(date.getTime())) {
            return undefined;
        }

        const year = date.getUTCFullYear();

        if (year < 2000 || year > 2100) {
            return undefined;
        }

        return {
            raw,
            date: formatDate(date)
        };
    } catch {
        return undefined;
    }
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

function readStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter(
        (item): item is string =>
            typeof item === 'string'
    );
}
