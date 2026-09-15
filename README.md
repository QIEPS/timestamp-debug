# Timestamp Debug

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/qieps.timestamp-debug?label=VS%20Code%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=qieps.timestamp-debug)

[Install from VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=qieps.timestamp-debug)

Timestamp Debug is a VS Code extension that shows Unix timestamps as readable dates while debugging.

## Features

- Automatically scans local variables when the debugger stops
- Recursively scans nested structs, slices and arrays with configurable depth, per-level and total limits
- Detects timestamp fields using built-in rules, exact custom names and regex patterns
- Supports Safe and Aggressive timestamp detection modes
- Recognizes Unix timestamps in:
  - seconds
  - milliseconds
  - microseconds
  - nanoseconds
- Rejects unsupported timestamp lengths and dates outside the supported 2000–2100 range
- Shows the variable path, original timestamp and readable date in the `Timestamp Variables` panel
- Copies the raw timestamp, formatted date or variable path from the timestamp context menu
- Keeps the original debugger value unchanged
- Supports UTC, local timezone and fixed UTC offsets with minute precision
- Supports ISO and European date formats
- Automatically refreshes on breakpoint
- Automatically refreshes when timestamp detection or date display settings change
- Clears results when debugging continues or the active debug session ends
- Manual refresh button
- Works with Go / Delve debugging

## How Timestamp Variables Are Found

When the debugger stops, Timestamp Debug scans the local variables in the current stack frame and recursively follows nested debugger variables.

### Safe Mode

Safe mode is the default. Each field name is checked in this order:

Each field name is checked in this order:

1. Built-in timestamp field rules
2. Exact names from `timestampDebug.customFields`
3. Regular expressions from `timestampDebug.fieldPatterns`

Built-in rules recognize common names such as `Start`, `End`, `LastStart`, `StartTime`, `EndTime`, `CreatedAt`, `UpdatedAt`, `DeletedAt`, `ActivateAt`, `ExpiresAt`, `ExpiredAt`, `Timestamp` and `DateTime`. Built-in matching is case-insensitive and ignores `_` and `-`. It also recognizes supported suffixes such as `Timestamp`, `DateTime`, `CreatedAt` and `UpdatedAt`.

Custom fields are exact and case-sensitive. Regex patterns are checked only after the built-in and exact custom rules do not match.

### Aggressive Mode

Aggressive mode checks compatible numeric values regardless of their field names. It can detect timestamps stored in generic fields such as `value`, but numeric identifiers such as `orderId` can become false positives.

Use Aggressive mode only when broad value-based detection is more important than avoiding false positives.

In both modes, the complete value must be a 10, 13, 16 or 19-digit Unix timestamp after surrounding whitespace is removed. The value must convert to a date between 2000 and 2100. Arbitrary strings containing numeric substrings are not treated as timestamps.

## Installation

Install directly from the Visual Studio Code Marketplace:

**[Timestamp Debug — VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=qieps.timestamp-debug)**

Or search for:

```text
Timestamp Debug
````

in the VS Code Extensions view.

## Example

Debugger value:

```text
Start = 1783024209229
```

Timestamp Debug:

```text
timeSegments[0].Start
1783024209229 → 2026-07-02 20:30:09.229 UTC
```

## Settings

### Timezone

Setting:

```text
timestampDebug.timezone
```

Available values:

* `utc`
* `local`
* `fixed`

Default:

```text
utc
```

### Fixed UTC Offset

Set the timezone mode to `fixed` and configure `timestampDebug.fixedOffset`:

```json
"timestampDebug.timezone": "fixed",
"timestampDebug.fixedOffset": "UTC+05:45"
```

Fixed offsets support positive and negative values with minute precision, for example `UTC+03:00`, `UTC-04:00`, `UTC+05:30` and `UTC+05:45`.

Offsets must use the exact `UTC±HH:MM` format and must be between `UTC-14:00` and `UTC+14:00`. An invalid value falls back to `UTC+00:00`.

The offset changes only the displayed date. The original debugger timestamp remains unchanged. Changing `timezone` or `fixedOffset` automatically refreshes the view while the debugger is stopped.

### Date Format

Setting:

```text
timestampDebug.dateFormat
```

Available values:

* `iso`
* `european`

Examples:

```text
ISO:
2026-07-02 20:30:09.229 UTC

