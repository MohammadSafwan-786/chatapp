// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());

// Map of accountID -> socket.id
const users = {};

// Optional: simple presence list per room (not required for basic chat)
const rooms = new Set(["General", "Tech", "Random"]);

// Connection lifecycle
io.on('connection', (socket) => {
  console.log('Connected:', socket.id);

  // Register account ID (e.g., mohammad.chatapp.email)
  socket.on('register', (accountID) => {
    if (typeof accountID !== 'string' || !accountID.trim()) return;
    users[accountID] = socket.id;
    socket.data.accountID = accountID;
    console.log(`Registered: ${accountID} -> ${socket.id}`);
    // Optional: acknowledge to client
    socket.emit('registered', { accountID });
  });

  // Group chat messages
  socket.on('chat message', (msg) => {
    // msg: { room, user, text }
    if (!msg || !msg.text || !msg.room) return;
    // Broadcast to everyone (simple global rooms)
    io.emit('chat message', msg);
  });

  // Private messages (DM)
  socket.on('private message', ({ to, from, text }) => {
    if (!to || !text) return;
    const targetId = users[to];
    // Send to recipient if online
    if (targetId) {
      io.to(targetId).emit('private message', { from, text });
    }
    // Echo back to sender so they see their sent DM
    io.to(socket.id).emit('private message', { from, text });
  });

  // Friend request flow
  socket.on('friend request', ({ from, to }) => {
    if (!to || !from) return;
    const targetId = users[to];
    if (targetId) {
      io.to(targetId).emit('friend request', { from });
    } else {
      // Optionally inform sender that target is offline or unknown
      io.to(socket.id).emit('friend request status', { to, status: 'unavailable' });
    }
  });

  socket.on('friend accept', ({ from, to }) => {
    // Notify both sides to create DM tabs
    const fromId = users[from];
    const toId = users[to];
    if (fromId) io.to(fromId).emit('friend accept', { to });
    if (toId) io.to(toId).emit('friend accept', { to: from });
  });

  socket.on('friend reject', ({ from, to }) => {
    const fromId = users[from];
    if (fromId) io.to(fromId).emit('friend reject', { to });
  });

  // Cleanup on disconnect
  socket.on('disconnect', () => {
    const id = socket.data.accountID;
    if (id && users[id] === socket.id) {
      delete users[id];
      console.log(`Deregistered: ${id}`);
    }
    console.log('Disconnected:', socket.id);
  });
});

// HTTP health check (optional)
app.get('/', (req, res) => {
  res.send('Chat server is running.');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
