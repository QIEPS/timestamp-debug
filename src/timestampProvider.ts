import * as vscode from 'vscode';
import { convertTimestamp } from './timestamp';
import { TimestampItem } from './types';

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

    add(path: string, value: string): void {
        const converted = convertTimestamp(value);

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
                    'Timestamp переменные не найдены'
                )
            ];
        }

        return [...this.items.values()].map(item => {
            const treeItem =
                new vscode.TreeItem(item.path);

            treeItem.description =
                `${item.raw} → ${item.date}`;

            treeItem.tooltip =
                `${item.path}\n` +
                `${item.raw} → ${item.date}`;

            return treeItem;
        });
    }
}
