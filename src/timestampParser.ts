export type ParsedTimestamp = {
    raw: string;
    date: Date;
};

export type ParsedUnixTimestamp = ParsedTimestamp;

const ISO_TIMESTAMP_PATTERN =
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?(Z|[+-]\d{2}:\d{2})$/;

const MIN_TIMESTAMP_YEAR = 2000;
const MAX_TIMESTAMP_YEAR = 2100;

export function parseTimestamp(
    value: string
): ParsedTimestamp | undefined {
    return parseUnixTimestamp(value) ??
        parseIsoTimestamp(value);
}

export function parseUnixTimestamp(
    value: string
): ParsedUnixTimestamp | undefined {
    const raw = value.trim();

    if (!/^-?\d+$/.test(raw)) {
        return undefined;
    }

    const digits = raw.startsWith('-')
        ? raw.length - 1
        : raw.length;

    let milliseconds: number;

    try {
        const number = BigInt(raw);

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
    } catch {
        return undefined;
    }

    const date = new Date(milliseconds);

    if (Number.isNaN(date.getTime())) {
        return undefined;
    }

    const year = date.getUTCFullYear();

    if (!isSupportedYear(year)) {
        return undefined;
    }

    return {
        raw,
        date
    };
}

export function parseIsoTimestamp(
    value: string
): ParsedTimestamp | undefined {
    const raw = value.trim();
    const candidate = unwrapQuotedValue(raw);
    const match = ISO_TIMESTAMP_PATTERN.exec(candidate);

    if (!match) {
        return undefined;
    }

    const [
        ,
        yearText,
        monthText,
        dayText,
        hourText,
        minuteText,
        secondText,
        millisecondText,
        timezoneText
    ] = match;

    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const hour = Number(hourText);
    const minute = Number(minuteText);
    const second = Number(secondText);
    const millisecond = Number(millisecondText ?? '0');
    const offsetMinutes = parseIsoOffset(timezoneText);

    if (
        !isSupportedYear(year) ||
        month < 1 ||
        month > 12 ||
        day < 1 ||
        day > daysInMonth(year, month) ||
        hour > 23 ||
        minute > 59 ||
        second > 59 ||
        offsetMinutes === undefined
    ) {
        return undefined;
    }

    const milliseconds = Date.UTC(
        year,
        month - 1,
        day,
        hour,
        minute,
        second,
        millisecond
    ) - offsetMinutes * 60_000;
    const date = new Date(milliseconds);

    if (Number.isNaN(date.getTime())) {
        return undefined;
    }

    return { raw, date };
}

function unwrapQuotedValue(value: string): string {
    if (value.length < 2) {
        return value;
    }

    const first = value[0];
    const last = value[value.length - 1];

    if (
        (first === '"' && last === '"') ||
        (first === "'" && last === "'")
    ) {
        return value.slice(1, -1);
    }

    return value;
}

function parseIsoOffset(
    value: string
): number | undefined {
    if (value === 'Z') {
        return 0;
    }

    const sign = value[0] === '-' ? -1 : 1;
    const hours = Number(value.slice(1, 3));
    const minutes = Number(value.slice(4, 6));

    if (
        hours > 14 ||
        minutes > 59 ||
        (hours === 14 && minutes !== 0)
    ) {
        return undefined;
    }

    return sign * (hours * 60 + minutes);
}

function daysInMonth(year: number, month: number): number {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isSupportedYear(year: number): boolean {
    return year >= MIN_TIMESTAMP_YEAR &&
        year <= MAX_TIMESTAMP_YEAR;
}
