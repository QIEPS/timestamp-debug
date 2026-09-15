# Changelog

All notable changes to Timestamp Debug will be documented in this file.

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
