import * as vscode from 'vscode';
import type { ScanLimits } from './scanLimits';
import {
    scanDapThread
} from './dapTraversal';
import type {
    DapClient,
    TimestampVariableSink
} from './dapTraversal';
import {
    isLegacyLocalScope,
    passesLegacyTraversalPolicy
} from './legacyTraversalPolicy';

export async function scanStoppedSession(
    session: vscode.DebugSession,
    threadId: number,
    sink: TimestampVariableSink,
    limits: ScanLimits,
    isActive: () => boolean
): Promise<void> {
    const client: DapClient = {
        request: (command, argumentsValue) =>
            session.customRequest(
                command,
                argumentsValue
            )
    };

    try {
        await scanDapThread(
            client,
            threadId,
            sink,
            limits,
            {
                shouldScanScope: isLegacyLocalScope,
                shouldDescend:
                    passesLegacyTraversalPolicy
            },
            isActive
        );
    } catch (error) {
        console.error(
            '[Timestamp Debug] Scan error:',
            error
        );
    }
}
