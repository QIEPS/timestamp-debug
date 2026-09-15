import type {
    TimestampDebugConfiguration
} from './configuration';
import {
    detectTimestampValue
} from './timestampDetection';
import {
    createTimestampFieldMatcher
} from './timestampFieldMatcher';
import type {
    TimestampFieldMatcher
} from './timestampFieldMatcher';
import {
    formatTimestampDate
} from './timestampFormatter';

export type ConvertedTimestamp = {
    raw: string;
    date: string;
};

export class TimestampConverter {
    private readonly matchesTimestampField:
        TimestampFieldMatcher;

    constructor(
        private readonly configuration:
        TimestampDebugConfiguration
    ) {
        this.matchesTimestampField =
            createTimestampFieldMatcher(
                configuration.customFields,
                configuration.fieldPatterns
            );
    }

    isTimestampName(name: string): boolean {
        return this.matchesTimestampField(name);
    }

    convert(
        name: string,
        value: string
    ): ConvertedTimestamp | undefined {
        const parsed = detectTimestampValue(
            name,
            value,
            this.configuration.detectionMode,
            this.matchesTimestampField
        );

        if (!parsed) {
            return undefined;
        }

        return {
            raw: parsed.raw,
            date: formatTimestampDate(
                parsed.date,
                {
                    timezone:
                        this.configuration.timezone,
                    dateFormat:
                        this.configuration.dateFormat,
                    fixedOffset:
                        this.configuration.fixedOffset
                }
            )
        };
    }
}
