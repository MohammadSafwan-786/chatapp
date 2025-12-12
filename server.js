// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Allow CORS for static frontends hosted elsewhere
app.use(cors());
app.use(express.static('public')); // optional: serve frontend from backend

const io = new Server(server, {
  cors: {
    origin: '*', // restrict to your frontend origin in production
    methods: ['GET','POST']
  }
});

// In-memory message history (small buffer)
const HISTORY_LIMIT = 200;
const history = [];

// Helper to push to history
function pushHistory(msg){
  history.push(msg);
  if(history.length > HISTORY_LIMIT) history.shift();
}

io.on('connection', (socket) => {
  console.log('Client connected', socket.id);

  // Send recent history to the new client
  socket.emit('history', history);

  // Optional identify event
  socket.on('identify', (info) => {
    console.log('Identify', socket.id, info);
    // Could store socket->user mapping here
  });

  // Receive chat message and broadcast
  socket.on('chat message', (msg) => {
    // Basic validation
    if(!msg || typeof msg.text !== 'string') return;
    const safeMsg = {
      sender: msg.sender || 'Anonymous',
      senderId: msg.senderId || null,
      text: msg.text.slice(0, 2000),
      ts: msg.ts || Date.now()
    };
    pushHistory(safeMsg);
    io.emit('chat message', safeMsg);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected', socket.id);
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
