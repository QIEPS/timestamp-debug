import type {
    TimestampDisplayMode,
    TimestampItem
} from './types';

export type TimestampTreeNode = {
    label: string;
    path: string;
    timestamp?: TimestampItem;
    children: TimestampTreeNode[];
};

type MutableTimestampTreeNode = {
    label: string;
    path: string;
    timestamp?: TimestampItem;
    children: Map<string, MutableTimestampTreeNode>;
};

export function buildTimestampTree(
    items: Iterable<TimestampItem>
): TimestampTreeNode[] {
    const roots = new Map<
        string,
        MutableTimestampTreeNode
    >();

    for (const item of items) {
        const segments = splitVariablePath(item.path);
        let children = roots;
        let currentPath = '';

        for (const [index, segment] of segments.entries()) {
            currentPath = appendPathSegment(
                currentPath,
                segment
            );

            let node = children.get(segment);

            if (!node) {
                node = {
                    label: segment,
                    path: currentPath,
                    children: new Map()
                };
                children.set(segment, node);
            }

            if (index === segments.length - 1) {
                node.timestamp = item;
            }

            children = node.children;
        }
    }

    return [...roots.values()].map(finalizeNode);
}

export function splitVariablePath(path: string): string[] {
    const segments: string[] = [];
    let current = '';
    let bracketDepth = 0;
    let quote: '"' | "'" | undefined;
    let escaped = false;

    const pushCurrent = (): void => {
        if (current.length > 0) {
            segments.push(current);
            current = '';
        }
    };

    for (const character of path) {
        if (bracketDepth > 0) {
            current += character;

            if (escaped) {
                escaped = false;
                continue;
            }

            if (character === '\\' && quote) {
                escaped = true;
                continue;
            }

            if (quote) {
                if (character === quote) {
                    quote = undefined;
                }
                continue;
            }

            if (character === '"' || character === "'") {
                quote = character;
            } else if (character === '[') {
                bracketDepth += 1;
            } else if (character === ']') {
                bracketDepth -= 1;

                if (bracketDepth === 0) {
                    pushCurrent();
                }
            }

            continue;
        }

        if (character === '.') {
            pushCurrent();
        } else if (character === '[') {
            pushCurrent();
            current = character;
            bracketDepth = 1;
        } else {
            current += character;
        }
    }

    pushCurrent();
    return segments;
}

export function formatTimestampDescription(
    item: TimestampItem,
    displayMode: TimestampDisplayMode
): string {
    return displayMode === 'date'
        ? item.date
        : `${item.raw} → ${item.date}`;
}

function appendPathSegment(
    parent: string,
    segment: string
): string {
    if (!parent) {
        return segment;
    }

    return segment.startsWith('[')
        ? `${parent}${segment}`
        : `${parent}.${segment}`;
}

function finalizeNode(
    node: MutableTimestampTreeNode
): TimestampTreeNode {
    return {
        label: node.label,
        path: node.path,
        ...(node.timestamp
            ? { timestamp: node.timestamp }
            : {}),
        children: [...node.children.values()].map(
            finalizeNode
        )
    };
}
