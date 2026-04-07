# Wash Extension Config and Test Tool

A browser-based configuration and diagnostic tool for the **Wash Extension Controller (WEC)** by [Fracsun LLC](https://fracsunllc.com). Connects directly to the device over USB serial using the [Web Serial API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API) — no drivers, no software to install.

**🔗 [Open the tool](https://fracsunllc.github.io/washext-test-tool/)** *(requires Chrome or Edge)*

---

## Requirements

- **Google Chrome** or **Microsoft Edge** (Web Serial API is not supported in Firefox or Safari)
- The WEC device connected via USB
- No installation required — open `index.html` directly in the browser

---

## How to Use

1. Open `index.html` in Chrome or Edge
2. Select the correct baud rate (default: **9600**)
3. Click **Connect Serial Port** and choose the device from the browser's port picker
4. The tool will begin receiving live data automatically

---

## Tabs

### Dashboard
Live read-only view of all device telemetry, updated in real time as log lines arrive from the device.

| Section | What it shows |
|---|---|
| **Device Info** | Firmware revision, release date, board, device ID, serial number, EEPROM version, wash count, Modbus fail count, WiFi mode, wash schedule settings |
| **Temperature** | Current and average temperature (°C), freeze threshold warning |
| **Humidity** | Current and average relative humidity (%) |
| **Battery Voltage** | Voltage with a charge bar; warns when low |
| **Liquid Level Sensor** | Voltage, average, water/air detection indicator, output type |
| **Pump / Wash** | Pump state (IDLE / RUNNING), motor voltage, current and power; Run Pump button |
| **Modbus** | Slave mode, address, baud rate, serial config, ARES poll status and timing |
| **Schedule / RTC** | RTC found status, current RTC time, timezone, schedule state |
| **System Events** | Timestamped log of notable events (standby, wake, reset, battery warnings) |

### Live Log
Full raw serial output from the device with colour-coded severity levels (INFO / WARN / ERROR). Supports auto-scroll, warnings-only filter, clear, and export to `.txt`.

### Configuration
Send configuration commands to the device over the open serial connection. All buttons are disabled while a command is in progress to prevent accidental double-sends. Each section shows a live status indicator:

- **Sending commands...** — command sequence is in flight
- **✓ Success** — device confirmed the change
- **✗ Failed, try again. (Check console)** — no confirmation received within the timeout

#### Modbus Settings
- Toggle Slave / Master mode (device restarts)
- Set slave address (1–255)
- Set baud rate (4800 / 9600 / 19200 / 38400)
- Set serial config (8,None,1 or 8,Even,1)
- Factory reset Modbus settings (device restarts)

#### RTC & AutoWash Settings
- Set full date and time (timezone, year, month, day, hour, minute)
- Set timezone only (UTC −12 to +14)
- Set up to three daily AutoWash hours (use 25 to disable a slot)
- Set wash duration (0–900 seconds)
- Set skip-wash freezing threshold (−40 to 5 °C)
- Toggle liquid level sensor output type (LOW IN AIR ↔ HIGH IN AIR)

#### WiFi Settings
- Turn WiFi ON or OFF (device restarts; credentials must be entered via Particle WebUSB after restart)

#### Maintenance
- **Set Serial Number** (1–9999) — password protected
- Empty Tank — runs the pump for 15 minutes to drain the reservoir
- Factory Reset All — resets all settings to factory defaults and restarts

#### Raw Command
Send any character or string directly to the serial port for advanced testing.

#### Device Response Console
A mirrored log of all serial output, scoped to the Configuration tab for easy reference while making changes.

---

## Browser Compatibility

| Browser | Supported |
|---|---|
| Google Chrome 89+ | ✅ |
| Microsoft Edge 89+ | ✅ |
| Firefox | ❌ (no Web Serial API) |
| Safari | ❌ (no Web Serial API) |

---

## Files

| File | Purpose |
|---|---|
| `index.html` | Application layout and all HTML |
| `styles.css` | Dark-theme styles |
| `serial.js` | Web Serial API wrapper with auto-reconnect |
| `parser.js` | Parses structured log lines and extracts telemetry fields |
| `dashboard.js` | Live dashboard rendering and command status module |
| `config.js` | Configuration tab command handlers |

---

## License

Copyright © Fracsun LLC. All rights reserved.
