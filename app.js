const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const path = require("path");
const bcrypt = require("bcrypt");
const profileRouter = require("./routes/profile");
const db = require("./routes/db");
const registerRoutes = require("./routes/register");
const gameRoutes = require("./routes/game");
const onlineGameRoutes = require("./routes/onlineGameRoutes");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Session Middleware Configuration
const sessionMiddleware = session({
  secret: "your_secret_key",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    maxAge: 1000 * 60 * 60 * 24,
    httpOnly: true,
    sameSite: "lax",
  },
});

// Use session middleware in Express
app.use(sessionMiddleware);

// Use session middleware in Socket.io
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

// Set io instance to the app context to use it in routes
app.set("io", io);

// Static Files
app.use("/css", express.static(path.join(__dirname, "css")));
app.use("/js", express.static(path.join(__dirname, "public/js")));
app.use(express.static(path.join(__dirname, "public")));

// View Engine
app.set("view engine", "pug");
app.set("views", path.join(__dirname, "views"));

// Body Parser Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Routes
app.get("/", (req, res) => {
  res.render("index", { title: "Home", user: req.session.user });
});

app.get("/login", (req, res) => {
  res.render("login", {
    title: "Login",
    user: req.session.user || null,
    message: null,
  });
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const query = "SELECT * FROM users WHERE username = ?";

  db.query(query, [username], async (err, results) => {
    if (err) {
      console.error("Error executing query:", err);
      return res.render("login", { message: "An error occurred" });
    }

    if (results.length > 0) {
      const isValidPassword = await bcrypt.compare(
        password,
        results[0].password
      );

      if (isValidPassword) {
        req.session.user = username;
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error("Error saving session:", saveErr);
            return res.render("login", {
              message: "An error occurred during session setup.",
            });
          }
          res.redirect("/");
        });
      } else {
        return res.render("login", { message: "Invalid username or password" });
      }
    } else {
      res.render("login", { message: "Invalid username or password" });
    }
  });
});

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
    }
    res.redirect("/login");
  });
});

// Importing the Game and Profile routes
app.use("/", profileRouter);
app.use("/", registerRoutes);
app.use("/game", gameRoutes);
app.use("/onlinegame", onlineGameRoutes);

// Socket.io Integration
const sessionPlayers = {};

// Socket.io Integration
io.on("connection", (socket) => {
  // Handle user connection
  if (socket.request.session && socket.request.session.user) {
    console.log(`${socket.request.session.user} connected`);
  } else {
    console.log("A user connected without a session");
  }

  // Handle joining a session
  socket.on("joinSession", (sessionCode) => {
    const user = socket.request.session.user;

    if (!user) {
      console.error("User is undefined. Cannot join session.");
      return;
    }

    socket.join(sessionCode);
    console.log(`User ${user} joined session: ${sessionCode}`);

    if (!sessionPlayers[sessionCode]) {
      sessionPlayers[sessionCode] = [];
    }

    // Update sessionPlayers with both player id and name, and avoid duplicates
    if (!sessionPlayers[sessionCode].some((player) => player.name === user)) {
      const player = { id: user, name: user }; // Here, we assume the user is both ID and name
      sessionPlayers[sessionCode].push(player);

      // Insert player into session_players table
      const insertPlayerQuery = `
      INSERT INTO session_players (session_id, player_id)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE player_id = player_id;`;

      db.query(insertPlayerQuery, [sessionCode, user], (err) => {
        if (err) {
          console.error("Database error adding player to session:", err);
        } else {
          console.log(`Player ${user} added to session ${sessionCode}`);
        }
      });

      // Update session with full player list
      if (!socket.request.session.players) {
        socket.request.session.players = [];
      }
      socket.request.session.players = sessionPlayers[sessionCode];
      socket.request.session.save((saveErr) => {
        if (saveErr) {
          console.error("Error saving session (joinSession):", saveErr);
        }
      });
    }

    io.to(sessionCode).emit("updatePlayerList", {
      players: sessionPlayers[sessionCode],
    });
  });

  // Handle game start event
  socket.on("startGame", (sessionCode) => {
    console.log(`Game started for session: ${sessionCode}`);

    // Update the game state in the database to reflect that the game has started
    const updateQuery = `
      UPDATE game_sessions 
      SET game_stage = 'in_progress', game_started = TRUE 
      WHERE session_id = ?`;

    db.query(updateQuery, [sessionCode], (err) => {
      if (err) {
        console.error("Database error updating game state:", err);
        return;
      }

      console.log(`Game state updated in database for session: ${sessionCode}`);

      // Emit to all players that the game has started
      io.to(sessionCode).emit("gameStarted", {
        currentPlayer: sessionPlayers[sessionCode][0], // Set the initial player to start
      });
    });
  });

  // Handle user disconnection
  socket.on("disconnect", () => {
    const user = socket.request.session.user;
    Object.keys(sessionPlayers).forEach((sessionCode) => {
      const index = sessionPlayers[sessionCode].indexOf(user);
      if (index !== -1) {
        sessionPlayers[sessionCode].splice(index, 1);
        io.to(sessionCode).emit("updatePlayerList", {
          players: sessionPlayers[sessionCode],
        });
      }
    });
    console.log(`${user} disconnected`);
  });
});

// Use HTTP server instead of app.listen()
server.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
