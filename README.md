# Timestamp Debug

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/qieps.timestamp-debug?label=VS%20Code%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=qieps.timestamp-debug)

[Install from VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=qieps.timestamp-debug)

Timestamp Debug is a VS Code extension that shows Unix timestamps as readable dates while debugging.

## Features

- Automatically scans local variables when the debugger stops
- Recursively scans nested structs, slices and arrays with cycle and size limits
- Detects timestamp fields using built-in rules, exact custom names and regex patterns
- Recognizes Unix timestamps in:
  - seconds
  - milliseconds
  - microseconds
  - nanoseconds
- Rejects unsupported timestamp lengths and dates outside the supported 2000–2100 range
- Shows the variable path, original timestamp and readable date in the `Timestamp Variables` panel
- Keeps the original debugger value unchanged
- Supports UTC and local timezone
- Supports ISO and European date formats
- Automatically refreshes on breakpoint
- Automatically refreshes when timestamp detection or date display settings change
- Clears results when debugging continues or the active debug session ends
- Manual refresh button
- Works with Go / Delve debugging

## How Timestamp Variables Are Found

When the debugger stops, Timestamp Debug scans the local variables in the current stack frame and recursively follows nested debugger variables.

Each field name is checked in this order:

1. Built-in timestamp field rules
2. Exact names from `timestampDebug.customFields`
3. Regular expressions from `timestampDebug.fieldPatterns`

Built-in rules recognize common names such as `Start`, `End`, `LastStart`, `StartTime`, `EndTime`, `CreatedAt`, `UpdatedAt`, `DeletedAt`, `ActivateAt`, `ExpiresAt`, `ExpiredAt`, `Timestamp` and `DateTime`. Built-in matching is case-insensitive and ignores `_` and `-`. It also recognizes supported suffixes such as `Timestamp`, `DateTime`, `CreatedAt` and `UpdatedAt`.

Custom fields are exact and case-sensitive. Regex patterns are checked only after the built-in and exact custom rules do not match.

After a field name matches, its value is validated. The field is added to the `Timestamp Variables` view only when the value contains a supported 10, 13, 16 or 19-digit Unix timestamp that converts to a date between 2000 and 2100.

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

Default:

```text
utc
```

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

## Development

Install dependencies, compile the extension and run the tests:

```bash
npm ci
npm run compile
npm test
```

The tests cover existing built-in field detection, exact custom fields, regex matches and invalid regex handling.

## Links

* [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=qieps.timestamp-debug)
* [GitHub Repository](https://github.com/QIEPS/timestamp-debug)
* [Issues](https://github.com/QIEPS/timestamp-debug/issues)
