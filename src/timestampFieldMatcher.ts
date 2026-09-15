export type TimestampFieldMatcher = (
    name: string
) => boolean;

const BUILT_IN_EXACT_NAMES = new Set([
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
]);

const BUILT_IN_SUFFIXES = [
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

export function createTimestampFieldMatcher(
    customFields: readonly string[] = [],
    fieldPatterns: readonly string[] = []
): TimestampFieldMatcher {
    const customFieldNames = new Set(customFields);
    const regularExpressions = compilePatterns(
        fieldPatterns
    );

    return (name: string): boolean => {
        if (isBuiltInTimestampName(name)) {
            return true;
        }

        if (customFieldNames.has(name)) {
            return true;
        }

        return regularExpressions.some(pattern =>
            pattern.test(name)
        );
    };
}

export function isBuiltInTimestampName(
    name: string
): boolean {
    const normalized = name
        .replace(/[_-]/g, '')
        .toLowerCase();

    if (BUILT_IN_EXACT_NAMES.has(normalized)) {
        return true;
    }

    return BUILT_IN_SUFFIXES.some(
        suffix => normalized.endsWith(suffix)
    );
}

function compilePatterns(
    fieldPatterns: readonly string[]
): RegExp[] {
    const regularExpressions: RegExp[] = [];

    for (const pattern of fieldPatterns) {
        try {
            regularExpressions.push(
                new RegExp(pattern)
            );
        } catch {
            // Invalid user patterns are ignored.
        }
    }

    return regularExpressions;
}
