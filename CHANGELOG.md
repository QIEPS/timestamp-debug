# Changelog

All notable changes to Timestamp Debug will be documented in this file.

## 0.5.1 - 2026-09-16

### Changed

- Replaced the extension icon with the new Timestamp Debug artwork.

## 0.5.0 - 2026-09-16

### Added

- Added an `Open Timestamp Debug Settings` view-title action.
- Added `timestampDebug.scanExpensiveScopes` to optionally skip scopes marked `expensive: true` by the debug adapter.

### Changed

- Recursive DAP branches are requested with bounded concurrency to reduce scan latency while preserving deterministic result order and safety limits.
- `Partial scan` is now informational only; its tooltip shows the exact setting identifiers and reports expensive scopes skipped by the configured DAP scope policy.
- The settings action now opens every Timestamp Debug setting instead of filtering to scan-related settings.

### Tests

- Added coverage for expensive-scope parsing, filtering, default compatibility, configuration validation and bounded concurrent traversal.

## 0.4.0 - 2026-09-16

### Added

- Added a collapsible Timestamp Variables hierarchy built from debugger variable paths.
- Added theme-aware colored icons for root and nested groups, array indices, Unix leaves and ISO leaves.
- Added live scan-state rows for idle, scanning, completed, empty, failed and limited scans.
- Added theme icons to timestamp copy commands and structured tooltip icons for path, raw value and formatted date.
- Added `timestampDebug.displayMode` with `date` and `timestampAndDate` modes.
- Added strict ISO timestamp parsing with `Z` and numeric UTC offsets, including quoted debugger string values.

### Changed

- Numeric DAP child names now use bracket notation such as `items[0]` in displayed and copied variable paths.
- Timestamp leaf tooltips preserve the complete path, raw value and formatted date in both display modes.
- Traversal now reports which safety limit truncated a scan so the view can warn users instead of silently omitting deeper variables.
- Partial scans now use a neutral informational status and a plain-language tooltip showing the reached limits, their configured values and whether displayed timestamps remain valid.
- Timestamp tree updates are batched to avoid rebuilding and repainting the complete hierarchy for every detected value.
- Repeated DAP observations of the same path and value are deduplicated before timestamp conversion, and stale timestamp rows are removed when a value stops matching.
- DAP variable requests now use standard `start` and `count` pagination hints, limiting large adapter responses while preserving configured scan-limit behavior.
- Replaced the obsolete flat-list screenshot with an optimized Marketplace image showing the hierarchical, theme-aware view.

### Tests

- Added coverage for hierarchical paths, both display modes, supported and invalid ISO strings, calendar validation, boundary years, timezone conversion, raw ISO copying, traversal limit reporting and DAP pagination hints.

## 0.3.0 - 2026-09-15

### Changed

- Replaced debugger-specific traversal filters with recursive traversal based on standard DAP `variablesReference` values.
- Removed special handling for Go pointer, map and `time.Time` type strings from the traversal core.
- Traversal now scans debugger scopes exposed through DAP without relying on language-specific scope names.
- Shallower variables are scanned before deeper references so direct values are not delayed by cyclic or aliased branches.
- Each DAP scope is completed in adapter order so a large later scope cannot exhaust the scan budget before nested values in an earlier scope.
- Independent root branches are scanned in round-robin order so a wide object such as a global context cannot starve a deeper sibling branch.

### Tests

- Added traversal fixtures for Go pointer and map shapes, JavaScript objects and arrays, and Python dictionaries.
- Added coverage for language-independent scope names, changing reference identifiers and fair scan-budget use across scopes and sibling branches while preserving cycle protection, scan limits and cancellation.

## 0.2.0 - 2026-09-15

### Added

- Exact custom timestamp field names through `timestampDebug.customFields`.
- Regular-expression field matching through `timestampDebug.fieldPatterns`.
- Safe and Aggressive timestamp detection modes.
- Configurable recursive scan depth, per-level variable limit and total variable limit.
- Fixed UTC offsets from `UTC-14:00` to `UTC+14:00`, including minute-precision offsets.
- Context-menu actions for copying the original timestamp, formatted date or variable path.
- Unit tests for configuration, timestamp detection, formatting, copying, DAP traversal and tracker state.

### Changed

- Refactored timestamp conversion, debugger traversal and DAP tracking into focused, testable modules.
- Added cancellation protection so stale debugger scans cannot update the Timestamp Variables view.
- Improved the Marketplace README with a quick start, configuration reference and compatibility information.

### Compatibility

- Safe remains the default detection mode.
- Existing built-in timestamp field detection is preserved.
- The current release remains compatible with Go debugging through Delve.
- Simple local-variable detection is verified with the built-in JavaScript debugger.

## 0.1.1 - 2026-09-15

### Changed

- Replaced remaining Russian UI text with English
- Improved README
- Added Visual Studio Marketplace links

## 0.1.0 - 2026-09-15

### Added

- Automatic Unix timestamp detection during debugging
- Automatic scanning of local variables
- Nested structs, slices and arrays support
- Unix seconds support
- Unix milliseconds support
- Unix microseconds support
- Unix nanoseconds support
- UTC and local timezone modes
- ISO and European date formats
- Automatic refresh on breakpoints
- Manual refresh command
- Timestamp Variables view in Run and Debug
