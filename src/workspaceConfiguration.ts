import * as vscode from 'vscode';
import {
    resolveTimestampDebugConfiguration
} from './configuration';
import type {
    TimestampDebugConfiguration
} from './configuration';

const CONFIGURATION_SECTION = 'timestampDebug';

const SETTING_KEYS = {
    timezone: 'timezone',
    fixedOffset: 'fixedOffset',
    dateFormat: 'dateFormat',
    displayMode: 'displayMode',
    detectionMode: 'detectionMode',
    customFields: 'customFields',
    fieldPatterns: 'fieldPatterns',
    scanExpensiveScopes: 'scanExpensiveScopes',
    maxScanDepth: 'maxScanDepth',
    maxVariablesPerLevel: 'maxVariablesPerLevel',
    maxTotalVariables: 'maxTotalVariables'
} as const;

const TIMESTAMP_DEBUG_SETTING_KEYS =
    Object.values(SETTING_KEYS);

export function readTimestampDebugConfiguration():
TimestampDebugConfiguration {
    const configuration = vscode.workspace
        .getConfiguration(CONFIGURATION_SECTION);

    return resolveTimestampDebugConfiguration({
        timezone: configuration.get(
            SETTING_KEYS.timezone
        ),
        fixedOffset: configuration.get(
            SETTING_KEYS.fixedOffset
        ),
        dateFormat: configuration.get(
            SETTING_KEYS.dateFormat
        ),
        displayMode: configuration.get(
            SETTING_KEYS.displayMode
        ),
        detectionMode: configuration.get(
            SETTING_KEYS.detectionMode
        ),
        customFields: configuration.get(
            SETTING_KEYS.customFields
        ),
        fieldPatterns: configuration.get(
            SETTING_KEYS.fieldPatterns
        ),
        scanExpensiveScopes: configuration.get(
            SETTING_KEYS.scanExpensiveScopes
        ),
        maxScanDepth: configuration.get(
            SETTING_KEYS.maxScanDepth
        ),
        maxVariablesPerLevel: configuration.get(
            SETTING_KEYS.maxVariablesPerLevel
        ),
        maxTotalVariables: configuration.get(
            SETTING_KEYS.maxTotalVariables
        )
    });
}

export function affectsTimestampDebugConfiguration(
    event: vscode.ConfigurationChangeEvent
): boolean {
    return TIMESTAMP_DEBUG_SETTING_KEYS.some(
        key => event.affectsConfiguration(
            `${CONFIGURATION_SECTION}.${key}`
        )
    );
}
