import * as vscode from 'vscode';
import { convertTimestamp } from './timestamp';
import { TimestampItem } from './types';

export class TimestampTreeItem extends vscode.TreeItem {
    constructor(
        readonly timestamp: TimestampItem
    ) {
        super(timestamp.path);

        this.description =
            `${timestamp.raw} → ${timestamp.date}`;

        this.tooltip =
            `${timestamp.path}\n` +
            `${timestamp.raw} → ${timestamp.date}`;

        this.contextValue =
            'timestampDebug.timestampItem';
    }
}

export class TimestampProvider
    implements vscode.TreeDataProvider<vscode.TreeItem> {

    private readonly emitter =
        new vscode.EventEmitter<void>();

    readonly onDidChangeTreeData =
        this.emitter.event;

    private readonly items =
        new Map<string, TimestampItem>();

    clear(): void {
        this.items.clear();
        this.emitter.fire();
    }

    add(
        path: string,
        name: string,
        value: string
    ): void {
        const converted = convertTimestamp(
            name,
            value
        );

        if (!converted) {
            return;
        }

        this.items.set(path, {
            path,
            raw: converted.raw,
            date: converted.date
        });

        this.emitter.fire();
    }

    getTreeItem(
        element: vscode.TreeItem
    ): vscode.TreeItem {
        return element;
    }

    getChildren(): vscode.TreeItem[] {
        if (this.items.size === 0) {
            return [
                new vscode.TreeItem(
                    'Timestamp variables not found'
                )
            ];
        }

        return [...this.items.values()].map(
            item => new TimestampTreeItem(item)
        );
    }
}
