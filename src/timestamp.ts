import * as vscode from 'vscode';
import {
    TimestampDateFormat,
    TimestampTimezone
} from './types';

export function isTimestampName(name: string): boolean {
    const normalized = name
        .replace(/[_-]/g, '')
        .toLowerCase();

    const exactNames = [
        'start',
        'end',
        'laststart',
        'starttime',
        'endtime',
        'createdat',
        'updatedat',
        'deletedat',
        'activateat',
        'expiresat',
        'expiredat',
        'timestamp',
        'datetime'
    ];

    if (exactNames.includes(normalized)) {
        return true;
    }

    const suffixes = [
        'timestamp',
        'datetime',
        'createdat',
        'updatedat',
        'deletedat',
        'starttime',
        'endtime',
        'activateat',
        'expiresat'
    ];

    return suffixes.some(
        suffix => normalized.endsWith(suffix)
    );
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

    const pad = (value: number, size = 2): string =>
        value.toString().padStart(size, '0');

    let year: number;
    let month: number;
    let day: number;
    let hours: number;
    let minutes: number;
    let seconds: number;
    let milliseconds: number;

    if (timezone === 'local') {
        year = date.getFullYear();
        month = date.getMonth() + 1;
        day = date.getDate();
        hours = date.getHours();
        minutes = date.getMinutes();
        seconds = date.getSeconds();
        milliseconds = date.getMilliseconds();
    } else {
        year = date.getUTCFullYear();
        month = date.getUTCMonth() + 1;
        day = date.getUTCDate();
        hours = date.getUTCHours();
        minutes = date.getUTCMinutes();
        seconds = date.getUTCSeconds();
        milliseconds = date.getUTCMilliseconds();
    }

    const time =
        `${pad(hours)}:` +
        `${pad(minutes)}:` +
        `${pad(seconds)}.` +
        `${pad(milliseconds, 3)}`;

    const timezoneLabel =
        timezone === 'utc'
            ? 'UTC'
            : 'Local';

    if (dateFormat === 'european') {
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
