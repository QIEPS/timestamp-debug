import * as vscode from 'vscode';
import { DebugController } from './debugController';
import { TimestampProvider } from './timestampProvider';
import { registerCopyCommands } from './copyCommands';
import { TimestampConverter } from './timestamp';
import {
    readTimestampDebugConfiguration
} from './workspaceConfiguration';

const OPEN_SETTINGS_COMMAND =
    'timestampDebug.openSettings';

export function activate(
    context: vscode.ExtensionContext
): void {
    const configuration =
        readTimestampDebugConfiguration();

    const provider = new TimestampProvider(
        new TimestampConverter(configuration),
        configuration.displayMode
    );

    context.subscriptions.push(
        vscode.window.registerTreeDataProvider(
            'timestampDebug.variables',
            provider
        ),
        provider
    );

    registerCopyCommands(context);

    context.subscriptions.push(
        vscode.commands.registerCommand(
            OPEN_SETTINGS_COMMAND,
            () => vscode.commands.executeCommand(
                'workbench.action.openSettings',
                '@ext:qieps.timestamp-debug'
            )
        )
    );

    const debugController = new DebugController(
        provider,
        configuration
    );

    debugController.register(context);
    context.subscriptions.push(debugController);
}

export function deactivate(): void {}
