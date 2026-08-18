/* ============================================================
   dashboard.js — Live dashboard updates + log rendering
   ============================================================ */

/* ============================================================
   CmdStatus — Command status display + global button lock
   ============================================================ */
const CmdStatus = (() => {
  let _allBtns  = [];   // all .btn-cfg / .btn-danger in the config tab
  let _resolver = null; // active field-wait callback
  let _timer    = null; // active timeout handle

  const _statusEls = { modbus: null, rtc: null, wifi: null, maintenance: null };

  function init() {
    _allBtns = Array.from(
      document.querySelectorAll('#tab-config .btn-cfg, #tab-config .btn-danger')
    );
    _statusEls.modbus      = document.getElementById('cfg-status-modbus');
    _statusEls.rtc         = document.getElementById('cfg-status-rtc');
    _statusEls.wifi        = document.getElementById('cfg-status-wifi');
    _statusEls.maintenance = document.getElementById('cfg-status-maintenance');
  }

  function lockAll()   { _allBtns.forEach(b => { b.disabled = true;  }); }
  function unlockAll() { _allBtns.forEach(b => { b.disabled = false; }); }

  function _clearAllStatus() {
    Object.values(_statusEls).forEach(el => {
      if (el) { el.textContent = ''; el.className = 'cfg-status'; }
    });
  }

  function setSending(section) {
    _clearAllStatus();
    const el = _statusEls[section];
    if (!el) return;
    el.textContent = 'Sending commands...';
    el.className = 'cfg-status sending';
  }

  function setSuccess(section) {
    const el = _statusEls[section];
    if (el) { el.textContent = '✓ Success'; el.className = 'cfg-status success'; }
    unlockAll();
  }

  function setFailed(section) {
    const el = _statusEls[section];
    if (el) { el.textContent = '✗ Failed, try again. (Check console)'; el.className = 'cfg-status failed'; }
    unlockAll();
  }

  /**
   * Wait up to timeoutMs for matchFn(fields, parsed) to return true.
   * Set up the waiter BEFORE calling seq() so responses that arrive
   * during the command sequence are also captured.
   * Resolves true on match, false on timeout.
   */
  function waitForMatch(matchFn, timeoutMs) {
    return new Promise(resolve => {
      _resolver = (fields, parsed) => {
        if (matchFn(fields, parsed)) {
          _resolver = null;
          clearTimeout(_timer);
          resolve(true);
        }
      };
      _timer = setTimeout(() => {
        _resolver = null;
        resolve(false);
      }, timeoutMs);
    });
  }

  // Called from Serial.onLineReceived to feed each incoming line to the active waiter
  function onFields(fields, parsed) {
    if (_resolver) _resolver(fields, parsed);
  }

  return { init, lockAll, unlockAll, setSending, setSuccess, setFailed, waitForMatch, onFields };
})();

