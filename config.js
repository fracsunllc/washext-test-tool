/* ============================================================
   config.js — Configuration tab command logic
   ============================================================
   All commands are sent via Serial.send() / Serial.sendLine().
   Multi-step menus are handled by sending the opening key,
   waiting a moment, then sending the sub-command / value.
   ============================================================ */

(async () => {
  // Small helper: sequential send with a delay between steps.
  // This gives the firmware time to display its prompt before
  // we send the next byte — matching how a human would type.
  async function seq(...steps) {
    for (const step of steps) {
      if (!Serial.isConnected()) {
        alert('Serial port disconnected.');
        return;
      }
      if (typeof step === 'number') {
        await new Promise(r => setTimeout(r, step));
      } else {
        await Serial.send(step);
      }
    }
  }

  // Require a connected port; alert and return false if not.
  function requireConn() {
    if (!Serial.isConnected()) {
      alert('Connect to a serial port first.');
      return false;
    }
    return true;
  }

  // Simple confirmation dialog.
  function confirm(msg) {
    return window.confirm(msg);
  }

  // ── Password gate (SHA-256 hash comparison) ───────────────
  // Only the hash is stored here — not the plaintext password.
  // To change the password, run this in the browser console:
  //   crypto.subtle.digest('SHA-256', new TextEncoder().encode('NEW_PASS'))
  //     .then(b => console.log([...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')))
  const SN_HASH = '79fda75e5082f3fc88ca6af637df65ac199322be051333a96626e55583c04cfa';

  async function checkPassword(promptText) {
    const input = window.prompt(promptText || 'Enter password:');
    if (input === null) return false; // cancelled
    const buf  = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
    const hash = [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, '0')).join('');
    if (hash !== SN_HASH) {
      alert('Incorrect password.');
      return false;
    }
    return true;
  }

  // ── Matcher helpers ───────────────────────────────────────
  // True when the parsed log message matches a regex pattern
  const msg   = pattern => (f, p) => !!(p && pattern.test(p.message));
  // True when any of the named parser fields is present
  const field = (...names) => (f, p) => !!(f && names.some(n => f[n] !== undefined));
  // True when any of the provided matcher functions returns true
  const any   = (...fns)  => (f, p) => fns.some(fn => fn(f, p));

  // ── Generic one-key + sub-command buttons ─────────────────
  // Handles buttons with data-cmd like "m2", "r8", "w1", "E", "F"
  //
  // Success matchers are derived from the exact firmware Log() messages
  // in process_serial_function.cs.  Commands that call System.reset()
  // are also covered by watching for the firmware boot field.
  const CMD_META = {
    'm2': { section: 'modbus',      timeout: 15000,
            match: any(msg(/Modbus Slave mode ON/i),  msg(/Slave mode is already ON/i),  field('firmware')) },
    'm3': { section: 'modbus',      timeout: 15000,
            match: any(msg(/Modbus Slave mode OFF/i), msg(/Slave mode is already OFF/i), field('firmware')) },
    'm7': { section: 'modbus',      timeout: 20000,
            match: any(msg(/Resetting modbus factory defaults now/i), field('firmware')) },
    'r8': { section: 'rtc',         timeout:  8000,
            match: msg(/Liquid level sensor now set to/i) },
    'w1': { section: 'wifi',        timeout: 20000,
            match: any(msg(/WiFi mode ON/i),  field('firmware')) },
    'w2': { section: 'wifi',        timeout: 15000,
            match: any(msg(/WiFi mode OFF/i), field('firmware')) },
    'E':  { section: 'maintenance', timeout:  8000,
            match: any(field('pumpStart'), msg(/Running cleaning routine/i)) },
    'F':  { section: 'maintenance', timeout: 30000,
            match: any(msg(/Resetting to factory defaults now/i), field('firmware')) },
  };

  document.querySelectorAll('[data-cmd]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!requireConn()) return;
      const confirmMsg = btn.dataset.confirm;
      if (confirmMsg && !confirm(confirmMsg)) return;

      const cmd  = btn.dataset.cmd;
      const meta = CMD_META[cmd];

      CmdStatus.lockAll();
      if (meta) CmdStatus.setSending(meta.section);
      // Set up waiter BEFORE seq so responses during the sequence are captured
      const waiter = meta
        ? CmdStatus.waitForMatch(meta.match, meta.timeout)
        : Promise.resolve(false);

      if (cmd.length === 1) {
        // Single character command (E, F, etc.)
        // 'x' first exits any open menu; harmless if already at main prompt
        await seq('x', 200, cmd, 200, 'y');
      } else {
        // Two-character: menu key then option (e.g. 'm2' → 'm', delay, '2')
        const menuKey = cmd[0];
        const optKey  = cmd.slice(1);
        await seq('x', 200, menuKey, 400, optKey, 300, 'y');
      }

      if (meta) {
        if (await waiter) CmdStatus.setSuccess(meta.section);
        else              CmdStatus.setFailed(meta.section);
      } else {
        CmdStatus.unlockAll();
      }
    });
  });

  // ── Modbus: Set Slave Address ─────────────────────────────
  document.getElementById('cfg-setMbAddr').addEventListener('click', async () => {
    if (!requireConn()) return;
    const val = document.getElementById('cfg-mbAddr').value.trim();
    const num = parseInt(val, 10);
    if (isNaN(num) || num < 1 || num > 255) {
      alert('Enter a valid slave address between 1 and 255.');
      return;
    }
    CmdStatus.lockAll();
    CmdStatus.setSending('modbus');
    const waiter = CmdStatus.waitForMatch(msg(/>> New slave address saved/i), 5000);
    // 'x' exits any open menu before entering modbus menu
    await seq('x', 200, 'm', 400, '4', 300, val + '\r\n');
    if (await waiter) CmdStatus.setSuccess('modbus');
    else              CmdStatus.setFailed('modbus');
  });

  // ── Modbus: Set Baud Rate ─────────────────────────────────
  document.getElementById('cfg-setMbBaud').addEventListener('click', async () => {
    if (!requireConn()) return;
    const val = document.getElementById('cfg-mbBaud').value;
    CmdStatus.lockAll();
    CmdStatus.setSending('modbus');
    const waiter = CmdStatus.waitForMatch(msg(/>> New baud rate saved/i), 5000);
    await seq('x', 200, 'm', 400, '5', 300, val + '\r\n');
    if (await waiter) CmdStatus.setSuccess('modbus');
    else              CmdStatus.setFailed('modbus');
  });

  // ── Modbus: Set Serial Config ─────────────────────────────
  document.getElementById('cfg-setMbSerial').addEventListener('click', async () => {
    if (!requireConn()) return;
    const val = document.getElementById('cfg-mbSerial').value;
    if (!confirm(`Set Modbus serial config code ${val}?`)) return;
    CmdStatus.lockAll();
    CmdStatus.setSending('modbus');
    // Both "saved" and "failed" count as "processed" (we show ✓ for either)
    const waiter = CmdStatus.waitForMatch(msg(/Modbus config saved|Modbus config failed/i), 8000);
    await seq('x', 200, 'm', 400, '6', 300, val + '\r\n', 300, 'y');
    if (await waiter) CmdStatus.setSuccess('modbus');
    else              CmdStatus.setFailed('modbus');
  });

  // ── RTC: Set Date & Time ──────────────────────────────────
  document.getElementById('cfg-setDateTime').addEventListener('click', async () => {
    if (!requireConn()) return;
    const tz     = document.getElementById('cfg-tz').value.trim();
    const year   = document.getElementById('cfg-year').value.trim();
    const month  = document.getElementById('cfg-month').value.trim();
    const day    = document.getElementById('cfg-day').value.trim();
    const hour   = document.getElementById('cfg-hour').value.trim();
    const minute = document.getElementById('cfg-minute').value.trim();

    if (!tz || !year || !month || !day || !hour || !minute) {
      alert('Fill in all date/time fields.');
      return;
    }
    if (!confirm(`Set date/time: ${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')} ${hour.padStart(2,'0')}:${minute.padStart(2,'0')} TZ${tz}?`)) return;

    CmdStatus.lockAll();
    CmdStatus.setSending('rtc');
    const waiter = CmdStatus.waitForMatch(msg(/Time set! New time is/i), 8000);
    // menu r → 2 → timezone → year → month → day → hour → minute
    await seq(
      'x', 200,
      'r', 400,
      '2', 400,
      tz     + '\r\n', 400,
      year   + '\r\n', 400,
      month  + '\r\n', 400,
      day    + '\r\n', 400,
      hour   + '\r\n', 400,
      minute + '\r\n'
    );
    if (await waiter) CmdStatus.setSuccess('rtc');
    else              CmdStatus.setFailed('rtc');
  });

  // ── RTC: Set Timezone Only ────────────────────────────────
  document.getElementById('cfg-setTzOnly').addEventListener('click', async () => {
    if (!requireConn()) return;
    const tz = document.getElementById('cfg-tzOnly').value.trim();
    const num = parseInt(tz, 10);
    if (isNaN(num) || num < -12 || num > 14) {
      alert('Enter a valid timezone between -12 and 14.');
      return;
    }
    CmdStatus.lockAll();
    CmdStatus.setSending('rtc');
    const waiter = CmdStatus.waitForMatch(msg(/Timezone retained in Flash memory/i), 5000);
    await seq('x', 200, 'r', 400, '3', 300, tz + '\r\n');
    if (await waiter) CmdStatus.setSuccess('rtc');
    else              CmdStatus.setFailed('rtc');
  });

  // ── RTC: AutoWash Hours ───────────────────────────────────
  document.getElementById('cfg-setWashHours').addEventListener('click', async () => {
    if (!requireConn()) return;
    const h1 = document.getElementById('cfg-washHour1').value.trim();
    const h2 = document.getElementById('cfg-washHour2').value.trim();
    const h3 = document.getElementById('cfg-washHour3').value.trim();
    if (!h1 || !h2 || !h3) { alert('Enter all 3 wash hours (use 25 to disable a slot).'); return; }
    if (!confirm(`Set wash hours to ${h1}, ${h2}, ${h3}?`)) return;
    CmdStatus.lockAll();
    CmdStatus.setSending('rtc');
    // Wait for the last of the three confirmations from firmware
    const waiter = CmdStatus.waitForMatch(msg(/3rd AutoWash Hour saved/i), 10000);
    await seq(
      'x', 200,
      'r', 400,
      '5', 400,
      h1 + '\r\n', 400,
      h2 + '\r\n', 400,
      h3 + '\r\n'
    );
    if (await waiter) CmdStatus.setSuccess('rtc');
    else              CmdStatus.setFailed('rtc');
  });

  // ── RTC: Wash Seconds ─────────────────────────────────────
  document.getElementById('cfg-setWashSecs').addEventListener('click', async () => {
    if (!requireConn()) return;
    const val = document.getElementById('cfg-washSecs').value.trim();
    const num = parseInt(val, 10);
    if (isNaN(num) || num < 0 || num > 900) { alert('Enter seconds between 0 and 900.'); return; }
    CmdStatus.lockAll();
    CmdStatus.setSending('rtc');
    const waiter = CmdStatus.waitForMatch(msg(/# Wash seconds saved/i), 5000);
    await seq('x', 200, 'r', 400, '6', 300, val + '\r\n');
    if (await waiter) CmdStatus.setSuccess('rtc');
    else              CmdStatus.setFailed('rtc');
  });

  // ── RTC: Freeze Threshold ─────────────────────────────────
  document.getElementById('cfg-setFreeze').addEventListener('click', async () => {
    if (!requireConn()) return;
    const val = document.getElementById('cfg-freezeC').value.trim();
    const num = parseInt(val, 10);
    if (isNaN(num) || num < -40 || num > 5) { alert('Enter a temperature between -40 and 5 °C.'); return; }
    CmdStatus.lockAll();
    CmdStatus.setSending('rtc');
    const waiter = CmdStatus.waitForMatch(msg(/Skip wash freezing threshold saved/i), 5000);
    await seq('x', 200, 'r', 400, '7', 300, val + '\r\n');
    if (await waiter) CmdStatus.setSuccess('rtc');
    else              CmdStatus.setFailed('rtc');
  });

  // ── Maintenance: Set Serial Number ────────────────────────
  document.getElementById('cfg-setSN').addEventListener('click', async () => {
    if (!requireConn()) return;
    if (!await checkPassword('Enter password to set serial number:')) return;
    const val = document.getElementById('cfg-sn').value.trim();
    const num = parseInt(val, 10);
    if (isNaN(num) || num < 1 || num > 9999) { alert('Enter a serial number between 1 and 9999.'); return; }
    if (!confirm(`Set serial number to WE3-${val.padStart(2,'0')}?`)) return;
    CmdStatus.lockAll();
    CmdStatus.setSending('maintenance');
    const waiter = CmdStatus.waitForMatch(msg(/New WEC Serial Number saved/i), 5000);
    await seq('x', 200, 'S', 400, val + '\r\n');
    if (await waiter) CmdStatus.setSuccess('maintenance');
    else              CmdStatus.setFailed('maintenance');
  });

  // ── Raw Command ───────────────────────────────────────────
  const rawInput = document.getElementById('cfg-rawCmd');
  document.getElementById('cfg-sendRaw').addEventListener('click', async () => {
    if (!requireConn()) return;
    const raw = rawInput.value;
    if (!raw) return;
    CmdStatus.lockAll();
    await Serial.send(raw);
    rawInput.value = '';
    CmdStatus.unlockAll();
  });
  rawInput.addEventListener('keydown', async e => {
    if (e.key === 'Enter') {
      if (!requireConn()) return;
      const raw = rawInput.value;
      if (!raw) return;
      CmdStatus.lockAll();
      await Serial.sendLine(raw);
      rawInput.value = '';
      CmdStatus.unlockAll();
    }
  });
})();

