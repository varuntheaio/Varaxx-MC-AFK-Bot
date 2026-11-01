const mineflayer = require('mineflayer');
const { Movements, pathfinder, goals } = require('mineflayer-pathfinder');
const { GoalBlock } = goals;
const config = require('./settings.json');
const express = require('express');
const http = require('http');

// ============================================================
// EXPRESS SERVER - Keep Render/Aternos alive
// ============================================================
const app = express();
const PORT = process.env.PORT || 5000;

// Bot state tracking
let botState = {
  connected: false,
  userDisconnected: false,
  lastActivity: Date.now(),
  reconnectAttempts: 0,
  startTime: Date.now(),
  errors: []
};

// Health check and Dashboard endpoints
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <title>${config.name} - Control Dashboard</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { 
            font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif; 
            background: #090d16; 
            color: #f1f5f9; 
            min-height: 100vh; 
            display: flex; 
            justify-content: center; 
            align-items: center; 
            padding: 20px;
            overflow-x: hidden;
            background-image: 
              radial-gradient(at 0% 0%, rgba(16, 185, 129, 0.12) 0px, transparent 50%),
              radial-gradient(at 100% 100%, rgba(56, 189, 248, 0.1) 0px, transparent 50%);
          }
          .dashboard {
            background: rgba(19, 27, 46, 0.85);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            padding: 32px;
            border-radius: 24px;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5), 0 0 40px rgba(16, 185, 129, 0.1);
            width: 100%;
            max-width: 480px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
          }
          .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 24px;
            padding-bottom: 16px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          }
          .brand {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .brand-icon {
            width: 42px;
            height: 42px;
            background: linear-gradient(135deg, #10b981, #059669);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 0 20px rgba(16, 185, 129, 0.4);
          }
          .brand-icon svg { width: 24px; height: 24px; fill: none; stroke: #ffffff; stroke-width: 2; }
          h1 { font-size: 20px; font-weight: 700; color: #f8fafc; letter-spacing: -0.5px; }
          .sub-title { font-size: 12px; color: #64748b; font-weight: 500; }
          
          .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 6px 14px;
            border-radius: 30px;
            font-size: 13px;
            font-weight: 600;
            background: rgba(15, 23, 42, 0.6);
            border: 1px solid rgba(255, 255, 255, 0.08);
            transition: all 0.3s ease;
          }
          .status-dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background-color: #94a3b8;
            box-shadow: 0 0 10px currentColor;
            transition: all 0.3s ease;
          }
          .pulse { animation: pulse 1.8s infinite; }
          @keyframes pulse {
            0% { transform: scale(0.95); opacity: 0.8; }
            50% { transform: scale(1.15); opacity: 1; }
            100% { transform: scale(0.95); opacity: 0.8; }
          }

          /* Control Buttons Panel */
          .controls-panel {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-bottom: 24px;
          }
          .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 14px 20px;
            border-radius: 14px;
            font-family: inherit;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            border: none;
            outline: none;
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            user-select: none;
          }
          .btn-connect {
            background: linear-gradient(135deg, #10b981 0%, #047857 100%);
            color: #ffffff;
            box-shadow: 0 4px 20px rgba(16, 185, 129, 0.35);
          }
          .btn-connect:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 6px 24px rgba(16, 185, 129, 0.5);
            background: linear-gradient(135deg, #34d399 0%, #059669 100%);
          }
          .btn-disconnect {
            background: linear-gradient(135deg, #f43f5e 0%, #be123c 100%);
            color: #ffffff;
            box-shadow: 0 4px 20px rgba(244, 63, 94, 0.35);
          }
          .btn-disconnect:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 6px 24px rgba(244, 63, 94, 0.5);
            background: linear-gradient(135deg, #fb7185 0%, #e11d48 100%);
          }
          .btn:active:not(:disabled) { transform: translateY(0) scale(0.98); }
          .btn:disabled {
            opacity: 0.45;
            cursor: not-allowed;
            filter: grayscale(40%);
            box-shadow: none !important;
            transform: none !important;
          }
          .btn svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2.2; }

          /* Stat Cards */
          .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-bottom: 20px;
          }
          .card {
            background: rgba(15, 23, 42, 0.6);
            padding: 16px;
            border-radius: 16px;
            border: 1px solid rgba(255, 255, 255, 0.05);
            transition: border-color 0.3s ease;
          }
          .card.full { grid-column: span 2; }
          .card-label { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 600; margin-bottom: 6px; }
          .card-value { font-size: 16px; font-weight: 600; color: #38bdf8; word-break: break-all; }

          .toast {
            font-size: 12px;
            text-align: center;
            padding: 10px 14px;
            border-radius: 10px;
            background: rgba(30, 41, 59, 0.8);
            border: 1px solid rgba(255, 255, 255, 0.08);
            color: #cbd5e1;
            margin-bottom: 20px;
            min-height: 38px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s ease;
          }

          .footer-links {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-top: 10px;
            font-size: 12px;
          }
          .btn-guide {
            color: #38bdf8;
            text-decoration: none;
            font-weight: 500;
            transition: color 0.2s;
          }
          .btn-guide:hover { color: #7dd3fc; text-decoration: underline; }
          .live-txt { color: #64748b; }
        </style>
      </head>
      <body>
        <div class="dashboard" id="dash">
          <div class="header">
            <div class="brand">
              <div class="brand-icon">
                <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              </div>
              <div>
                <h1>${config.name}</h1>
                <div class="sub-title">${config.server.ip}</div>
              </div>
            </div>
            <div class="status-badge" id="status-badge">
              <span class="status-dot pulse" id="status-dot"></span>
              <span id="status-text">Loading...</span>
            </div>
          </div>

          <!-- CONNECT & DISCONNECT CONTROL PANEL -->
          <div class="controls-panel">
            <button class="btn btn-connect" id="btn-connect" onclick="triggerConnect()">
              <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M12 5l7 7-7 7"/></svg>
              Connect Bot
            </button>
            <button class="btn btn-disconnect" id="btn-disconnect" onclick="triggerDisconnect()">
              <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
              Disconnect
            </button>
          </div>

          <!-- TOAST / NOTIFICATION MESSAGES -->
          <div class="toast" id="toast-msg">Ready - Monitoring connection</div>

          <!-- STATS GRID -->
          <div class="grid">
            <div class="card">
              <div class="card-label">Bot Username</div>
              <div class="card-value" style="color: #f1f5f9;">${config['bot-account'].username}</div>
            </div>
            <div class="card">
              <div class="card-label">Uptime</div>
              <div class="card-value" id="uptime-val">0h 0m 0s</div>
            </div>
            <div class="card full">
              <div class="card-label">Live Coordinates</div>
              <div class="card-value" id="coords-val">Waiting for spawn...</div>
            </div>
            <div class="card">
              <div class="card-label">Server Port</div>
              <div class="card-value">${config.server.port}</div>
            </div>
            <div class="card">
              <div class="card-label">Minecraft Ver</div>
              <div class="card-value">${config.server.version}</div>
            </div>
          </div>

          <div class="footer-links">
            <a href="/tutorial" class="btn-guide">📘 View Setup Guide</a>
            <span class="live-txt">Live Web Socket API</span>
          </div>
        </div>

        <script>
          const formatUptime = (seconds) => {
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = seconds % 60;
            return \`\${h}h \${m}m \${s}s\`;
          };

          const setToast = (msg, isError = false) => {
            const toast = document.getElementById('toast-msg');
            toast.innerText = msg;
            toast.style.borderColor = isError ? 'rgba(244, 63, 94, 0.4)' : 'rgba(16, 185, 129, 0.4)';
          };

          const triggerConnect = async () => {
            const btnConnect = document.getElementById('btn-connect');
            btnConnect.disabled = true;
            setToast('⚡ Initiating fast connection attempt...');
            try {
              const res = await fetch('/api/connect', { method: 'POST' });
              const data = await res.json();
              setToast(data.message || 'Connecting bot...');
            } catch (e) {
              setToast('Error connecting: ' + e.message, true);
            }
            setTimeout(updateStats, 500);
          };

          const triggerDisconnect = async () => {
            const btnDisconnect = document.getElementById('btn-disconnect');
            btnDisconnect.disabled = true;
            setToast('🛑 Disconnecting bot...');
            try {
              const res = await fetch('/api/disconnect', { method: 'POST' });
              const data = await res.json();
              setToast(data.message || 'Bot disconnected.');
            } catch (e) {
              setToast('Error disconnecting: ' + e.message, true);
            }
            setTimeout(updateStats, 500);
          };

          const updateStats = async () => {
            try {
              const res = await fetch('/health');
              const data = await res.json();
              
              const statusDot = document.getElementById('status-dot');
              const statusText = document.getElementById('status-text');
              const uptimeVal = document.getElementById('uptime-val');
              const coordsVal = document.getElementById('coords-val');
              const btnConnect = document.getElementById('btn-connect');
              const btnDisconnect = document.getElementById('btn-disconnect');

              if (data.status === 'connected') {
                statusText.innerText = 'Online & Active';
                statusText.style.color = '#34d399';
                statusDot.style.backgroundColor = '#10b981';
                statusDot.style.boxShadow = '0 0 12px #10b981';
                btnConnect.disabled = true;
                btnDisconnect.disabled = false;
              } else if (data.status === 'connecting') {
                statusText.innerText = 'Connecting...';
                statusText.style.color = '#38bdf8';
                statusDot.style.backgroundColor = '#38bdf8';
                statusDot.style.boxShadow = '0 0 12px #38bdf8';
                btnConnect.disabled = true;
                btnDisconnect.disabled = false;
              } else if (data.userDisconnected) {
                statusText.innerText = 'Stopped (User)';
                statusText.style.color = '#fb7185';
                statusDot.style.backgroundColor = '#f43f5e';
                statusDot.style.boxShadow = '0 0 12px #f43f5e';
                btnConnect.disabled = false;
                btnDisconnect.disabled = true;
              } else {
                statusText.innerText = 'Reconnecting...';
                statusText.style.color = '#fbbf24';
                statusDot.style.backgroundColor = '#f59e0b';
                statusDot.style.boxShadow = '0 0 12px #f59e0b';
                btnConnect.disabled = false;
                btnDisconnect.disabled = false;
              }

              uptimeVal.innerText = formatUptime(data.uptime);

              if (data.coords) {
                coordsVal.innerText = \`X: \${Math.floor(data.coords.x)}  Y: \${Math.floor(data.coords.y)}  Z: \${Math.floor(data.coords.z)}\`;
                coordsVal.style.color = '#34d399';
              } else {
                coordsVal.innerText = data.status === 'connected' ? 'Locating...' : 'Not in world';
                coordsVal.style.color = '#94a3b8';
              }

            } catch (e) {
              document.getElementById('status-text').innerText = 'Offline';
              document.getElementById('status-dot').style.backgroundColor = '#64748b';
            }
          };

          setInterval(updateStats, 1000);
          updateStats();
        </script>
      </body>
    </html>
  `);
});

// Control API Endpoints
app.post('/api/connect', (req, res) => {
  connectBot();
  res.json({ success: true, message: 'Fast connection sequence started!' });
});

app.get('/api/connect', (req, res) => {
  connectBot();
  res.json({ success: true, message: 'Fast connection sequence started!' });
});

app.post('/api/disconnect', (req, res) => {
  disconnectBot();
  res.json({ success: true, message: 'Bot disconnected manually.' });
});

app.get('/api/disconnect', (req, res) => {
  disconnectBot();
  res.json({ success: true, message: 'Bot disconnected manually.' });
});

app.get('/tutorial', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>${config.name} - Setup Guide</title>
        <style>
          body { font-family: 'Segoe UI', sans-serif; background: #0f172a; color: #cbd5e1; padding: 40px; max-width: 800px; margin: 0 auto; line-height: 1.6; }
          h1, h2 { color: #2dd4bf; }
          h1 { border-bottom: 2px solid #334155; padding-bottom: 10px; }
          .card { background: #1e293b; padding: 25px; border-radius: 12px; margin-bottom: 20px; border: 1px solid #334155; }
          a { color: #38bdf8; text-decoration: none; }
          code { background: #334155; padding: 2px 6px; border-radius: 4px; color: #e2e8f0; font-family: monospace; }
          .btn-home { display: inline-block; margin-bottom: 20px; padding: 8px 16px; background: #334155; color: white; border-radius: 6px; text-decoration: none; }
        </style>
      </head>
      <body>
        <a href="/" class="btn-home">Back to Dashboard</a>
        <h1>Setup Guide (Under 15 Minutes)</h1>
        
        <div class="card">
          <h2>Step 1: Configure Aternos</h2>
          <ol>
            <li>Go to <strong>Aternos</strong>.</li>
            <li>Install <strong>Paper/Bukkit</strong> software.</li>
            <li>Enable <strong>Cracked</strong> mode (Green Switch).</li>
            <li>Install Plugins: <code>ViaVersion</code>, <code>ViaBackwards</code>, <code>ViaRewind</code>.</li>
          </ol>
        </div>

        <div class="card">
          <h2>Step 2: GitHub Setup</h2>
          <ol>
            <li>Download this code as ZIP and extract.</li>
            <li>Edit <code>settings.json</code> with your IP/Port.</li>
            <li>Upload all files to a new <strong>GitHub Repository</strong>.</li>
          </ol>
        </div>

        <div class="card">
          <h2>Step 3: Render (Free 24/7 Hosting)</h2>
          <ol>
            <li>Go to <a href="https://render.com" target="_blank">Render.com</a> and create a Web Service.</li>
            <li>Connect your GitHub.</li>
            <li>Build Command: <code>npm install</code></li>
            <li>Start Command: <code>npm start</code></li>
            <li><strong>Magic:</strong> The bot automatically pings itself to stay awake!</li>
          </ol>
        </div>
        
        <p style="text-align: center; margin-top: 40px; color: #64748b;">AFK Bot Dashboard</p>
      </body>
    </html>
  `);
});

app.get('/health', (req, res) => {
  let statusStr = 'disconnected';
  if (botState.connected) {
    statusStr = 'connected';
  } else if (isReconnecting) {
    statusStr = 'connecting';
  } else if (botState.userDisconnected) {
    statusStr = 'stopped';
  }

  res.json({
    status: statusStr,
    connected: botState.connected,
    userDisconnected: botState.userDisconnected,
    isReconnecting: isReconnecting,
    uptime: Math.floor((Date.now() - botState.startTime) / 1000),
    coords: (bot && bot.entity && bot.entity.position) ? bot.entity.position : null,
    server: `${config.server.ip}:${config.server.port}`,
    username: config['bot-account'].username,
    lastActivity: botState.lastActivity,
    reconnectAttempts: botState.reconnectAttempts,
    memoryUsage: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)
  });
});

app.get('/ping', (req, res) => res.send('pong'));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] HTTP server started on port ${PORT}`);
});

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h ${m}m ${s}s`;
}

// ============================================================
// SELF-PING - Prevent Render from sleeping
// ============================================================
const SELF_PING_INTERVAL = 10 * 60 * 1000; // 10 minutes

const https = require('https');

function startSelfPing() {
  setInterval(() => {
    const url = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
    const protocol = url.startsWith('https') ? https : http;

    protocol.get(`${url}/ping`, (res) => {
      // console.log(`[KeepAlive] Self-ping: ${res.statusCode}`); // Optional: reduce spam
    }).on('error', (err) => {
      console.log(`[KeepAlive] Self-ping failed: ${err.message}`);
    });
  }, SELF_PING_INTERVAL);
  console.log('[KeepAlive] Self-ping system started (every 10 min)');
}

startSelfPing();

// ============================================================
// MEMORY MONITORING
// ============================================================
setInterval(() => {
  const mem = process.memoryUsage();
  const heapMB = (mem.heapUsed / 1024 / 1024).toFixed(2);
  console.log(`[Memory] Heap: ${heapMB} MB`);
}, 5 * 60 * 1000); // Every 5 minutes

// ============================================================
// BOT CREATION WITH RECONNECTION LOGIC
// ============================================================
let bot = null;
let activeIntervals = [];
let reconnectTimeout = null;
let isReconnecting = false;

function connectBot() {
  console.log('[Bot] Manual connection initiated via dashboard');
  botState.userDisconnected = false;
  isReconnecting = false;
  botState.reconnectAttempts = 0;
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  createBot();
}

function disconnectBot() {
  console.log('[Bot] Manual disconnection initiated via dashboard');
  botState.userDisconnected = true;
  botState.connected = false;
  isReconnecting = false;
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  clearAllIntervals();
  if (bot) {
    try {
      bot.removeAllListeners();
      bot.quit();
    } catch (e) {
      try { if (bot) bot.end(); } catch (err) { }
    }
    bot = null;
  }
}

function clearAllIntervals() {
  console.log(`[Cleanup] Clearing ${activeIntervals.length} intervals`);
  activeIntervals.forEach(id => clearInterval(id));
  activeIntervals = [];
}

function addInterval(callback, delay) {
  const id = setInterval(callback, delay);
  activeIntervals.push(id);
  return id;
}

function getReconnectDelay() {
  const baseDelay = config.utils['auto-reconnect-delay'] || 1000;
  const maxDelay = config.utils['max-reconnect-delay'] || 5000;

  const delay = Math.min(baseDelay + (botState.reconnectAttempts * 500), maxDelay);
  return delay;
}

function createBot() {
  if (isReconnecting) {
    console.log('[Bot] Already reconnecting, skipping...');
    return;
  }

  // Cleanup previous bot instance safely
  if (bot) {
    clearAllIntervals();
    try {
      bot.removeAllListeners();
      bot.end();
    } catch (e) {
      console.log('[Cleanup] Error ending previous bot:', e.message);
    }
    bot = null;
  }

  let targetVersion = config.server.version;
  try {
    if (targetVersion && targetVersion !== 'auto' && targetVersion !== '1.21.11') {
      require('minecraft-data')(targetVersion);
    } else {
      targetVersion = false; // Enable automatic server protocol detection
    }
  } catch (e) {
    console.log(`[Version Check] "${targetVersion}" is not a valid Minecraft version. Using auto-detection.`);
    targetVersion = false;
  }

  console.log(`[Bot] Creating bot instance...`);
  console.log(`[Bot] Connecting to ${config.server.ip}:${config.server.port} (Version: ${targetVersion || 'Auto-detect'})`);

  try {
    bot = mineflayer.createBot({
      username: config['bot-account'].username,
      password: config['bot-account'].password || undefined,
      auth: config['bot-account'].type,
      host: config.server.ip,
      port: config.server.port,
      version: targetVersion,
      hideErrors: false,
      checkTimeoutInterval: 60000
    });

    bot.loadPlugin(pathfinder);

    // Fast Connection timeout - if no spawn in 15s, retry fast
    const connectionTimeout = setTimeout(() => {
      if (!botState.connected) {
        console.log('[Bot] Connection timeout - no spawn received in 15s');
        if (bot) {
          try { bot.removeAllListeners(); bot.end(); } catch (e) { }
          bot = null;
        }
        scheduleReconnect();
      }
    }, 15000);

    bot.once('spawn', () => {
      clearTimeout(connectionTimeout);
      botState.connected = true;
      botState.lastActivity = Date.now();
      botState.reconnectAttempts = 0;
      isReconnecting = false;

      console.log(`[Bot] [+] Successfully spawned on server!`);
      if (config.discord && config.discord.events.connect) {
        sendDiscordWebhook(`[+] **Connected** to \`${config.server.ip}\``, 0x4ade80); // Green
      }

      const versionStr = bot.version || '1.21.1';
      let mcData;
      try {
        mcData = require('minecraft-data')(versionStr);
      } catch (e) {
        mcData = require('minecraft-data')('1.21.1');
      }
      const defaultMove = new Movements(bot, mcData);
      defaultMove.allowFreeMotion = false;
      defaultMove.canDig = false;
      defaultMove.liquidCost = 1000;
      defaultMove.fallDamageCost = 1000;

      // Start all modules
      initializeModules(bot, mcData, defaultMove);

      // Setup enhanced Leave/Rejoin logic
      setupLeaveRejoin(bot, createBot);

      setTimeout(() => {
        if (bot && botState.connected) {
          bot.chat('/gamerule sendCommandFeedback false');
        }
      }, 3000);

      // Attempt creative mode (only works if bot has OP)
      setTimeout(() => {
        if (bot && botState.connected) {
          bot.chat('/gamemode creative');
          console.log('[INFO] Attempted to set creative mode (requires OP)');
        }
      }, 3000);

      bot.on('messagestr', (message) => {
        if (
          message.includes('commands.gamemode.success.self') ||
          message.includes('Set own game mode to Creative Mode')
        ) {
          console.log('[INFO] Bot is now in Creative Mode.');
          bot.chat('/gamerule sendCommandFeedback false');
        }
      });
    });

    // Handle disconnection
    bot.on('end', (reason) => {
      const wasSpawned = botState.connected;
      console.log(`[Bot] Disconnected: ${reason || 'Unknown reason'}`);
      botState.connected = false;
      clearAllIntervals();

      if (config.discord && config.discord.events.disconnect && reason !== 'Periodic Rejoin') {
        sendDiscordWebhook(`[-] **Disconnected**: ${reason || 'Unknown'}`, 0xf87171); // Red
      }

      if (config.utils['auto-reconnect'] && !botState.userDisconnected) {
        scheduleReconnect();
      }
    });

    bot.on('kicked', (reason) => {
      const wasSpawned = botState.connected;
      console.log(`[Bot] Kicked: ${reason}`);
      botState.connected = false;
      botState.errors.push({ type: 'kicked', reason, time: Date.now() });
      clearAllIntervals();

      if (config.discord && config.discord.events.disconnect) {
        sendDiscordWebhook(`[!] **Kicked**: ${reason}`, 0xff0000); // Bright Red
      }

      if (config.utils['auto-reconnect'] && !botState.userDisconnected) {
        scheduleReconnect();
      }
    });

    bot.on('error', (err) => {
      console.log(`[Bot] Error: ${err.message}`);
      botState.errors.push({ type: 'error', message: err.message, time: Date.now() });
    });

  } catch (err) {
    console.log(`[Bot] Failed to create bot: ${err.message}`);
    if (!botState.userDisconnected) {
      scheduleReconnect();
    }
  }
}

function scheduleReconnect() {
  if (botState.userDisconnected) {
    console.log('[Bot] Reconnect skipped (User manually disconnected bot)');
    return;
  }

  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
  }

  if (isReconnecting) {
    return;
  }

  isReconnecting = true;
  botState.reconnectAttempts++;

  const delay = getReconnectDelay();
  console.log(`[Bot] Reconnecting in ${delay / 1000}s (attempt #${botState.reconnectAttempts})`);

  reconnectTimeout = setTimeout(() => {
    isReconnecting = false;
    createBot();
  }, delay);
}

// ============================================================
// MODULE INITIALIZATION
// ============================================================
function initializeModules(bot, mcData, defaultMove) {
  console.log('[Modules] Initializing all modules...');

  // ---------- AUTO AUTH ----------
  if (config.utils['auto-auth'] && config.utils['auto-auth'].enabled) {
    const password = config.utils['auto-auth'].password;
    setTimeout(() => {
      bot.chat(`/login ${password}`);
      console.log('[Auth] Sent login command');
    }, 2000);
  }

  // ---------- CHAT MESSAGES ----------
  if (config.utils['chat-messages'].enabled) {
    const messages = config.utils['chat-messages'].messages;
    if (config.utils['chat-messages'].repeat) {
      let i = 0;
      addInterval(() => {
        if (bot && botState.connected) {
          bot.chat(messages[i]);
          botState.lastActivity = Date.now();
          i = (i + 1) % messages.length;
        }
      }, config.utils['chat-messages']['repeat-delay'] * 1000);
    } else {
      messages.forEach((msg, idx) => {
        setTimeout(() => bot.chat(msg), idx * 1000);
      });
    }
  }

  // ---------- MOVE TO POSITION ----------
  if (config.position.enabled) {
    bot.pathfinder.setMovements(defaultMove);
    bot.pathfinder.setGoal(new GoalBlock(config.position.x, config.position.y, config.position.z));
  }

  // ---------- ANTI-AFK (Simple) ----------
  if (config.utils['anti-afk'].enabled) {
    addInterval(() => {
      if (bot && botState.connected) {
        bot.setControlState('jump', true);
        setTimeout(() => {
          if (bot) bot.setControlState('jump', false);
        }, 100);
        botState.lastActivity = Date.now();
      }
    }, 30000); // Jump every 30 seconds

    if (config.utils['anti-afk'].sneak) {
      bot.setControlState('sneak', true);
    }
  }

  // ---------- MOVEMENT MODULES ----------
  if (config.movement['circle-walk'].enabled) {
    startCircleWalk(bot, defaultMove);
  }
  if (config.movement['random-jump'].enabled) {
    startRandomJump(bot);
  }
  if (config.movement['look-around'].enabled) {
    startLookAround(bot);
  }

  // ---------- CUSTOM MODULES ----------
  if (config.modules.avoidMobs) avoidMobs(bot);
  if (config.modules.combat) combatModule(bot, mcData);
  if (config.modules.beds) bedModule(bot, mcData);
  if (config.modules.chat) chatModule(bot);

  // Periodic Rejoin
  if (config.utils['periodic-rejoin'] && config.utils['periodic-rejoin'].enabled) {
    periodicRejoin(bot);
  }

  console.log('[Modules] All modules initialized!');
}

// Periodic Rejoin Module
const setupLeaveRejoin = require('./leaveRejoin');

// Periodic Rejoin Module - Handled by leaveRejoin.js now
function periodicRejoin(bot) {
  // Deprecated in favor of leaveRejoin.js
  console.log('[Rejoin] Using new leaveRejoin system.');
}

// ============================================================
// MOVEMENT HELPERS
// ============================================================
function startCircleWalk(bot, defaultMove) {
  const radius = config.movement['circle-walk'].radius;
  let angle = 0;
  let lastPathTime = 0;

  addInterval(() => {
    if (!bot || !botState.connected || !bot.entity || !bot.entity.position) return;

    // Rate limit pathfinding
    const now = Date.now();
    if (now - lastPathTime < 2000) return;
    lastPathTime = now;

    try {
      const x = bot.entity.position.x + Math.cos(angle) * radius;
      const z = bot.entity.position.z + Math.sin(angle) * radius;
      bot.pathfinder.setMovements(defaultMove);
      bot.pathfinder.setGoal(new GoalBlock(Math.floor(x), Math.floor(bot.entity.position.y), Math.floor(z)));
      angle += Math.PI / 4;
      botState.lastActivity = Date.now();
    } catch (e) {
      console.log('[CircleWalk] Error:', e.message);
    }
  }, config.movement['circle-walk'].speed);
}

function startRandomJump(bot) {
  addInterval(() => {
    if (!bot || !botState.connected) return;
    try {
      bot.setControlState('jump', true);
      setTimeout(() => {
        if (bot) bot.setControlState('jump', false);
      }, 300);
      botState.lastActivity = Date.now();
    } catch (e) {
      console.log('[RandomJump] Error:', e.message);
    }
  }, config.movement['random-jump'].interval);
}

function startLookAround(bot) {
  addInterval(() => {
    if (!bot || !botState.connected) return;
    try {
      const yaw = Math.random() * Math.PI * 2;
      const pitch = (Math.random() - 0.5) * Math.PI / 4;
      bot.look(yaw, pitch, true);
      botState.lastActivity = Date.now();
    } catch (e) {
      console.log('[LookAround] Error:', e.message);
    }
  }, config.movement['look-around'].interval);
}

// ============================================================
// CUSTOM MODULES
// ============================================================

// Avoid mobs/players
function avoidMobs(bot) {
  const safeDistance = 5;
  addInterval(() => {
    if (!bot || !botState.connected || !bot.entity || !bot.entity.position) return;
    try {
      const entities = Object.values(bot.entities).filter(e =>
        e.type === 'mob' || (e.type === 'player' && e.username !== bot.username)
      );
      for (const e of entities) {
        if (!e.position) continue;
        const distance = bot.entity.position.distanceTo(e.position);
        if (distance < safeDistance) {
          bot.setControlState('back', true);
          setTimeout(() => {
            if (bot) bot.setControlState('back', false);
          }, 500);
          break;
        }
      }
    } catch (e) {
      console.log('[AvoidMobs] Error:', e.message);
    }
  }, 2000);
}

// Combat module
function combatModule(bot, mcData) {
  addInterval(() => {
    if (!bot || !botState.connected || !bot.entity || !bot.entity.position) return;
    try {
      if (config.combat['attack-mobs']) {
        const mobs = Object.values(bot.entities).filter(e =>
          e.type === 'mob' && e.position &&
          bot.entity.position.distanceTo(e.position) < 4
        );
        if (mobs.length > 0) {
          bot.attack(mobs[0]);
        }
      }
    } catch (e) {
      console.log('[Combat] Error:', e.message);
    }
  }, 1500);

  bot.on('health', () => {
    if (!config.combat['auto-eat']) return;
    try {
      if (bot.food < 14) {
        const food = bot.inventory.items().find(i => (mcData.foodsByName && mcData.foodsByName[i.name]) || i.name.includes('cooked') || i.name.includes('bread') || i.name.includes('apple'));
        if (food) {
          bot.equip(food, 'hand')
            .then(() => bot.consume())
            .catch(e => console.log('[AutoEat] Error:', e.message));
        }
      }
    } catch (e) {
      console.log('[AutoEat] Error:', e.message);
    }
  });
}

// Bed module (FIXED - beds are blocks, not entities)
function bedModule(bot, mcData) {
  addInterval(async () => {
    if (!bot || !botState.connected || !bot.time) return;

    try {
      const isNight = bot.time.timeOfDay >= 12500 && bot.time.timeOfDay <= 23500;

      if (config.beds['place-night'] && isNight && !bot.isSleeping) {
        // Find nearby bed blocks
        const bedBlock = bot.findBlock({
          matching: block => block.name.includes('bed'),
          maxDistance: 8
        });

        if (bedBlock) {
          try {
            await bot.sleep(bedBlock);
            console.log('[Bed] Sleeping...');
          } catch (e) {
            // Can't sleep - maybe not night enough or monsters nearby
          }
        }
      }
    } catch (e) {
      console.log('[Bed] Error:', e.message);
    }
  }, 10000);
}

// Chat module
function chatModule(bot) {
  bot.on('chat', (username, message) => {
    if (!bot || username === bot.username) return;

    try {
      if (config.chat.respond) {
        const lowerMsg = message.toLowerCase();
        if (lowerMsg.includes('hello') || lowerMsg.includes('hi')) {
          bot.chat(`Hello, ${username}!`);
        }
        if (message.startsWith('!tp ') && config.chat.respond) {
          const target = message.split(' ')[1];
          if (target) bot.chat(`/tp ${target}`);
        }
      }
    } catch (e) {
      console.log('[Chat] Error:', e.message);
    }
  });
}

// ============================================================
// CONSOLE COMMANDS
// ============================================================
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', (line) => {
  if (!bot || !botState.connected) {
    console.log('[Console] Bot not connected');
    return;
  }

  const trimmed = line.trim();
  if (trimmed.startsWith('say ')) {
    bot.chat(trimmed.slice(4));
  } else if (trimmed.startsWith('cmd ')) {
    bot.chat('/' + trimmed.slice(4));
  } else if (trimmed === 'status') {
    console.log(`Connected: ${botState.connected}, Uptime: ${formatUptime(Math.floor((Date.now() - botState.startTime) / 1000))}`);
  } else if (trimmed === 'reconnect') {
    console.log('[Console] Manual reconnect requested');
    bot.end();
  } else {
    bot.chat(trimmed);
  }
});

