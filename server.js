'use strict';

const express    = require('express');
const https      = require('https');
const { Server } = require('socket.io');
const path       = require('path');
const selfsigned = require('selfsigned');
const os         = require('os');

// ── Express ────────────────────────────────────────────────────────────────
const app = express();

// ── Middleware: restrict admin dashboard to localhost only ──────────────────
function localhostOnly(req, res, next) {
  const ip = req.socket.remoteAddress || '';
  // Accept 127.0.0.1 and ::1 (IPv6 loopback)
  const isLocal = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
  if (!isLocal) {
    res.status(403).send(`
      <!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8">
      <title>Доступ закрыт</title>
      <style>body{background:#080a10;color:#ef4444;font-family:'Segoe UI',sans-serif;
      display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:1rem;}
      h1{font-size:2rem;}p{color:#64748b;font-size:.95rem;}</style></head>
      <body><h1>🔒 Доступ закрыт</h1>
      <p>Панель наблюдения доступна только организатору турнира.</p></body></html>
    `);
    return;
  }
  next();
}

// ── Static files (for /stream, /view pages — accessible from LAN) ──────────
app.use(express.static(path.join(__dirname, 'public')));

// ── Named routes (serve HTML without .html extension) ──────────────────────
// Admin dashboard — localhost only
app.get('/', localhostOnly, (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);

// Player stream page — accessible from LAN
app.get('/stream', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'stream.html'))
);

// OBS view page — accessible from LAN
app.get('/view', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'view.html'))
);

// ── Self-signed TLS certificate (required for getDisplayMedia on LAN) ──────
console.log('🔐 Generating SSL certificate...');
const pems = selfsigned.generate(
  [{ name: 'commonName', value: 'tournament.local' }],
  { days: 365, keySize: 2048 }
);

const httpsServer = https.createServer({ key: pems.private, cert: pems.cert }, app);

// ── Socket.io ──────────────────────────────────────────────────────────────
const io = new Server(httpsServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],
});

// ── State ──────────────────────────────────────────────────────────────────
/** playerNumber → streamer socketId */
const streamers = new Map();
/** streamer socketId → playerNumber */
const socketToPlayer = new Map();
/** host socket IDs */
const hosts = new Set();
/** playerNumber → [pending viewer socketIds] (viewer joined before streamer) */
const pendingViewers = new Map();

/** Set of player numbers currently in use */
const activeNumbers = new Set();

/** Returns the lowest free player number (1-based) and marks it as used */
function assignPlayerNumber() {
  let num = 1;
  while (activeNumbers.has(num)) num++;
  activeNumbers.add(num);
  return num;
}

/** Returns a player number back to the pool */
function releasePlayerNumber(num) {
  activeNumbers.delete(num);
}

// ── Socket.io events ────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[+] connected  ${socket.id}`);

  // ── Host (observer dashboard) ────────────────────────────────────────────
  socket.on('join-host', () => {
    hosts.add(socket.id);
    // Send currently active streamers list
    const list = [...streamers.entries()].map(([n, sid]) => ({
      playerNumber: n,
      socketId: sid,
    }));
    socket.emit('players-list', list);
    console.log(`  Host joined: ${socket.id}`);
  });

  // ── Streamer (player sharing their screen) ───────────────────────────────
  socket.on('join-stream', () => {
    const playerNumber = assignPlayerNumber();

    streamers.set(playerNumber, socket.id);
    socketToPlayer.set(socket.id, playerNumber);
    socket.emit('player-number', playerNumber);
    console.log(`  Player ${playerNumber} streaming: ${socket.id}`);

    // Notify all hosts
    hosts.forEach((hid) =>
      io.to(hid).emit('player-joined', { playerNumber, socketId: socket.id })
    );

    // Wake up any viewers that arrived before the streamer
    const pending = pendingViewers.get(playerNumber) || [];
    pending.forEach((vid) => {
      socket.emit('viewer-request', { viewerSocketId: vid });
    });
    pendingViewers.delete(playerNumber);
  });

  // ── Viewer (host dashboard or OBS browser source) ────────────────────────
  socket.on('join-view', ({ playerNumber }) => {
    const num = parseInt(playerNumber, 10);
    const streamerSid = streamers.get(num);
    if (streamerSid) {
      io.to(streamerSid).emit('viewer-request', { viewerSocketId: socket.id });
    } else {
      // Streamer not yet connected — buffer request
      if (!pendingViewers.has(num)) pendingViewers.set(num, []);
      pendingViewers.get(num).push(socket.id);
    }
  });

  // ── WebRTC signaling relay (pure pass-through) ───────────────────────────
  socket.on('offer', ({ targetSocketId, offer }) =>
    io.to(targetSocketId).emit('offer', { fromSocketId: socket.id, offer })
  );
  socket.on('answer', ({ targetSocketId, answer }) =>
    io.to(targetSocketId).emit('answer', { fromSocketId: socket.id, answer })
  );
  socket.on('ice-candidate', ({ targetSocketId, candidate }) =>
    io.to(targetSocketId).emit('ice-candidate', { fromSocketId: socket.id, candidate })
  );

  // ── Pause / Resume relay (admin → specific streamer) ─────────────────────
  // Admin sends: { targetPlayerNumber: N }
  // Server forwards to the matching streamer socket.
  socket.on('pause-stream', ({ targetPlayerNumber }) => {
    const sid = streamers.get(parseInt(targetPlayerNumber, 10));
    if (sid) io.to(sid).emit('pause-stream');
  });

  socket.on('resume-stream', ({ targetPlayerNumber }) => {
    const sid = streamers.get(parseInt(targetPlayerNumber, 10));
    if (sid) {
      io.to(sid).emit('resume-stream');
      // Tell the admin that this stream is waking up
      socket.emit('stream-resuming', { playerNumber: parseInt(targetPlayerNumber, 10) });
    }
  });

  // ── Disconnect ───────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[-] disconnected ${socket.id}`);
    hosts.delete(socket.id);

    const pn = socketToPlayer.get(socket.id);
    if (pn !== undefined) {
      streamers.delete(pn);
      socketToPlayer.delete(socket.id);
      releasePlayerNumber(pn);          // free the slot for reuse
      hosts.forEach((hid) =>
        io.to(hid).emit('player-left', { playerNumber: pn })
      );
      console.log(`  Player ${pn} left. Slot freed.`);
    }
  });
});

// ── Start ──────────────────────────────────────────────────────────────────
function getLocalIPs() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((n) => n.family === 'IPv4' && !n.internal)
    .map((n) => n.address);
}

const PORT = process.env.PORT || 3000;

httpsServer.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalIPs();
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║        🎮  TOURNAMENT STREAM SERVER  READY  🎮        ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  console.log(`  🔒  Панель хоста   : https://localhost:${PORT}/  (только этот ПК)`);

  if (ips.length === 0) {
    console.log(`  🎮  Игрок (стрим) : https://localhost:${PORT}/stream`);
    console.log(`  🔴  OBS (игрок N) : https://localhost:${PORT}/view?player=N\n`);
  } else {
    ips.forEach((ip) => {
      console.log(`  🎮  Игрок (стрим) : https://${ip}:${PORT}/stream`);
      console.log(`  🔴  OBS (игрок N) : https://${ip}:${PORT}/view?player=N\n`);
    });
  }
  console.log('⚠️  При первом входе: "Дополнительно" → "Перейти на сайт"\n');
});
