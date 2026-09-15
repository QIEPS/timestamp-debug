import * as vscode from 'vscode';
import {
    TimestampTreeItem
} from './timestampProvider';
import {
    getTimestampCopyValue
} from './timestampCopy';
import type {
    TimestampCopyTarget
} from './timestampCopy';

const COPY_COMMANDS: ReadonlyArray<
    readonly [string, TimestampCopyTarget]
> = [
    ['timestampDebug.copyTimestamp', 'timestamp'],
    [
        'timestampDebug.copyFormattedDate',
        'formattedDate'
    ],
    [
        'timestampDebug.copyVariablePath',
        'variablePath'
    ]
];

export function registerCopyCommands(
    context: vscode.ExtensionContext
): void {
    for (const [command, target] of COPY_COMMANDS) {
        context.subscriptions.push(
            vscode.commands.registerCommand(
                command,
                async (item: unknown) => {
                    if (!(item instanceof TimestampTreeItem)) {
                        return;
                    }

                    await vscode.env.clipboard.writeText(
                        getTimestampCopyValue(
                            item.timestamp,
                            target
                        )
                    );
                }
            )
        );
    }
}
