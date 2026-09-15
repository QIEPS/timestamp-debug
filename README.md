# Timestamp Debug

Timestamp Debug is a VS Code extension that shows Unix timestamps as readable dates while debugging.

## Features

- Automatically scans local debugger variables
- Supports nested structs, slices and arrays
- Detects Unix timestamps in:
  - seconds
  - milliseconds
  - microseconds
  - nanoseconds
- Shows readable dates in the `Timestamp Variables` panel
- Supports UTC and local timezone
- Automatically refreshes on breakpoint
- Manual refresh button
- Works with Go / Delve debugging

## Example

Debugger value:

```text
Start = 1783024209229
````

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

## Supported timestamp formats

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
