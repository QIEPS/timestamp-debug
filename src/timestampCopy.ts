import type { TimestampItem } from './types';

export type TimestampCopyTarget =
    | 'timestamp'
    | 'formattedDate'
    | 'variablePath';

export function getTimestampCopyValue(
    item: TimestampItem,
    target: TimestampCopyTarget
): string {
    switch (target) {
        case 'timestamp':
            return item.raw;
        case 'formattedDate':
            return item.date;
        case 'variablePath':
            return item.path;
    }
}
