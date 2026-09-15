export type TimestampItem = {
    path: string;
    raw: string;
    date: string;
};

export type DapVariable = {
    name: string;
    value: string;
    type?: string;
    variablesReference: number;
};

export type TimestampTimezone = 'utc' | 'local';

export type TimestampDateFormat = 'iso' | 'european';
