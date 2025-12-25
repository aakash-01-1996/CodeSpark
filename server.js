// const express = require("express");
// const app = express();
// const http = require("http");
// const { Server } = require("socket.io");
// const ACTIONS = require("./src/Actions");

// const server = http.createServer(app);
// const io = new Server(server);

// const userSocketMap = {};
// function getAllConnectedClients(roomId) {
//   return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
//     (socketId) => {
//       return {
//         socketId,
//         username: userSocketMap[socketId],
//       };
//     }
//   );
// }

// io.on("connection", (socket) => {
//   console.log("socket connected", socket.id);

//   socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
//     userSocketMap[socket.id] = username;
//     socket.join(roomId);
//     const clients = getAllConnectedClients(roomId);
//     clients.forEach(({ socketId }) => {
//       io.to(socketId).emit(ACTIONS.JOINED, {
//         clients,
//         username,
//         socketId: socket.id,
//       });
//     });
//   });

//   socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code }) => {
//     socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code });
//   });

//   socket.on(ACTIONS.SYNC_CODE, ({ socketId, code }) => {
//     io.to(socketId).emit(ACTIONS.SYNC_CODE, { code });
//   });

//   socket.on("disconnecting", () => {
//     const rooms = [...socket.rooms];
//     rooms.forEach((roomId) => {
//       socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
//         socketId: socket.id,
//         username: userSocketMap[socket.id],
//       });
//     });
//     delete userSocketMap[socket.id];
//     socket.leave();
//   });
// });

// const PORT = process.env.PORT || 5001;
// server.listen(PORT, () => console.log(`Listening on port ${PORT}`));

const express = require("express");
const app = express();
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const ACTIONS = require("./src/Actions.cjs");

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Serve static files from React build in production
app.use(express.static(path.join(__dirname, "build")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "build", "index.html"));
});

const userSocketMap = {};
function getAllConnectedClients(roomId) {
  return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
    (socketId) => {
      return {
        socketId,
        username: userSocketMap[socketId],
      };
    }
  );
}

io.on("connection", (socket) => {
  console.log("socket connected", socket.id);

  socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
    console.log(`User ${username} attempting to join room ${roomId}`);

    // Prevent duplicate users
    const clients = getAllConnectedClients(roomId);
    const isDuplicateUser = clients.some(
      (client) => client.username === username
    );

    if (isDuplicateUser) {
      console.log(`User ${username} is already in room ${roomId}`);
      socket.emit(ACTIONS.JOINED, {
        clients,
        username,
        socketId: socket.id,
      });
      return;
    }

    userSocketMap[socket.id] = username;
    socket.join(roomId);
    const updatedClients = getAllConnectedClients(roomId);

    updatedClients.forEach(({ socketId }) => {
      io.to(socketId).emit(ACTIONS.JOINED, {
        clients: updatedClients,
        username,
        socketId: socket.id,
      });
    });
  });

  socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code, username, changedLines }) => {
    socket
      .in(roomId)
      .emit(ACTIONS.CODE_CHANGE, { code, username, changedLines });
  });

  socket.on(ACTIONS.SYNC_CODE, ({ socketId, code, lineAuthors }) => {
    io.to(socketId).emit(ACTIONS.SYNC_CODE, { code, lineAuthors });
  });

  // Typing indicator
  socket.on(ACTIONS.TYPING, ({ roomId, username }) => {
    socket.in(roomId).emit(ACTIONS.TYPING, { username });
  });

  socket.on(ACTIONS.STOP_TYPING, ({ roomId, username }) => {
    socket.in(roomId).emit(ACTIONS.STOP_TYPING, { username });
  });

  // Deletion approval flow
  socket.on(
    ACTIONS.DELETE_REQUEST,
    ({ roomId, username, deletedCode, newCode, requestId }) => {
      // Send deletion request to all other users in the room
      socket.in(roomId).emit(ACTIONS.DELETE_REQUEST, {
        username,
        deletedCode,
        newCode,
        requestId,
        requesterId: socket.id,
      });
    }
  );

  socket.on(
    ACTIONS.DELETE_APPROVED,
    ({ roomId, requestId, newCode, requesterId }) => {
      // Notify all users that deletion was approved
      io.in(roomId).emit(ACTIONS.DELETE_APPROVED, { requestId, newCode });
    }
  );

  socket.on(
    ACTIONS.DELETE_REJECTED,
    ({ roomId, requestId, username, requesterId }) => {
      // Notify the requester that deletion was rejected
      io.to(requesterId).emit(ACTIONS.DELETE_REJECTED, {
        requestId,
        rejectedBy: username,
      });
    }
  );

  socket.on(ACTIONS.DELETE_CANCELLED, ({ roomId, requestId }) => {
    // Notify all users that the deletion request was cancelled
    socket.in(roomId).emit(ACTIONS.DELETE_CANCELLED, { requestId });
  });

  socket.on("disconnecting", () => {
    const rooms = [...socket.rooms];
    rooms.forEach((roomId) => {
      socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
        socketId: socket.id,
        username: userSocketMap[socket.id],
      });
    });
    delete userSocketMap[socket.id];
    socket.leave();
  });
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => console.log(`Listening on port ${PORT}`));
