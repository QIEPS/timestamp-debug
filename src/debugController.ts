import * as vscode from 'vscode';
import type {
    TimestampDebugConfiguration
} from './configuration';
import {
    DebugTrackerState,
    getScopesResponse,
    getStoppedThreadId,
    getVariablesRequest,
    getVariablesResponse,
    isContinuedEvent,
    isStoppedEvent
} from './debugTracker';
import type {
    DapVariablesResponse
} from './debugTracker';
import {
    scanStoppedSession
} from './debugScanner';
import type {
    TimestampVariableSink
} from './dapTraversal';
import { TimestampConverter } from './timestamp';
import { TimestampProvider } from './timestampProvider';
import {
    affectsTimestampDebugConfiguration,
    readTimestampDebugConfiguration
} from './workspaceConfiguration';

export class DebugController implements vscode.Disposable {
    private currentSession:
        vscode.DebugSession | undefined;

    private currentThreadId:
        number | undefined;

    private scanRevision = 0;

    private pendingScan:
        ReturnType<typeof setTimeout> | undefined;

    constructor(
        private readonly provider: TimestampProvider,
        private configuration:
        TimestampDebugConfiguration
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
                    if (
                        !affectsTimestampDebugConfiguration(
                            event
                        )
                    ) {
                        return;
                    }

                    this.configuration =
                        readTimestampDebugConfiguration();

                    this.provider.setConverter(
                        new TimestampConverter(
                            this.configuration
                        )
                    );

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

                    this.invalidateScan();
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
        this.invalidateScan();
        this.currentSession = undefined;
        this.currentThreadId = undefined;
    }

    private async refresh(): Promise<void> {
        const session = this.currentSession;
        const threadId = this.currentThreadId;

        if (!session || threadId === undefined) {
            return;
        }

        const revision = this.invalidateScan();
        this.provider.clear();

        await this.scan(
            session,
            threadId,
            revision,
            this.configuration
        );
    }

    private createTracker(
        session: vscode.DebugSession
    ): vscode.DebugAdapterTracker {
        const state = new DebugTrackerState();

        return {
            onWillReceiveMessage: (message: unknown) => {
                const request =
                    getVariablesRequest(message);

                if (!request) {
                    return;
                }

                state.recordVariablesRequest(
                    request,
                    this.scanRevision
                );
            },

            onDidSendMessage: (message: unknown) => {
                if (isStoppedEvent(message)) {
                    this.handleStopped(
                        session,
                        getStoppedThreadId(message),
                        state
                    );

                    return;
                }

                if (isContinuedEvent(message)) {
                    this.handleContinued(session, state);
                    return;
                }

                const scopes = getScopesResponse(message);

                if (scopes) {
                    state.captureScopes(scopes);
                    return;
                }

                const variables =
                    getVariablesResponse(message);

                if (variables) {
                    this.captureVariables(
                        session,
                        variables,
                        state
                    );
                }
            }
        };
    }

    private handleStopped(
        session: vscode.DebugSession,
        threadId: number | undefined,
        state: DebugTrackerState
    ): void {
        const revision = this.invalidateScan();

        this.provider.clear();
        state.clear();

        if (threadId === undefined) {
            this.currentSession = undefined;
            this.currentThreadId = undefined;
            return;
        }

        this.currentSession = session;
        this.currentThreadId = threadId;

        const configuration = this.configuration;

        this.pendingScan = setTimeout(() => {
            this.pendingScan = undefined;

            void this.scan(
                session,
                threadId,
                revision,
                configuration
            );
        }, 150);
    }

    private handleContinued(
        session: vscode.DebugSession,
        state: DebugTrackerState
    ): void {
        state.clear();

        if (this.currentSession?.id !== session.id) {
            return;
        }

        this.invalidateScan();
        this.currentThreadId = undefined;
        this.provider.clear();
    }

    private captureVariables(
        session: vscode.DebugSession,
        response: DapVariablesResponse,
        state: DebugTrackerState
    ): void {
        const candidates = state.consumeVariablesResponse(
            response,
            this.scanRevision
        );

        if (
            this.currentSession?.id !== session.id ||
            this.currentThreadId === undefined
        ) {
            return;
        }

        for (const candidate of candidates) {
            this.provider.add(
                candidate.path,
                candidate.name,
                candidate.value
            );
        }
    }

    private async scan(
        session: vscode.DebugSession,
        threadId: number,
        revision: number,
        configuration: TimestampDebugConfiguration
    ): Promise<void> {
        const sink: TimestampVariableSink = {
            add: (path, name, value) => {
                if (
                    this.isCurrentScan(
                        session,
                        threadId,
                        revision
                    )
                ) {
                    this.provider.add(path, name, value);
                }
            }
        };

        await scanStoppedSession(
            session,
            threadId,
            sink,
            configuration.scanLimits,
            () => this.isCurrentScan(
                session,
                threadId,
                revision
            )
        );
    }

    private isCurrentScan(
        session: vscode.DebugSession,
        threadId: number,
        revision: number
    ): boolean {
        return revision === this.scanRevision &&
            session.id === this.currentSession?.id &&
            threadId === this.currentThreadId;
    }

    private invalidateScan(): number {
        this.scanRevision += 1;

        if (this.pendingScan) {
            clearTimeout(this.pendingScan);
            this.pendingScan = undefined;
        }

        return this.scanRevision;
    }
}
