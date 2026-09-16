import * as vscode from 'vscode';
import type { ScanLimits } from './scanLimits';
import {
    scanDapThread
} from './dapTraversal';
import type {
    DapClient,
    DapScanResult,
    TimestampVariableSink
} from './dapTraversal';

export async function scanStoppedSession(
    session: vscode.DebugSession,
    threadId: number,
    sink: TimestampVariableSink,
    limits: ScanLimits,
    isActive: () => boolean
): Promise<DapScanResult> {
    const client: DapClient = {
        request: (command, argumentsValue) =>
            session.customRequest(
                command,
                argumentsValue
            )
    };

    try {
        return await scanDapThread(
            client,
            threadId,
            sink,
            limits,
            isActive
        );
    } catch (error) {
        console.error(
            '[Timestamp Debug] Scan error:',
            error
        );

        return {
            failed: true,
            limitsReached: []
        };
    }
}
