/* ============================================================
   serial.js  Web Serial API wrapper
   ============================================================ */

const Serial = (() => {
  let port       = null;
  let portInfo   = null;   // { usbVendorId, usbProductId } saved at first connect
  let reader     = null;
  let writer     = null;
  let running    = false;
  let connecting = false;
  let dropHandled   = false;
  let autoReconnect = false;
  let reconnectTimer    = null;
  let reconnectAttempts = 0;

  // Each attempt: wait 2 s, then try open() for up to 3 s.
  const RECONNECT_DELAY_MS = 2000;
  const OPEN_TIMEOUT_MS    = 3000;

  let onLine       = null;
  let onConnect    = null;
  let onDisconnect = null;

  const connectBtn  = document.getElementById('connectBtn');
  const statusBadge = document.getElementById('connectionStatus');
  const baudSelect  = document.getElementById('baudSelect');

  function setConnected(yes) {
    if (yes) {
      connectBtn.textContent = 'Disconnect';
      connectBtn.classList.add('connected');
      statusBadge.textContent = 'Connected';
      statusBadge.className = 'status-badge connected';
    } else {
      connectBtn.textContent = 'Connect Serial Port';
      connectBtn.classList.remove('connected');
      statusBadge.textContent = 'Disconnected';
      statusBadge.className = 'status-badge disconnected';
    }
  }

  // ---- First-time / user-initiated connect -----------------
  async function connect() {
    if (connecting) return;
    connecting = true;

    if (!('serial' in navigator)) {
      connecting = false;
      alert('Web Serial API is not supported in this browser.\nUse Google Chrome or Microsoft Edge.');
      return;
    }

    try {
      port     = await navigator.serial.requestPort();
      portInfo = port.getInfo();
      await _openAndRead();
    } catch (e) {
      connecting = false;
      // User cancelled the picker or open failed  do nothing
    }
  }

  // ---- Auto-reconnect: uses getPorts()  NO dialog --------
  // After a device reset the old port object is stale. getPorts() returns
  // the freshly re-enumerated port object for the same physical device.
  async function _reconnect() {
    if (!autoReconnect || running || connecting) return;
    connecting = true;

    try {
      const ports = await navigator.serial.getPorts();
      if (ports.length === 0) {
        connecting = false;
        _scheduleReconnect();
        return;
      }

      // Match by USB vendor/product ID; fall back to first port.
      let target = ports.find(p => {
        const info = p.getInfo();
        return portInfo &&
          info.usbVendorId  === portInfo.usbVendorId &&
          info.usbProductId === portInfo.usbProductId;
      }) || ports[0];

      port = target;
      await _openAndRead();
    } catch (e) {
      connecting = false;
      _scheduleReconnect();
    }
  }

  // ---- Shared: open the port and start reading -------------
  async function _openAndRead() {
    const baud = parseInt(baudSelect.value, 10);

    await Promise.race([
      port.open({ baudRate: baud }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('OpenTimeout')), OPEN_TIMEOUT_MS)
      ),
    ]);

    connecting        = false;
    dropHandled       = false;
    autoReconnect     = true;
    reconnectAttempts = 0;
    clearTimeout(reconnectTimer);
    running = true;
    setConnected(true);
    if (onConnect) onConnect();

    writer = port.writable.getWriter();
    reader = port.readable.getReader();
    const decoder = new TextDecoder();
    let lineBuffer = '';

    (async () => {
      try {
        while (running) {
          const { value, done } = await reader.read();
          if (done) break;
          lineBuffer += decoder.decode(value, { stream: true });
          const parts = lineBuffer.split(/\r?\n/);
          lineBuffer = parts.pop();
          for (const line of parts) {
            if (onLine) onLine(line);
          }
        }
      } catch (_) {
        // NetworkError: device lost
      } finally {
        _handlePortDrop();
      }
    })();
  }

  function _handlePortDrop() {
    if (dropHandled) return;
    dropHandled       = true;
    running           = false;
    connecting        = false;
    reconnectAttempts = 0;

    try { reader.releaseLock(); } catch (_) {}
    reader = null;
    try { writer.releaseLock(); } catch (_) {}
    writer = null;
    // Do NOT call port.close()  device is gone, close() hangs.

    setConnected(false);
    if (onDisconnect) onDisconnect();
    if (autoReconnect) _scheduleReconnect();
  }

  function _scheduleReconnect() {
    clearTimeout(reconnectTimer);
    reconnectAttempts++;
    statusBadge.textContent = 'Reconnecting... (' + reconnectAttempts + ')';
    statusBadge.className = 'status-badge reconnecting';
    reconnectTimer = setTimeout(_reconnect, RECONNECT_DELAY_MS);
  }

  async function disconnect(userInitiated) {
    autoReconnect = false;
    clearTimeout(reconnectTimer);
    running    = false;
    connecting = false;
    try { if (reader) reader.releaseLock(); } catch (_) {}
    reader = null;
    try { if (writer) writer.releaseLock(); } catch (_) {}
    writer = null;
    try { if (port) await port.close(); } catch (_) {}
    port = null;
    setConnected(false);
    if (onDisconnect) onDisconnect();
  }

  async function send(text) {
    if (!writer) { console.warn('Serial not connected'); return; }
    try {
      await writer.write(new TextEncoder().encode(text));
    } catch (e) {
      console.error('Serial write error:', e);
    }
  }

  async function sendLine(text) { await send(text + '\r\n'); }

  function onLineReceived(cb) { onLine = cb; }
  function onConnected(cb)    { onConnect = cb; }
  function onDisconnected(cb) { onDisconnect = cb; }
  function isConnected()      { return running && port !== null; }

  connectBtn.addEventListener('click', () => {
    if (running) {
      disconnect(true);
    } else {
      autoReconnect = false;
      connecting    = false;
      clearTimeout(reconnectTimer);
      port = null;
      connect();
    }
  });

  return { connect, disconnect, send, sendLine, onLineReceived, onConnected, onDisconnected, isConnected };
})();