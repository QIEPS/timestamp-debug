import * as vscode from 'vscode';
import {
    joinPath,
    scanStoppedSession
} from './debugScanner';
import { isTimestampName } from './timestamp';
import { TimestampProvider } from './timestampProvider';

export class DebugController {
    private currentSession:
        vscode.DebugSession | undefined;

    private currentThreadId:
        number | undefined;

    constructor(
        private readonly provider: TimestampProvider
    ) {}

    register(
        context: vscode.ExtensionContext
    ): void {
        context.subscriptions.push(
            vscode.commands.registerCommand(
                'timestampDebug.refresh',
                async () => {
                    await this.refresh();
                }
            )
        );

        context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration(
                event => {
                    const timezoneChanged =
                        event.affectsConfiguration(
                            'timestampDebug.timezone'
                        );

                    const dateFormatChanged =
                        event.affectsConfiguration(
                            'timestampDebug.dateFormat'
                        );

                    if (
                        !timezoneChanged &&
                        !dateFormatChanged
                    ) {
                        return;
                    }

                    void this.refresh();
                }
            )
        );

        context.subscriptions.push(
            vscode.debug.onDidTerminateDebugSession(
                session => {
                    if (
                        this.currentSession?.id !==
                        session.id
                    ) {
                        return;
                    }

                    this.currentSession = undefined;
                    this.currentThreadId = undefined;

                    this.provider.clear();
                }
            )
        );

        context.subscriptions.push(
            vscode.debug.registerDebugAdapterTrackerFactory(
                '*',
                {
                    createDebugAdapterTracker: session =>
                        this.createTracker(session)
                }
            )
        );
    }

    dispose(): void {
        this.currentSession = undefined;
        this.currentThreadId = undefined;
    }

    private async refresh(): Promise<void> {
        if (
            !this.currentSession ||
            !this.currentThreadId
        ) {
            return;
        }

        this.provider.clear();

        await scanStoppedSession(
            this.currentSession,
            this.currentThreadId,
            this.provider
        );
    }

    private createTracker(
        session: vscode.DebugSession
    ): vscode.DebugAdapterTracker {
        const paths =
            new Map<number, string>();

        const variableRequests =
            new Map<number, number>();

        return {
            onWillReceiveMessage: (message: any) => {
                if (
                    message.type === 'request' &&
                    message.command === 'variables'
                ) {
                    variableRequests.set(
                        message.seq,
                        message.arguments
                            ?.variablesReference
                    );
                }
            },

            onDidSendMessage: (message: any) => {
                if (
                    message.type === 'event' &&
                    message.event === 'stopped'
                ) {
                    this.handleStopped(
                        session,
                        message,
                        paths,
                        variableRequests
                    );

                    return;
                }

                if (
                    message.type === 'event' &&
                    message.event === 'continued'
                ) {
                    this.provider.clear();
                    this.currentThreadId =
                        undefined;

                    return;
                }

                if (
                    message.type === 'response' &&
                    message.command === 'scopes'
                ) {
                    this.captureScopes(
                        message,
                        paths
                    );

                    return;
                }

                if (
                    message.type === 'response' &&
                    message.command === 'variables'
                ) {
                    this.captureVariables(
                        message,
                        paths,
                        variableRequests
                    );
                }
            }
        };
    }

    private handleStopped(
        session: vscode.DebugSession,
        message: any,
        paths: Map<number, string>,
        variableRequests: Map<number, number>
    ): void {
        this.provider.clear();
        paths.clear();
        variableRequests.clear();

        const threadId =
            message.body?.threadId;

        if (!threadId) {
            return;
        }

        this.currentSession = session;
        this.currentThreadId = threadId;

        setTimeout(() => {
            void scanStoppedSession(
                session,
                threadId,
                this.provider
            );
        }, 150);
    }

    private captureScopes(
        message: any,
        paths: Map<number, string>
    ): void {
        for (
            const scope of
            message.body?.scopes ?? []
        ) {
            if (!scope.variablesReference) {
                continue;
            }

            paths.set(
                scope.variablesReference,
                ''
            );
        }
    }

    private captureVariables(
        message: any,
        paths: Map<number, string>,
        variableRequests: Map<number, number>
    ): void {
        const parentReference =
            variableRequests.get(
                message.request_seq
            );

        if (parentReference === undefined) {
            return;
        }

        variableRequests.delete(
            message.request_seq
        );

        const parentPath =
            paths.get(parentReference) ?? '';

        for (
            const variable of
            message.body?.variables ?? []
        ) {
            const path = joinPath(
                parentPath,
                variable.name
            );

            if (
                variable.variablesReference > 0
            ) {
                paths.set(
                    variable.variablesReference,
                    path
                );
            }

            if (
                isTimestampName(variable.name)
            ) {
                this.provider.add(
                    path,
                    variable.value
                );
            }
        }
    }
}
