import type {
    TimestampDateFormat,
    TimestampTimezone
} from './types';

export const DEFAULT_FIXED_OFFSET = 'UTC+00:00';

export type FixedOffset = {
    label: string;
    minutes: number;
};

export type TimestampFormatOptions = {
    timezone: TimestampTimezone;
    dateFormat: TimestampDateFormat;
    fixedOffset?: unknown;
};

export function parseFixedOffset(
    value: unknown
): FixedOffset | undefined {
    if (typeof value !== 'string') {
        return undefined;
    }

    const match = /^UTC([+-])(\d{2}):(\d{2})$/
        .exec(value);

    if (!match) {
        return undefined;
    }

    const hours = Number(match[2]);
    const minutes = Number(match[3]);

    if (
        minutes > 59 ||
        hours > 14 ||
        (hours === 14 && minutes !== 0)
    ) {
        return undefined;
    }

    const direction = match[1] === '+' ? 1 : -1;

    return {
        label: value,
        minutes: direction * (hours * 60 + minutes)
    };
}

export function formatTimestampDate(
    date: Date,
    options: TimestampFormatOptions
): string {
    const fixedOffset = resolveFixedOffset(
        options.fixedOffset
    );

    const isLocal = options.timezone === 'local';
    const isFixed = options.timezone === 'fixed';

    const displayedDate = isFixed
        ? new Date(
            date.getTime() +
            fixedOffset.minutes * 60_000
        )
        : date;

    const year = isLocal
        ? displayedDate.getFullYear()
        : displayedDate.getUTCFullYear();

    const month = (isLocal
        ? displayedDate.getMonth()
        : displayedDate.getUTCMonth()) + 1;

    const day = isLocal
        ? displayedDate.getDate()
        : displayedDate.getUTCDate();

    const hours = isLocal
        ? displayedDate.getHours()
        : displayedDate.getUTCHours();

    const minutes = isLocal
        ? displayedDate.getMinutes()
        : displayedDate.getUTCMinutes();

    const seconds = isLocal
        ? displayedDate.getSeconds()
        : displayedDate.getUTCSeconds();

    const milliseconds = isLocal
        ? displayedDate.getMilliseconds()
        : displayedDate.getUTCMilliseconds();

    const time =
        `${pad(hours)}:` +
        `${pad(minutes)}:` +
        `${pad(seconds)}.` +
        `${pad(milliseconds, 3)}`;

    const timezoneLabel = isLocal
        ? 'Local'
        : isFixed
            ? fixedOffset.label
            : 'UTC';

    if (options.dateFormat === 'european') {
        return (
            `${pad(day)}.` +
            `${pad(month)}.` +
            `${year} ` +
            `${time} ` +
            timezoneLabel
        );
    }

    return (
        `${year}-` +
        `${pad(month)}-` +
        `${pad(day)} ` +
        `${time} ` +
        timezoneLabel
    );
}

function resolveFixedOffset(value: unknown): FixedOffset {
    return parseFixedOffset(value) ?? {
        label: DEFAULT_FIXED_OFFSET,
        minutes: 0
    };
}

function pad(value: number, size = 2): string {
    return value.toString().padStart(size, '0');
}
