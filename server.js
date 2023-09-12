const express = require('express');
const cors = require('cors');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server, {
  cors: {
    origin: '*',
  },
});

const rooms = {};
const roomPlayerNumbers = {}; 

app.use(cors());

io.on('connection', (socket) => {
  let turnTime = 10;
  
  socket.on('createRoom', (playerName, callback) => {
    const newRoomId = generateRoomId();
    rooms[newRoomId] = [{ id: socket.id, name: playerName}];
    socket.join(newRoomId);
    console.log(newRoomId);
    console.log(rooms[newRoomId]);
    if (typeof callback === 'function') {
      callback(newRoomId);
    }
  });

  socket.on('joinRoom', ({ roomId, playerName }, callback) => {
    if (rooms[roomId] && rooms[roomId].length < 8) {
      // Check if the player with the same socket id already exists in the room
      const existingPlayer = rooms[roomId].find((player) => player.id === socket.id);
      if (existingPlayer) {
        if (typeof callback === 'function') {
          callback(false);
        }
        return;
      }

      rooms[roomId].push({ id: socket.id, name: playerName});
      socket.join(roomId);
      io.to(roomId).emit('playerJoined', rooms[roomId].map((player) => player.name));
      if (typeof callback === 'function') {
        callback(true);
      }
    } else {
      if (typeof callback === 'function') {
        callback(false);
      }
    }
  });

  socket.on('disconnect', () => {

    for (const roomId in rooms) {
      const index = rooms[roomId].findIndex((player) => player.id === socket.id);
      if (index !== -1) {
        rooms[roomId].splice(index, 1);
        io.to(roomId).emit('playerJoined', rooms[roomId].map((player) => player.name));
        break;
      }
    }
  });


  const Gameplay = () => {
    

    io.emit('navigateToGameplay');
  
    const turnTimer = setInterval(() => {
      if (turnTime > 0) {
        turnTime--;
        io.emit('updateTurnTimer', { turnTime }); // Emit the updated turn time to all clients
      } else {
        // Turn time is up, you can take further action here
        clearInterval(turnTimer); // Stop the timer
      }
    }, 1000);
  }

  
  socket.on('startGame', () => {
    io.emit('navigateToGameplay');

    Gameplay();
  });
  
  
  socket.on('submitNumber', ({ roomId, socketId, numberInput }) => {
    if (!roomPlayerNumbers[roomId]) {
      roomPlayerNumbers[roomId] = [];
    }

    // Store both the player socket ID and their number input in roomPlayerNumbers
    roomPlayerNumbers[roomId].push({ socketId, numberInput });

    // Log the player and their number input to the server console
    console.log(rooms[roomId]);
    console.log(`Player: ${socketId}, Number: ${numberInput}`);

    // Calculate and log the average when a new number is submitted
    const average = calculateAverage(roomId);
    console.log(`Average for room ${roomId}: ${average}`);
  });
  

});




const generateRoomId = () => {
  const roomIdLength = 6;
  let roomId = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (let i = 0; i < roomIdLength; i++) {
    roomId += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  return roomId;
};

const calculateAverage = (roomId) => {
  if (!roomPlayerNumbers[roomId]) {
    return 0;
  }

  const numbers = roomPlayerNumbers[roomId].map((entry) => entry.numberInput);
  if (numbers.length === 0) {
    return 0;
  }

  const sum = numbers.reduce((total, num) => total + parseFloat(num), 0);
  return sum / numbers.length;
};


app.get('/rooms/:roomId/names', (req, res) => {
  const { roomId } = req.params;

  if (rooms[roomId]) {
    const names = rooms[roomId].map((player) => player.name);
    console.log(names); // Output the player names to the console
    res.status(200).json(names);
  } else {
    res.status(404).json({ error: 'Room not found' });
  }
});

// Define an endpoint to get the numbers for a specific room
app.get('/rooms/:roomId/numbers', (req, res) => {
  const { roomId } = req.params;

  if (roomPlayerNumbers[roomId]) {
    const numbers = roomPlayerNumbers[roomId];
    res.status(200).json(numbers);
  } else {
    res.status(404).json({ error: 'Room numbers not found' });
  }
});

app.get('/rooms/:roomId/player/:playerId', (req, res) => {
  const { roomId, playerId } = req.params;

  if (rooms[roomId]) {
    const player = rooms[roomId].find((player) => player.id === playerId);

    if (player) {
      res.status(200).json({ playerName: player.name });
    } else {
      res.status(404).json({ error: 'Player not found' });
    }
  } else {
    res.status(404).json({ error: 'Room not found' });
  }
});



app.post('/rooms/create', (req, res) => {
  const { playerName } = req.body;
  const newRoomId = generateRoomId();
  rooms[newRoomId] = [{ id: '', name: playerName }];
  console.log(newRoomId);
  res.status(200).json({ roomId: newRoomId });
});

app.post('/rooms/join', (req, res) => {
  const { roomId, playerName } = req.body;

  if (rooms[roomId] && rooms[roomId].length < 8) {
    const player = { id: '', name: playerName };
    rooms[roomId].push(player);
    console.log(`Player ${playerName} joined room ${roomId}`);
    res.status(200).json({ success: true, playerName: player.name });
    io.to(roomId).emit('playerJoined', rooms[roomId].map((player) => player.name));
  } else {
    res.status(400).json({ error: 'Failed to join the room' });
  }
});

server.listen(5000, () => {
  console.log('Server listening on port 5000');
});
