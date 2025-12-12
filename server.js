const express = require('express');
const cors = require('cors');
const multer = require('multer');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET","POST"] }
});

app.use(cors());
app.use(express.json());

const accounts = new Map();
const users = {};

app.get('/checkAccount', (req, res) => {
  const email = req.query.email;
  res.json({ exists: accounts.has(email) });
});

app.post('/createAccount', (req, res) => {
  const email = req.body.email;
  if (!email || accounts.has(email)) {
    return res.json({ success: false });
  }
  accounts.set(email, []);
  res.json({ success: true });
});

// File upload
const upload = multer({ dest: 'uploads/' });
app.post('/upload', upload.single('file'), (req, res) => {
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ success: true, fileUrl });
});

io.on('connection', (socket) => {
  socket.on('register', (username) => {
    users[username] = socket.id;
  });

  socket.on('chat message', (msg) => {
    io.to(users[msg.user]).emit('chat message', msg);
    io.emit('chat message', msg); // broadcast to room
  });

  socket.on('friend request', ({ from, to }) => {
    const targetId = users[to];
    if (targetId) {
      io.to(targetId).emit('friend request', { from });
    } else {
      io.to(socket.id).emit('friend request status', { to, status: 'unavailable' });
    }
  });

  socket.on('friend accept', ({ from, to }) => {
    if (users[from]) {
      io.to(users[from]).emit('friend accept', { to });
    }
  });

  socket.on('friend reject', ({ from, to }) => {
    if (users[from]) {
      io.to(users[from]).emit('friend reject', { to });
    }
  });
});

server.listen(3000, () => console.log("Server running"));
