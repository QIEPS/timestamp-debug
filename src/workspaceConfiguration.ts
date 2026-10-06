import * as vscode from 'vscode';
import {
    resolveTimestampDebugConfiguration
} from './configuration';
import type {
    RawTimestampDebugConfiguration,
    TimestampDebugConfiguration
} from './configuration';

const CONFIGURATION_SECTION = 'timestampDebug';

const SETTING_KEYS = [
    'timezone',
    'fixedOffset',
    'dateFormat',
    'displayMode',
    'detectionMode',
    'customFields',
    'fieldPatterns',
    'scanExpensiveScopes',
    'maxScanDepth',
    'maxVariablesPerLevel',
    'maxTotalVariables'
] as const satisfies readonly (keyof RawTimestampDebugConfiguration)[];

export function readTimestampDebugConfiguration():
TimestampDebugConfiguration {
    const configuration = vscode.workspace
        .getConfiguration(CONFIGURATION_SECTION);

    const raw: RawTimestampDebugConfiguration = {};

    for (const key of SETTING_KEYS) {
        raw[key] = configuration.get(key);
    }

    return resolveTimestampDebugConfiguration(raw);
}

export function affectsTimestampDebugConfiguration(
    event: vscode.ConfigurationChangeEvent
): boolean {
    return SETTING_KEYS.some(
        key => event.affectsConfiguration(
            `${CONFIGURATION_SECTION}.${key}`
        )
    );
}
