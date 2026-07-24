const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e7 });

app.use(express.static(path.join(__dirname, 'public')));

let conversations = [
  { id: 'conv-1', name: 'Utilisateur #1', messages: [] }
];

io.on('connection', (socket) => {
  socket.emit('init-data', conversations);

  // Transfert du statut "en train d'écrire"
  socket.on('typing', (data) => {
    socket.broadcast.emit('user-typing', data);
  });

  socket.on('stop-typing', (data) => {
    socket.broadcast.emit('user-stop-typing', data);
  });

  socket.on('send-message', (data) => {
    const { convId, text, image, sender } = data;
    const conv = conversations.find(c => c.id === convId);

    if (conv) {
      const msg = { sender, text, image, timestamp: new Date() };
      conv.messages.push(msg);
      io.emit('new-message', { convId, message: msg });
    }
  });
});

const PORT = 3000;
server.listen(PORT, () => console.log(`🚀 Serveur actif sur http://localhost:${PORT}`));
