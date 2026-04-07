/* ============================================================
   parser.js — Parse Wash Extension serial log lines
   ============================================================
   Log line format:
     <timestamp_ms> [<category>] LEVEL: <message>
   e.g.
     0000007809 [app.measure] INFO: TEMP: 27.1 C
   ============================================================ */

const Parser = (() => {
  // Regex to split a raw log line into its parts
  const LINE_RE = /^(\d+)\s+\[([^\]]+)\]\s+(INFO|WARN|ERROR|DEBUG|TRACE):\s+(.+)$/;

  /**
   * Parse a single raw log line.
   * Returns null if the line does not match the log format.
   */
  function parseLine(raw) {
    const m = LINE_RE.exec(raw.trim());
    if (!m) return null;
    return {
      timestamp: parseInt(m[1], 10),
      category:  m[2],
      level:     m[3],
      message:   m[4].trim(),
    };
  }

  /**
   * Extract structured fields from a parsed line's message.
   * Returns an object with any recognised key/value pairs, or null.
   */
  function extractFields(parsed) {
    if (!parsed) return null;
    const { message, category, level } = parsed;
    const fields = {};

    // ── Device info (boot sequence) ───────────────────────
    let m;

    if ((m = /^Firmware Rev:\s*(.+)$/.exec(message)))
      return { firmware: m[1].trim() };

    if ((m = /^Release Date:\s*(.+)$/.exec(message)))
      return { releaseDate: m[1].trim() };

    if ((m = /^Board and revision:\s*(.+)$/.exec(message)))
      return { board: m[1].trim() };

    if ((m = /^device ID:\s*(.+)$/.exec(message)))
      return { deviceId: m[1].trim() };

    if ((m = /^Serial Number:\s*(.+)$/.exec(message)))
      return { serialNum: m[1].trim() };

    if ((m = /^EEPROM Ver:\s*(\d+),\s*#Washes:\s*(\d+),\s*#Modbusfails:\s*(\d+)$/.exec(message)))
      return { eepromVer: m[1], washes: m[2], modbusFails: m[3] };

    if (/^SHT20 sensor found!/.test(message))
      return { sensor_sht20: true };

    if (/^Couldn't find RTC/.test(message))
      return { rtcFound: false };

    if (/^RTC found/.test(message))
      return { rtcFound: true };

    // ── Modbus settings ───────────────────────────────────
    if ((m = /^\s*Slave Mode:\s*(.+)$/.exec(message)))
      return { mbSlaveMode: m[1].trim() };

    if ((m = /^\s*Address\/Channel:\s*(.+)$/.exec(message)))
      return { mbAddr: m[1].trim() };

    if ((m = /^\s*Baud Rate:\s*(.+)$/.exec(message)))
      return { mbBaud: m[1].trim() };

    if ((m = /^\s*Config:\s*(.+)$/.exec(message)) && category === 'app')
      return { mbConfig: m[1].trim() };

    // ── Liquid level sensor type ──────────────────────────
    if ((m = /^Liquid Level Sensor output type:\s*(.+)$/.exec(message)))
      return { llsType: m[1].trim() };

    // ── Measurements ─────────────────────────────────────
    if ((m = /^TEMP:\s*([\d.]+)\s*C$/.exec(message)))
      return { temp: parseFloat(m[1]) };

    if ((m = /^TEMP \(avg\):\s*([\d.]+)\s*C$/.exec(message)))
      return { tempAvg: parseFloat(m[1]) };

    if ((m = /^HUMIDITY:\s*([\d.]+)/.exec(message)))
      return { humidity: parseFloat(m[1]) };

    if ((m = /^HUMIDITY \(avg\):\s*([\d.]+)/.exec(message)))
      return { humidityAvg: parseFloat(m[1]) };

    if ((m = /^BATTERY VOLTAGE:\s*([\d.]+)/.exec(message)))
      return { battery: parseFloat(m[1]) };

    if (/^BATTERY VOLTAGE LOW/.test(message))
      return { batteryLow: true };

    if ((m = /^LIQUID LEVEL SENSOR:\s*([\d.]+)/.exec(message)))
      return { lls: parseFloat(m[1]) };

    if ((m = /^LIQUID LEVEL SENSOR \(avg\):\s*([\d.]+)/.exec(message)))
      return { llsAvg: parseFloat(m[1]) };

    // ── Pump / Wash ───────────────────────────────────────
    if (/^Running cleaning routine/.test(message))
      return { pumpStart: true };

    if (/^Successfully ran a wash/.test(message))
      return { pumpDone: true };

    if (/^Wash complete|wash done/i.test(message))
      return { pumpDone: true };

    // "Motor Voltage, Current, Power:" label line — value comes next
    if (/^Motor Voltage, Current, Power:/.test(message))
      return { pumpValuesNext: true };

    // Value line: "12.09, 2.95, 35.63"  (voltage, current, power)
    if ((m = /^([\d.]+),\s*([\d.]+),\s*([\d.]+)$/.exec(message.trim())))
      return { pumpVoltage: parseFloat(m[1]), pumpCurrent: parseFloat(m[2]), pumpPower: parseFloat(m[3]) };

    // Legacy single-value fallbacks
    if ((m = /^Current:\s*([\d.]+)\s*A/i.exec(message)))
      return { pumpCurrent: parseFloat(m[1]) };

    if ((m = /^Power:\s*([\d.]+)\s*W/i.exec(message)))
      return { pumpPower: parseFloat(m[1]) };

    // ── WiFi ──────────────────────────────────────────────
    if ((m = /^WiFi mode:\s*(.+)$/.exec(message)))
      return { wifi: m[1].trim() };

    // ── Modbus master sync ────────────────────────────────
    if ((m = /^Trying to connect to ARES/.exec(message)))
      return { aresPollPending: true };

    if ((m = /^Polled successfully after\s*([\d.]+)\s*seconds/.exec(message)))
      return { aresPollOk: parseFloat(m[1]) };

    if (/^Modbus.*fail|poll.*fail|Failed to.*modbus/i.test(message))
      return { aresPollFail: true };

    if (/^Syncing WEC from ARES/.test(message))
      return { aresSync: true };

    if ((m = /^Timezone:\s*([-\d]+)/.exec(message)))
      return { timezone: m[1].trim() };

    if ((m = /^ARES wake freq:\s*(.+)$/.exec(message)))
      return { aresWakeFreq: m[1].trim() };

    if ((m = /^Sync interval:\s*(.+)$/.exec(message)))
      return { syncInterval: m[1].trim() };

    // ISO-8601 datetime in message (schedule / RTC)
    if ((m = /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2})/.exec(message)) && category.startsWith('app'))
      return { rtcTime: m[1] };

    // ── Schedule ──────────────────────────────────────────
    if ((m = /^Skip Wash Freezing Threshold:\s*([\d.]+)\s*C/.exec(message)))
      return { freezeThresh: m[1].trim() };

    if ((m = /^Wash Seconds:\s*(\d+)/.exec(message)))
      return { washSecs: m[1].trim() };

    if ((m = /^Wash schedule \(hours\):\s*(.+)$/.exec(message)))
      return { washHours: m[1].trim() };

    if ((m = /^Next wash occurs in:\s*([\d.]+)\s*seconds.*?([\d.]+)\s*hours/.exec(message)))
      return { nextWashSec: parseFloat(m[1]), nextWashHr: parseFloat(m[2]) };

    if ((m = /^SCHEDULE >>\s*(.+)$/.exec(message)))
      return { schedState: m[1].trim() };

    // ── System events ─────────────────────────────────────
    if (/^Going into standby/.test(message))
      return { sysEvent: 'Standby' };

    if (/^Waking from standby/.test(message))
      return { sysEvent: 'Wake' };

    if (/^Resetting|System\.reset/.test(message))
      return { sysEvent: 'Reset' };

    return null;
  }

  /**
   * Process a raw line: parse it, then extract structured data.
   * Returns { parsed, fields } or { parsed: null, fields: null } for non-log text.
   */
  function process(raw) {
    const parsed = parseLine(raw);
    const fields = extractFields(parsed);
    return { parsed, fields };
  }

  return { parseLine, extractFields, process };
})();
