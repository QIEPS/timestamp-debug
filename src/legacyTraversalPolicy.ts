import type {
    DapScope,
    DapVariable
} from './types';

export function isLegacyLocalScope(
    scope: DapScope
): boolean {
    return scope.name.toLowerCase().includes('local');
}

/**
 * Preserves the traversal exclusions that predate the universal DAP
 * traversal task. Keeping them outside the scanner prevents debugger-
 * specific value and type conventions from spreading through the core.
 */
export function passesLegacyTraversalPolicy(
    variable: DapVariable
): boolean {
    const value = variable.value.trim();
    const type = (variable.type ?? '').toLowerCase();

    if (value === 'nil') {
        return false;
    }

    if (
        value.startsWith('*') ||
        type.startsWith('*')
    ) {
        return false;
    }

    if (type.includes('time.time')) {
        return false;
    }

    if (
        type.includes('map[') ||
        value.startsWith('map[')
    ) {
        return false;
    }

    return true;
}
