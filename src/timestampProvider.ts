import * as vscode from 'vscode';
import { TimestampConverter } from './timestamp';
import type { TimestampItem } from './types';

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
    implements vscode.TreeDataProvider<vscode.TreeItem>,
    vscode.Disposable {

    private readonly emitter =
        new vscode.EventEmitter<void>();

    readonly onDidChangeTreeData =
        this.emitter.event;

    private readonly items =
        new Map<string, TimestampItem>();

    constructor(
        private converter: TimestampConverter
    ) {}

    setConverter(converter: TimestampConverter): void {
        this.converter = converter;
    }

    clear(): void {
        this.items.clear();
        this.emitter.fire();
    }

    add(
        path: string,
        name: string,
        value: string
    ): void {
        const converted = this.converter.convert(
            name,
            value
        );

        if (!converted) {
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

        this.emitter.fire();
    }

    dispose(): void {
        this.items.clear();
        this.emitter.dispose();
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