// ============================================================
// DISCORD WEBHOOK INTEGRATION
// ============================================================
function sendDiscordWebhook(content, color = 0x0099ff) {
  if (!config.discord || !config.discord.enabled || !config.discord.webhookUrl || config.discord.webhookUrl.includes('YOUR_DISCORD')) return;

  const protocol = config.discord.webhookUrl.startsWith('https') ? https : http;
  const urlParts = new URL(config.discord.webhookUrl);

  const payload = JSON.stringify({
    username: config.name,
    embeds: [{
      description: content,
      color: color,
      timestamp: new Date().toISOString(),
      footer: { text: 'Slobos AFK Bot' }
    }]
  });

  const options = {
    hostname: urlParts.hostname,
    port: 443,
    path: urlParts.pathname + urlParts.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': payload.length
    }
  };

  const req = protocol.request(options, (res) => {
    // console.log(`[Discord] Sent webhook: ${res.statusCode}`);
  });

  req.on('error', (e) => {
    console.log(`[Discord] Error sending webhook: ${e.message}`);
  });

  req.write(payload);
  req.end();
}

// ============================================================
// CRASH RECOVERY - IMMORTAL MODE
// ============================================================
process.on('uncaughtException', (err) => {
  console.log(`[FATAL] Uncaught Exception: ${err.message}`);
  // console.log(err.stack); // Optional: keep logs cleaner
  botState.errors.push({ type: 'uncaught', message: err.message, time: Date.now() });

  // CRITICAL: DO NOT EXIT.
  // The user wants the server to stay up "all the time no matter what".
  // We just clear intervals and try to restart the bot logic.
  if (config.utils['auto-reconnect']) {
    clearAllIntervals();
    // Wrap in a tiny timeout to prevent tight loops if the error is synchronous
    setTimeout(() => {
      scheduleReconnect();
    }, 1000);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.log(`[FATAL] Unhandled Rejection: ${reason}`);
  botState.errors.push({ type: 'rejection', message: String(reason), time: Date.now() });
  // Do not exit.
});

// Graceful shutdown from external signals (still allowed to exit if system demands it)
process.on('SIGTERM', () => {
  console.log('[System] SIGTERM received. Ignoring to stay alive? (Render might force kill)');
  // If we mistakenly exit here, the web server dies. 
  // User asked for "all the time on no matter what".
  // Note: Render will SIGKILL if we don't exit, but this keeps us up as long as possible.
  process.exit(0);
});

process.on('SIGINT', () => {
  // Local Ctrl+C
  console.log('[System] Manual stop requested. Exiting...');
  process.exit(0);
});

// ============================================================
// START THE BOT
// ============================================================
console.log('='.repeat(50));
console.log('  Minecraft AFK Bot v2.3 - Bug Fix Edition');
console.log('='.repeat(50));
console.log(`Server: ${config.server.ip}:${config.server.port}`);
console.log(`Version: ${config.server.version}`);
console.log(`Auto-Reconnect: ${config.utils['auto-reconnect'] ? 'Enabled' : 'Disabled'}`);
console.log('='.repeat(50));

createBot();
