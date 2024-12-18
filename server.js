const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs-extra');
const multer = require('multer');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Configuração de armazenamento do multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { roomId } = req.params;
    const uploadPath = path.join(__dirname, 'recordings', roomId);
    fs.ensureDirSync(uploadPath); // Cria a pasta se não existir
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const { userId } = req.params;
    cb(null, `${userId}-${Date.now()}.webm`);
  }
});

const upload = multer({ storage });

// Serve arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Rota para upload de vídeos
app.post('/upload/:roomId/:userId', upload.single('video'), (req, res) => {
  res.sendStatus(200);
});

// Serve o arquivo HTML principal para qualquer caminho
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

io.on('connection', socket => {
  console.log('A user connected');

  // Evento para quando um usuário entra na sala
  socket.on('join-room', roomId => {
    socket.join(roomId);
    socket.roomId = roomId;
    io.to(roomId).emit('participant-count', io.sockets.adapter.rooms.get(roomId)?.size || 0);
    console.log(`User joined room: ${roomId}`);
  });

  // Reencaminha a oferta do WebRTC para outros participantes na sala
  socket.on('offer', (roomId, offer) => {
    socket.to(roomId).emit('offer', offer);
  });

  // Reencaminha a resposta do WebRTC para outros participantes na sala
  socket.on('answer', (roomId, answer) => {
    socket.to(roomId).emit('answer', answer);
  });

  // Reencaminha os candidatos ICE do WebRTC para outros participantes na sala
  socket.on('candidate', (roomId, candidate) => {
    socket.to(roomId).emit('candidate', candidate);
  });

  socket.on('leave-room', roomId => {
    socket.leave(roomId);
    io.to(roomId).emit('user-left');
    console.log(`User left room: ${roomId}`);
  });

  socket.on('disconnect', () => {
    const roomId = socket.roomId;
    if (roomId) {
      socket.leave(roomId);
      io.to(roomId).emit('user-left');
      console.log('A user disconnected');
    }
  });
});

// Certifica que a pasta de gravações exista
fs.ensureDirSync(path.join(__dirname, 'recordings'));

// Inicia o servidor
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
