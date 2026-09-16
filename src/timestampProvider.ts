import * as vscode from 'vscode';
import type {
    DapScanLimit,
    DapScanResult
} from './dapTraversal';
import type { ScanLimits } from './scanLimits';
import { TimestampConverter } from './timestamp';
import {
    buildTimestampTree,
    formatTimestampDescription
} from './timestampTree';
import type {
    TimestampTreeNode
} from './timestampTree';
import type {
    TimestampDisplayMode,
    TimestampItem
} from './types';

export class TimestampTreeItem extends vscode.TreeItem {
    constructor(
        readonly node: TimestampTreeNode,
        displayMode: TimestampDisplayMode
    ) {
        super(
            node.label,
            node.children.length > 0
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None
        );

        this.id = node.path;
        this.iconPath = createTreeItemIcon(node);

        if (!node.timestamp) {
            this.tooltip = node.path;
            this.contextValue =
                'timestampDebug.timestampGroup';
            return;
        }

        this.description =
            formatTimestampDescription(
                node.timestamp,
                displayMode
            );

        this.tooltip = createTimestampTooltip(
            node.timestamp
        );

        this.contextValue = node.children.length === 0
            ? 'timestampDebug.timestampItem'
            : 'timestampDebug.timestampGroup';
    }

    get timestamp(): TimestampItem | undefined {
        return this.node.timestamp;
    }
}

function createTreeItemIcon(
    node: TimestampTreeNode
): vscode.ThemeIcon {
    if (node.timestamp && node.children.length === 0) {
        const isUnix = /^-?\d+$/.test(
            node.timestamp.raw.trim()
        );

        return new vscode.ThemeIcon(
            isUnix ? 'clock' : 'calendar',
            new vscode.ThemeColor(
                isUnix ? 'charts.green' : 'charts.blue'
            )
        );
    }

    if (node.label.startsWith('[')) {
        return new vscode.ThemeIcon(
            'symbol-array',
            new vscode.ThemeColor(
                'symbolIcon.arrayForeground'
            )
        );
    }

    if (node.path === node.label) {
        return new vscode.ThemeIcon(
            'symbol-namespace',
            new vscode.ThemeColor(
                'symbolIcon.namespaceForeground'
            )
        );
    }

    return new vscode.ThemeIcon(
        'symbol-object',
        new vscode.ThemeColor(
            'symbolIcon.objectForeground'
        )
    );
}

function createTimestampTooltip(
    item: TimestampItem
): vscode.MarkdownString {
    const tooltip = new vscode.MarkdownString(
        undefined,
        true
    );

    tooltip.appendMarkdown('$(symbol-field) **Path:** ');
    tooltip.appendText(item.path);
    tooltip.appendMarkdown('  \n$(watch) **Raw:** ');
    tooltip.appendText(item.raw);
    tooltip.appendMarkdown('  \n$(calendar) **Date:** ');
    tooltip.appendText(item.date);

    return tooltip;
}

type TimestampProviderStatus =
    | 'idle'
    | 'scanning'
    | 'complete'
    | 'failed';

const TREE_REFRESH_DELAY_MS = 50;

const SCAN_LIMIT_LABELS: Record<DapScanLimit, string> = {
    maxScanDepth: 'Nested levels',
    maxVariablesPerLevel: 'Variables per group',
    maxTotalVariables: 'Total variables scanned'
};

type SourceVariable = {
    name: string;
    value: string;
};