European:
02.07.2026 20:30:09.229 UTC
```

Default:

```text
iso
```

### Custom Timestamp Fields

Use `timestampDebug.customFields` to add exact debugger field names:

```json
"timestampDebug.customFields": [
  "BillingDate",
  "RenewAt"
]
```

Custom field names are case-sensitive and must match the complete debugger field name. For example, `BillingDate` does not match `billingdate` or `BillingDateValue`.

### Timestamp Field Patterns

Use `timestampDebug.fieldPatterns` to match debugger field names with regular expressions:

```json
"timestampDebug.fieldPatterns": [
  ".*At$",
  ".*Timestamp$"
]
```

Patterns use JavaScript regular-expression syntax and are evaluated against the debugger field name. Do not include surrounding `/` characters. Add `^` and `$` when the pattern must match the entire name.

A matching field is displayed only when its value is also a valid supported Unix timestamp. Invalid regular expressions are ignored without disabling built-in rules, custom fields or other valid patterns.

Changing `customFields` or `fieldPatterns` automatically refreshes the `Timestamp Variables` view while the debugger is stopped. A manual refresh is not required.

### Detection Mode

Setting:

```text
timestampDebug.detectionMode
```

Available values:

- `safe` — requires the field name to match a built-in rule, `customFields` or `fieldPatterns`.
- `aggressive` — checks every compatible numeric value regardless of its field name.

Default:

```text
safe
```

Aggressive mode may display numeric IDs and other unrelated values as timestamps. Changing the detection mode automatically refreshes the view while the debugger is stopped.

### Scan Limits

Use these settings to control recursive scanning of large debugger object graphs:

```json
"timestampDebug.maxScanDepth": 4,
"timestampDebug.maxVariablesPerLevel": 100,
"timestampDebug.maxTotalVariables": 1000
```

- `maxScanDepth` is the maximum recursive depth below a debugger scope. Top-level local variables are at depth `0`.
- `maxVariablesPerLevel` limits how many variables are processed from one debugger level.
- `maxTotalVariables` limits the total number of variables processed across the entire scan.

All scan limits must be positive integers. Missing or invalid values fall back individually to the safe defaults shown above. Changing a scan limit automatically refreshes the view while the debugger is stopped.

## Supported Timestamp Formats

| Digits | Unit         |
| ------ | ------------ |
| 10     | Seconds      |
| 13     | Milliseconds |
| 16     | Microseconds |
| 19     | Nanoseconds  |

## Usage

1. Start a debugging session.
2. Stop on a breakpoint.
3. Open `Run and Debug`.
4. Find `Timestamp Variables`.
5. Timestamps are detected automatically.

Use the refresh button to rescan variables manually.

### Copy Timestamp Values

Right-click a timestamp item in the `Timestamp Variables` view and select one of these actions:

- `Copy Timestamp` copies only the original timestamp value, for example `1783024209229`.
- `Copy Formatted Date` copies only the displayed date, for example `2026-07-02 20:30:09.229 UTC`.
- `Copy Variable Path` copies only the debugger path, for example `timeSegments[0].Start`.

No labels or additional text are added to the copied value.

## Development

Install dependencies, compile the extension and run the tests:

```bash
npm ci
npm run compile
npm test
```

The tests cover built-in and configured field detection, Safe and Aggressive modes, supported timestamp units, invalid values, scan limits, copy-value selection and timezone formatting.

## Links

* [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=qieps.timestamp-debug)
* [GitHub Repository](https://github.com/QIEPS/timestamp-debug)
* [Issues](https://github.com/QIEPS/timestamp-debug/issues)
