export type ParsedUnixTimestamp = {
    raw: string;
    date: Date;
};

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

    if (year < 2000 || year > 2100) {
        return undefined;
    }

    return {
        raw,
        date
    };
}
