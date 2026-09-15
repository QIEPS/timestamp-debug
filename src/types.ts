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

export type DapScope = {
    name: string;
    variablesReference: number;
};

export type TimestampTimezone =
    | 'utc'
    | 'local'
    | 'fixed';

export type TimestampDateFormat = 'iso' | 'european';

export type TimestampDetectionMode =
    | 'safe'
    | 'aggressive';
