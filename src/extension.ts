import * as vscode from 'vscode';
import { DebugController } from './debugController';
import { TimestampProvider } from './timestampProvider';

let debugController:
    DebugController | undefined;

export function activate(
    context: vscode.ExtensionContext
): void {
    const provider =
        new TimestampProvider();

    context.subscriptions.push(
        vscode.window.registerTreeDataProvider(
            'timestampDebug.variables',
            provider
        )
    );

    debugController =
        new DebugController(provider);

    debugController.register(context);
}

export function deactivate(): void {
    debugController?.dispose();
    debugController = undefined;
}
