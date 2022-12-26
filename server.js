const path = require("path");
const http = require("http");
const express = require("express");
const socketio = require("socket.io");
const formatMessage = require("./utils/messages");
const createAdapter = require("@socket.io/redis-adapter").createAdapter;
const redis = require("redis");
require("dotenv").config();
const { createClient } = redis;
const {
  userJoin,
  getCurrentUser,
  userLeave,
  getRoomUsers,
} = require("./utils/users");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = socketio(server);

// Set static folder
app.use(express.static(path.join(__dirname, "public")));

const sqlite3 = require('sqlite3').verbose();
const dbfile = "database.db";
const existed = fs.existsSync(dbfile);
const db = new sqlite3.Database(dbfile, sqlite3.OPEN_READWRITE, (err) => {
  if(err) return console.error(err.message);
  console.log("connection successful");
});

db.serialize(function() {
  if (!existed) {
    db.run("CREATE TABLE users (user_name TEXT, password TEXT)");
  }
});

const botName = "ChatCord Bot";

(async () => {
  pubClient = createClient({ url: "redis://127.0.0.1:6379" });
  await pubClient.connect();
  subClient = pubClient.duplicate();
  io.adapter(createAdapter(pubClient, subClient));
})();

// Run when client connects
io.on("connection", (socket) => {
  socket.on('register', ({ username, password }) => {
    const sql1 = `SELECT * FROM users WHERE user_name = '${username}' AND password = '${password}'`;

    db.all(sql1, (err, rows) => {
      if (rows.length) {
        socket.emit('error', 'Register already!');
      } else {
        const sql = 'INSERT INTO users (user_name, password) VALUES (?, ?)';
        db.run(sql, [username, password]);
        // Welcome current user
        socket.emit('register', 'Register successfully!');
      }
    })

  });

  socket.on('login', ({ username, password }) => {
    // check username and password
    const sql = `SELECT * FROM users WHERE user_name = '${username}' AND password = '${password}'`;

    // username and password does not exist
    db.all(sql, (err, rows) => {
      if (rows.length) {
        const user = userJoin(socket.id, username, 'chatroom');
        socket.emit('success', user);
      } else {
        socket.emit('error', 'Incorrect Name or Password!');
      }
    })

  });
  socket.on("joinRoom", ({ username, room }) => {
    const user = userJoin(socket.id, username, room);

    socket.join(user.room);

    // Welcome current user
    socket.emit("message", formatMessage(botName, "Welcome to ChatCord!"));

    // Broadcast when a user connects
    socket.broadcast
      .to(user.room)
      .emit(
        "message",
        formatMessage(botName, `${user.username} has joined the chat`)
      );

    // Send users and room info
    io.to(user.room).emit("roomUsers", {
      room: user.room,
      users: getRoomUsers(user.room),
    });
  });

  // Listen for chatMessage
  socket.on("chatMessage", (msg) => {
    const user = getCurrentUser(socket.id);

    io.to(user.room).emit("message", formatMessage(user.username, msg));
  });

  // Runs when client disconnects
  socket.on("disconnect", () => {
    const user = userLeave(socket.id);

    if (user) {
      io.to(user.room).emit(
        "message",
        formatMessage(botName, `${user.username} has left the chat`)
      );

      // Send users and room info
      io.to(user.room).emit("roomUsers", {
        room: user.room,
        users: getRoomUsers(user.room),
      });
    }
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
