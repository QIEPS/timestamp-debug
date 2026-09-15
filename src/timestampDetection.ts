import type {
    TimestampDetectionMode
} from './types';
import type {
    TimestampFieldMatcher
} from './timestampFieldMatcher';
import {
    parseUnixTimestamp,
    ParsedUnixTimestamp
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
): ParsedUnixTimestamp | undefined {
    if (
        mode === 'safe' &&
        !matchesTimestampField(name)
    ) {
        return undefined;
    }

    return parseUnixTimestamp(value);
}
