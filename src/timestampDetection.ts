import type {
    TimestampDetectionMode
} from './types';
import type {
    TimestampFieldMatcher
} from './timestampFieldMatcher';
import {
    parseTimestamp,
    ParsedTimestamp
} from './timestampParser';

export function resolveDetectionMode(
    value: unknown
): TimestampDetectionMode {
    return value === 'aggressive'
        ? 'aggressive'
        : 'safe';
}

export function detectTimestampValue(
    name: string,
    value: string,
    mode: TimestampDetectionMode,
    matchesTimestampField: TimestampFieldMatcher
): ParsedTimestamp | undefined {
    if (
        mode === 'safe' &&
        !matchesTimestampField(name)
    ) {
        return undefined;
    }

    return parseTimestamp(value);
}