export class TimestampProvider
    implements vscode.TreeDataProvider<vscode.TreeItem>,
    vscode.Disposable {

    private readonly emitter =
        new vscode.EventEmitter<void>();

    readonly onDidChangeTreeData =
        this.emitter.event;

    private readonly items =
        new Map<string, TimestampItem>();

    private readonly sourceVariables =
        new Map<string, SourceVariable>();

    private roots: TimestampTreeNode[] = [];

    private treeDirty = false;

    private refreshTimer:
        ReturnType<typeof setTimeout> | undefined;

    private status: TimestampProviderStatus = 'idle';

    private limitsReached: DapScanLimit[] = [];

    private scanLimits: ScanLimits | undefined;

    constructor(
        private converter: TimestampConverter,
        private displayMode: TimestampDisplayMode
    ) {}

    setConverter(converter: TimestampConverter): void {
        this.converter = converter;
    }

    setDisplayMode(displayMode: TimestampDisplayMode): void {
        if (this.displayMode === displayMode) {
            return;
        }

        this.displayMode = displayMode;
        this.emitter.fire();
    }

    beginScan(): void {
        this.cancelScheduledRefresh();
        this.status = 'scanning';
        this.limitsReached = [];
        this.resetItems();
        this.emitter.fire();
    }

    completeScan(
        result: DapScanResult,
        scanLimits: ScanLimits
    ): void {
        this.cancelScheduledRefresh();
        this.rebuildTree();
        this.status = result.failed
            ? 'failed'
            : 'complete';
        this.limitsReached = result.limitsReached;
        this.scanLimits = scanLimits;
        this.emitter.fire();
    }

    setIdle(): void {
        this.cancelScheduledRefresh();
        this.status = 'idle';
        this.limitsReached = [];
        this.scanLimits = undefined;
        this.resetItems();
        this.emitter.fire();
    }

    private resetItems(): void {
        this.items.clear();
        this.sourceVariables.clear();
        this.roots = [];
        this.treeDirty = false;
    }

    add(
        path: string,
        name: string,
        value: string
    ): void {
        const currentSource = this.sourceVariables.get(path);

        if (
            currentSource?.name === name &&
            currentSource.value === value
        ) {
            return;
        }

        this.sourceVariables.set(path, { name, value });

        const converted = this.converter.convert(
            name,
            value
        );

        if (!converted) {
            if (this.items.delete(path)) {
                this.treeDirty = true;
                this.scheduleRefresh();
            }

            return;
        }

        const item = {
            path,
            raw: converted.raw,
            date: converted.date
        };

        const current = this.items.get(path);

        if (
            current?.raw === item.raw &&
            current.date === item.date
        ) {
            return;
        }

        this.items.set(path, item);
        this.treeDirty = true;
        this.scheduleRefresh();
    }

    private scheduleRefresh(): void {
        if (this.refreshTimer) {
            return;
        }

        this.refreshTimer = setTimeout(() => {
            this.refreshTimer = undefined;
            this.rebuildTree();
            this.emitter.fire();
        }, TREE_REFRESH_DELAY_MS);
    }

    private rebuildTree(): void {
        if (!this.treeDirty) {
            return;
        }

        this.roots = buildTimestampTree(
            this.items.values()
        );
        this.treeDirty = false;
    }

    private cancelScheduledRefresh(): void {
        if (!this.refreshTimer) {
            return;
        }

        clearTimeout(this.refreshTimer);
        this.refreshTimer = undefined;
    }

    dispose(): void {
        this.cancelScheduledRefresh();
        this.resetItems();
        this.emitter.dispose();
    }

    getTreeItem(
        element: vscode.TreeItem
    ): vscode.TreeItem {
        return element;
    }

    getChildren(
        element?: vscode.TreeItem
    ): vscode.TreeItem[] {
        if (element instanceof TimestampTreeItem) {
            return element.node.children.map(
                node => new TimestampTreeItem(
                    node,
                    this.displayMode
                )
            );
        }

        return [
            this.createStatusItem(),
            ...this.roots.map(
                node => new TimestampTreeItem(
                    node,
                    this.displayMode
                )
            )
        ];
    }

    private createStatusItem(): vscode.TreeItem {
        switch (this.status) {
            case 'idle':
                return createStatusItem(
                    'Pause the debugger to scan timestamps',
                    'debug-pause',
                    'descriptionForeground'
                );
            case 'scanning':
                return createStatusItem(
                    'Scanning debugger variables…',
                    'sync~spin',
                    'charts.blue'
                );
            case 'failed':
                return createStatusItem(
                    'Timestamp scan failed',
                    'error',
                    'notificationsErrorIcon.foreground',
                    undefined,
                    'See the Extension Host log for details.'
                );
        }

        const count = this.items.size;
        const countLabel = `${count} ` +
            (count === 1 ? 'timestamp' : 'timestamps');

        if (this.limitsReached.length > 0) {
            return createStatusItem(
                'Partial scan',
                'info',
                'descriptionForeground',
                countLabel,
                this.createPartialScanTooltip(count)
            );
        }

        if (count === 0) {
            return createStatusItem(
                'Timestamp variables not found',
                'info',
                'descriptionForeground'
            );
        }

        return createStatusItem(
            'Scan complete',
            'pass',
            'testing.iconPassed',
            countLabel
        );
    }

    private createPartialScanTooltip(count: number): string {
        const multipleLimits = this.limitsReached.length > 1;
        const limitLines = this.limitsReached.map(limit => {
            const value = this.scanLimits?.[limit];
            const formattedValue = value === undefined
                ? ''
                : `: ${value.toLocaleString('en-US')}`;

            return `• ${SCAN_LIMIT_LABELS[limit]}` +
                formattedValue;
        });
        const resultMessage = count === 1
            ? 'The timestamp shown is valid.'
            : count > 1
                ? 'The timestamps shown are valid.'
                : 'No timestamps were found within the scanned variables.';

        return [
            'Some variables were skipped after the scan reached ' +
                `${multipleLimits ? 'its safety limits' : 'a safety limit'}. ` +
                'This prevents large debugger objects from slowing down VS Code.',
            '',
            resultMessage,
            '',
            `${multipleLimits ? 'Limits' : 'Limit'} reached:`,
            ...limitLines,
            '',
            `Increase ${multipleLimits ? 'these limits' : 'this limit'} ` +
                'in Timestamp Debug settings only if you need a broader scan. ' +
                'Higher values may slow down debugging.'
        ].join('\n');
    }
}

function createStatusItem(
    label: string,
    icon: string,
    color: string,
    description?: string,
    tooltip?: string
): vscode.TreeItem {
    const item = new vscode.TreeItem(label);

    item.description = description;
    item.tooltip = tooltip ?? label;
    item.iconPath = new vscode.ThemeIcon(
        icon,
        new vscode.ThemeColor(color)
    );

    return item;
}