const Dashboard = (() => {
  // ── DOM refs ──────────────────────────────────────────────
  const $ = id => document.getElementById(id);

  const els = {
    firmware:    $('d-firmware'),
    releaseDate: $('d-releaseDate'),
    board:       $('d-board'),
    deviceId:    $('d-deviceId'),
    serialNum:   $('d-serialNum'),
    eepromVer:   $('d-eepromVer'),
    washes:      $('d-washes'),
    modbusFails: $('d-modbusFails'),
    wifi:        $('d-wifi'),
    rtc:         $('d-rtc'),

    temp:        $('d-temp'),
    tempAvg:     $('d-tempAvg'),
    tempStatus:  $('d-tempStatus'),
    humidity:    $('d-humidity'),
    humidityAvg: $('d-humidityAvg'),

    battery:     $('d-battery'),
    batteryStatus: $('d-batteryStatus'),
    batteryBar:  $('d-batteryBar'),

    lls:         $('d-lls'),
    llsAvg:      $('d-llsAvg'),
    llsDot:      $('d-llsDot'),
    llsLabel:    $('d-llsLabel'),
    llsType:     $('d-llsType'),

    pumpStatus:  $('d-pumpStatus'),
    pumpVoltage: $('d-pumpVoltage'),
    pumpCurrent: $('d-pumpCurrent'),
    pumpPower:   $('d-pumpPower'),
    runWashBtn:     $('runWashBtn'),
    repeatWashBtn:  $('repeatWashBtn'),
    repeatInterval: $('repeatIntervalSelect'),
    repeatStatus:   $('repeatWashStatus'),

    mbSlave:        $('d-mbSlave'),
    mbAddr:         $('d-mbAddr'),
    mbBaud:         $('d-mbBaud'),
    mbConfig:       $('d-mbConfig'),
    aresPollStatus: $('d-aresPollStatus'),
    aresPoll:       $('d-aresPoll'),
    aresSync:       $('d-aresSync'),

    rtcTime:     $('d-rtcTime'),
    tz:          $('d-tz'),
    washHours:   $('d-washHours'),
    washSecs:    $('d-washSecs'),
    freezeThresh:$('d-freezeThresh'),
    schedState:  $('d-schedState'),
    nextWash:    $('d-nextWash'),

    events:      $('d-events'),
  };

  // ── Log tab ───────────────────────────────────────────────
  const logContainer    = $('logContainer');
  const autoScrollCheck = $('autoScrollCheck');
  const warnOnlyCheck   = $('warnOnlyCheck');
  const clearLogBtn     = $('clearLogBtn');
  const exportLogBtn    = $('exportLogBtn');

  let rawLogLines = [];  // all lines, for export

  clearLogBtn.addEventListener('click', () => {
    logContainer.innerHTML = '';
    rawLogLines = [];
  });

  exportLogBtn.addEventListener('click', () => {
    const blob = new Blob([rawLogLines.join('\n')], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `wash_ext_log_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // ── Tab switching ─────────────────────────────────────────
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      const tabId = 'tab-' + btn.dataset.tab;
      document.getElementById(tabId).classList.add('active');
    });
  });

  // ── State ─────────────────────────────────────────────────
  let llsOutputHighAir = false; // default in example: LOW IN AIR

  // ── Apply extracted fields to dashboard ───────────────────
  function applyFields(fields, parsed) {
    if (!fields) return;

    const set = (el, val) => {
      if (!el || val === undefined) return;
      if (el.textContent === String(val)) return; // no change, skip flash
      el.textContent = val;
      el.classList.remove('value-flash');
      // Force reflow so removing+re-adding the class restarts the animation
      void el.offsetWidth;
      el.classList.add('value-flash');
    };

    if (fields.firmware    !== undefined) set(els.firmware,    fields.firmware);
    if (fields.releaseDate !== undefined) set(els.releaseDate, fields.releaseDate);
    if (fields.board       !== undefined) set(els.board,       fields.board);
    if (fields.deviceId    !== undefined) set(els.deviceId,    fields.deviceId);
    if (fields.serialNum   !== undefined) set(els.serialNum,   fields.serialNum);
    if (fields.eepromVer   !== undefined) {
      set(els.eepromVer,   fields.eepromVer);
      set(els.washes,      fields.washes);
      set(els.modbusFails, fields.modbusFails);
    }
    if (fields.rtcFound !== undefined)
      set(els.rtc, fields.rtcFound ? 'Found' : 'Not found');

    if (fields.wifi !== undefined) set(els.wifi, fields.wifi);

    // Modbus
    if (fields.mbSlaveMode !== undefined) set(els.mbSlave,  fields.mbSlaveMode);
    if (fields.mbAddr      !== undefined) set(els.mbAddr,   fields.mbAddr);
    if (fields.mbBaud      !== undefined) set(els.mbBaud,   fields.mbBaud);
    if (fields.mbConfig    !== undefined) set(els.mbConfig, fields.mbConfig);

    if (fields.aresPollPending) {
      if (els.aresPollStatus) {
        els.aresPollStatus.textContent = 'Polling…';
        els.aresPollStatus.style.color = 'var(--yellow)';
      }
    }
    if (fields.aresPollOk !== undefined) {
      set(els.aresPoll, `${fields.aresPollOk.toFixed(1)} s`);
      if (els.aresPollStatus) {
        els.aresPollStatus.textContent = `OK (${fields.aresPollOk.toFixed(1)} s)`;
        els.aresPollStatus.style.color = 'var(--green)';
      }
    }
    if (fields.aresPollFail) {
      if (els.aresPollStatus) {
        els.aresPollStatus.textContent = 'Failed';
        els.aresPollStatus.style.color = 'var(--red)';
      }
    }
    if (fields.aresSync) {
      const now = new Date();
      set(els.aresSync, now.toLocaleTimeString());
    }
    if (fields.aresWakeFreq !== undefined) {
      // shown in schedule section as sync interval info
    }

    // Temperature
    if (fields.temp !== undefined) {
      set(els.temp, fields.temp.toFixed(1));
      const freezeTxt = els.freezeThresh.textContent;
      const freezeC   = parseFloat(freezeTxt) || 4;
      els.tempStatus.textContent = fields.temp <= freezeC ? '⚠ Below Freeze Threshold' : '● OK';
      els.tempStatus.className   = 'status-indicator ' + (fields.temp <= freezeC ? 'warn' : 'ok');
    }
    if (fields.tempAvg !== undefined) set(els.tempAvg, fields.tempAvg.toFixed(1));

    // Humidity
    if (fields.humidity    !== undefined) set(els.humidity,    fields.humidity.toFixed(1));
    if (fields.humidityAvg !== undefined) set(els.humidityAvg, fields.humidityAvg.toFixed(1));

    // Battery — max expected ~14.5V for 12V lead-acid
    if (fields.battery !== undefined) {
      set(els.battery, fields.battery.toFixed(2));
      const pct = Math.min(100, Math.max(0, ((fields.battery - 10.5) / (14.5 - 10.5)) * 100));
      els.batteryBar.style.width = pct + '%';
      if (fields.battery < 11.0) {
        els.batteryBar.style.background = 'var(--red)';
      } else if (fields.battery < 12.0) {
        els.batteryBar.style.background = 'var(--yellow)';
      } else {
        els.batteryBar.style.background = 'var(--green)';
      }
    }
    if (fields.batteryLow) {
      els.batteryStatus.textContent = '⚠ BATTERY VOLTAGE LOW';
      els.batteryStatus.className   = 'status-indicator warn';
    } else if (fields.battery >= 11.0) {
      els.batteryStatus.textContent = '● OK';
      els.batteryStatus.className   = 'status-indicator ok';
    }

    // LLS type
    if (fields.llsType !== undefined) {
      set(els.llsType, fields.llsType);
      llsOutputHighAir = fields.llsType.toUpperCase().includes('HIGH IN AIR');
    }

    // LLS value
    if (fields.lls !== undefined) {
      set(els.lls, fields.lls.toFixed(2));
      updateLLSDot(fields.lls);
    }
    if (fields.llsAvg !== undefined) set(els.llsAvg, fields.llsAvg.toFixed(2));

    // Pump
    if (fields.pumpStart) {
      els.pumpStatus.textContent = 'RUNNING';
      els.pumpStatus.className   = 'pump-status running';
      set(els.pumpVoltage, '—');
      set(els.pumpCurrent, '—');
      set(els.pumpPower,   '—');
    }
    if (fields.pumpDone) {
      els.pumpStatus.textContent = 'IDLE';
      els.pumpStatus.className   = 'pump-status';
    }
    if (fields.pumpVoltage !== undefined) set(els.pumpVoltage, fields.pumpVoltage.toFixed(2) + ' V');
    if (fields.pumpCurrent !== undefined) set(els.pumpCurrent, fields.pumpCurrent.toFixed(2) + ' A');
    if (fields.pumpPower   !== undefined) set(els.pumpPower,   fields.pumpPower.toFixed(2)   + ' W');

    // Schedule / RTC
    if (fields.rtcTime     !== undefined) set(els.rtcTime,      fields.rtcTime);
    if (fields.timezone    !== undefined) set(els.tz,           'UTC' + (parseInt(fields.timezone) >= 0 ? '+' : '') + fields.timezone);
    if (fields.washHours   !== undefined) set(els.washHours,    fields.washHours);
    if (fields.washSecs    !== undefined) set(els.washSecs,     fields.washSecs + ' s');
    if (fields.freezeThresh !== undefined) set(els.freezeThresh, fields.freezeThresh + ' °C');
    if (fields.schedState  !== undefined) {
      set(els.schedState, fields.schedState);
      els.schedState.style.color = fields.schedState === 'NONE' ? '' : 'var(--yellow)';
    }
    if (fields.nextWashSec !== undefined) {
      const secs = fields.nextWashSec;
      if (secs > 86400 * 365) {
        set(els.nextWash, 'Not scheduled');
      } else if (secs > 3600) {
        set(els.nextWash, (secs / 3600).toFixed(2) + ' hr');
      } else {
        set(els.nextWash, secs + ' s');
      }
    }

    // System events
    if (fields.sysEvent) addEvent(fields.sysEvent, parsed?.level || 'INFO');
    if (fields.batteryLow) addEvent('Battery Voltage LOW', 'WARN');
  }

  function updateLLSDot(voltage) {
    // LOW IN AIR:  0V = air (dry),  ~3.3V = water detected
    // HIGH IN AIR: 0V = water,      ~3.3V = air (dry)  ← inverted
    let waterDetected;
    if (llsOutputHighAir) {
      waterDetected = voltage < 1.65; // high = air, low = water
    } else {
      waterDetected = voltage > 1.65; // low = air, high = water
    }
    els.llsDot.className = 'lls-dot ' + (waterDetected ? 'water' : 'air');
    els.llsLabel.textContent = waterDetected ? 'Water Detected' : 'In Air (Dry)';
  }

  // ── Events list ───────────────────────────────────────────
  const MAX_EVENTS = 30;
  function addEvent(text, level) {
    const li = document.createElement('li');
    const ts = new Date().toLocaleTimeString();
    li.textContent = `[${ts}] ${text}`;
    if (level === 'WARN')  li.className = 'event-warn';
    if (level === 'ERROR') li.className = 'event-error';
    els.events.prepend(li);
    while (els.events.children.length > MAX_EVENTS)
      els.events.removeChild(els.events.lastChild);
  }

  // ── Log rendering ─────────────────────────────────────────
  const MAX_LOG_LINES = 5000;
  let logLineCount = 0;

  function appendLog(raw, parsed) {
    rawLogLines.push(raw);
    const warnOnly = warnOnlyCheck.checked;
    if (warnOnly && parsed && parsed.level === 'INFO') return;

    const span = document.createElement('span');
    span.className = 'log-line';
    if (parsed) {
      span.classList.add('level-' + parsed.level.toLowerCase());
      span.innerHTML =
        `<span class="ts">${parsed.timestamp}</span>` +
        `<span class="cat">[${parsed.category}]</span>` +
        `<span class="lvl">${parsed.level}:</span>` +
        escapeHtml(parsed.message);
    } else {
      span.textContent = raw;
    }

    logContainer.appendChild(span);
    logLineCount++;

    // Trim old lines from DOM to prevent memory growth
    if (logLineCount > MAX_LOG_LINES) {
      logContainer.removeChild(logContainer.firstChild);
      logLineCount--;
    }

    if (autoScrollCheck.checked) {
      logContainer.scrollTop = logContainer.scrollHeight;
    }
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ── Run Wash button ───────────────────────────────────────
  els.runWashBtn.addEventListener('click', async () => {
    if (!Serial.isConnected()) {
      alert('Connect to a serial port first.');
      return;
    }
    await Serial.send('g');
  });

  // ── Repeat Pump button ────────────────────────────────────
  let repeatTimer  = null;
  let wakeLock     = null;

  async function stopRepeat() {
    clearInterval(repeatTimer);
    repeatTimer = null;
    if (wakeLock) { try { await wakeLock.release(); } catch (_) {} wakeLock = null; }
    els.repeatWashBtn.textContent = 'Start Auto-Pump';
    els.repeatWashBtn.classList.remove('active');
    els.repeatStatus.textContent = '';
    els.repeatInterval.disabled = false;
  }

  els.repeatWashBtn.addEventListener('click', async () => {
    if (repeatTimer) { stopRepeat(); return; }
    if (!Serial.isConnected()) { alert('Connect to a serial port first.'); return; }

    const secs = parseInt(els.repeatInterval.value, 10);
    if (secs > 60) {
      const ok = window.confirm(
        'This web application and tab must stay open to continually run the pump.\n' +
        'Verify your computer will not sleep or lock the screen while this is running.'
      );
      if (!ok) return;
    }

    // Request wake lock so the screen stays on (same mechanism browsers use for video)
    if ('wakeLock' in navigator) {
      try { wakeLock = await navigator.wakeLock.request('screen'); } catch (_) {}
    }

    const label = els.repeatInterval.options[els.repeatInterval.selectedIndex].text;
    els.repeatWashBtn.textContent = 'Stop Auto-Pump';
    els.repeatWashBtn.classList.add('active');
    els.repeatInterval.disabled = true;

    let nextIn = secs;
    const tick = () => {
      els.repeatStatus.textContent = `Next pump in ${nextIn}s`;
      nextIn--;
      if (nextIn < 0) nextIn = secs;
    };
    tick();

    // Fire immediately, then on each interval
    await Serial.send('g');
    repeatTimer = setInterval(async () => {
      if (!Serial.isConnected()) { stopRepeat(); addEvent('Repeat pump stopped — disconnected', 'WARN'); return; }
      nextIn--;
      if (nextIn <= 0) {
        nextIn = secs;
        await Serial.send('g');
      }
      els.repeatStatus.textContent = `Next pump in ${nextIn}s`;
    }, 1000);
  });

  // ── Wire up Serial callbacks ──────────────────────────────
  Serial.onLineReceived(raw => {
    const { parsed, fields } = Parser.process(raw);
    appendLog(raw, parsed);
    applyFields(fields, parsed);
    CmdStatus.onFields(fields, parsed);
    // Also mirror to config console if on config tab
    ConfigConsole.append(raw, parsed);
  });

  Serial.onConnected(() => {
    els.runWashBtn.disabled = false;
    els.repeatWashBtn.disabled = false;
    addEvent('Serial port connected', 'INFO');
  });

  Serial.onDisconnected(() => {
    els.runWashBtn.disabled = true;
    els.repeatWashBtn.disabled = true;
    stopRepeat();
    CmdStatus.unlockAll();
    addEvent('Serial port disconnected', 'WARN');
  });

  // Initially disable pump buttons
  els.runWashBtn.disabled = true;
  els.repeatWashBtn.disabled = true;

  return { applyFields, appendLog, addEvent };
})();

/* ============================================================
   ConfigConsole — mirrors log into the config tab console
   ============================================================ */
const ConfigConsole = (() => {
  const console_el = document.getElementById('configConsole');
  document.getElementById('clearConfigConsole').addEventListener('click', () => {
    console_el.innerHTML = '';
  });

  function append(raw, parsed) {
    const span = document.createElement('span');
    span.className = 'log-line';
    if (parsed) {
      span.classList.add('level-' + parsed.level.toLowerCase());
      span.textContent = `[${parsed.category}] ${parsed.level}: ${parsed.message}`;
    } else {
      span.textContent = raw;
    }
    console_el.appendChild(span);
    console_el.scrollTop = console_el.scrollHeight;
  }

  return { append };
})();

CmdStatus.init();
