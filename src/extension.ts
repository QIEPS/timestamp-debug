import * as vscode from 'vscode';
import { DebugController } from './debugController';
import { TimestampProvider } from './timestampProvider';
import { registerCopyCommands } from './copyCommands';
import { TimestampConverter } from './timestamp';
import {
    readTimestampDebugConfiguration
} from './workspaceConfiguration';

export function activate(
    context: vscode.ExtensionContext
): void {
    const configuration =
        readTimestampDebugConfiguration();

    const provider = new TimestampProvider(
        new TimestampConverter(configuration)
    );

    context.subscriptions.push(
        vscode.window.registerTreeDataProvider(
            'timestampDebug.variables',
            provider
        ),
        provider
    );

    registerCopyCommands(context);

    const debugController = new DebugController(
        provider,
        configuration
    );

    debugController.register(context);
    context.subscriptions.push(debugController);
}

export function deactivate(): void {}
