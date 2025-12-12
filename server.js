const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());

const users = {}; // username -> socket.id

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('register', (username) => {
    users[username] = socket.id;
    console.log(`${username} registered`);
  });

  socket.on('chat message', (msg) => {
    io.emit('chat message', msg);
  });

  socket.on('private message', ({ to, from, text }) => {
    const targetId = users[to];
    if (targetId) {
      io.to(targetId).emit('private message', { from, text });
    }
  });

  socket.on('disconnect', () => {
    for (let name in users) {
      if (users[name] === socket.id) {
        delete users[name];
      }
    }
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
