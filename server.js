// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const multer = require('multer');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ✅ In-memory account store
const accounts = new Set();

// ✅ Account check
app.get('/checkAccount', (req, res) => {
  const email = req.query.email;
  res.json({ exists: accounts.has(email) });
});

// ✅ Account creation
app.post('/createAccount', (req, res) => {
  const email = req.body.email;
  if (accounts.has(email)) {
    res.json({ success: false });
  } else {
    accounts.add(email);
    res.json({ success: true });
  }
});

// ✅ File upload setup (uploads stored in /uploads folder)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// ✅ Upload endpoint
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }
  res.json({ success: true, fileUrl: '/uploads/' + req.file.filename });
});

// ✅ Map of accountID → socket.id
const users = {};

// ✅ Socket.IO logic
io.on('connection', (socket) => {
  console.log('Connected:', socket.id);

  socket.on('register', (accountID) => {
    if (typeof accountID !== 'string' || !accountID.trim()) return;
    users[accountID] = socket.id;
    socket.data.accountID = accountID;
    console.log(`Registered: ${accountID} → ${socket.id}`);
    socket.emit('registered', { accountID });
  });

  // ✅ Group chat messages (no echo, only broadcast to others)
  socket.on('chat message', (msg) => {
    if (!msg || !msg.text || !msg.room) return;
    socket.broadcast.emit('chat message', msg);
  });

  // ✅ Private messages (no echo back to sender)
  socket.on('private message', ({ to, from, text }) => {
    if (!to || !text) return;
    const targetId = users[to];
    if (targetId) {
      io.to(targetId).emit('private message', { from, text });
    }
  });

  // ✅ Friend request flow
  socket.on('friend request', ({ from, to }) => {
    const targetId = users[to];
    if (targetId) {
      io.to(targetId).emit('friend request', { from });
    } else {
      io.to(socket.id).emit('friend request status', { to, status: 'unavailable' });
    }
  });

  socket.on('friend accept', ({ from, to }) => {
    const fromId = users[from];
    const toId = users[to];
    if (fromId) io.to(fromId).emit('friend accept', { to });
    if (toId) io.to(toId).emit('friend accept', { to: from });
  });

  socket.on('friend reject', ({ from, to }) => {
    const fromId = users[from];
    if (fromId) io.to(fromId).emit('friend reject', { to });
  });

  socket.on('disconnect', () => {
    const id = socket.data.accountID;
    if (id && users[id] === socket.id) {
      delete users[id];
      console.log(`Deregistered: ${id}`);
    }
    console.log('Disconnected:', socket.id);
  });
});

// ✅ Default route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'sign.html'));
});

// ✅ Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
