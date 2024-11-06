const express = require("express");
const router = express.Router();
const db = require("../routes/db"); // or '../db' if `db.js` is in the root folder
const { v4: uuidv4 } = require("uuid");

// Import the separate route modules
const gameSessionRoutes = require("./gameSessionRoutes");
const gamePlayRoutes = require("./gamePlayRoutes");
const playerRoutes = require("./playerRoutes");
const diceRoutes = require("./diceRoutes");

// Use the separate routes under a common path
router.use("/", gameSessionRoutes);
router.use("/", gamePlayRoutes);
router.use("/", playerRoutes);
router.use("/", diceRoutes);

// Define the root route for the /onlinegame path
router.get("/", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const session_id = req.session.session_id || "No active session";
  const host_id = req.session.host_id || req.session.user;

  if (session_id !== "No active session") {
    // Retrieve the game state from the database
    const selectGameQuery = `SELECT * FROM game_sessions WHERE session_id = ?`;
    db.query(selectGameQuery, [session_id], (err, gameResults) => {
      if (err) {
        console.error("Database error retrieving game state:", err);
        return res.status(500).send("Failed to retrieve game state.");
      }

      if (gameResults.length > 0) {
        const gameSession = gameResults[0];

        // Retrieve player information
        const selectPlayersQuery = `SELECT player_id FROM session_players WHERE session_id = ?`;
        db.query(selectPlayersQuery, [session_id], (err, playerResults) => {
          if (err) {
            console.error("Database error retrieving player data:", err);
            return res.status(500).send("Failed to retrieve players.");
          }

          res.render("onlineGame", {
            title: "Online Game Home",
            session: {
              session_id,
              host_id,
              game_started: gameSession.game_started,
              game_stage: gameSession.game_stage,
              current_player_index: gameSession.current_player_index,
            },
            players: playerResults,
            user: req.session.user,
          });
        });
      } else {
        res.render("onlineGame", {
          title: "Online Game Home",
          session: {
            session_id: "No active session",
            host_id,
          },
          user: req.session.user,
        });
      }
    });
  } else {
    res.render("onlineGame", {
      title: "Online Game Home",
      session: {
        session_id,
        host_id,
      },
      user: req.session.user,
    });
  }
});

// Route to get the current game state
router.get("/get-game-state/:sessionCode", (req, res) => {
  const { sessionCode } = req.params;

  if (!sessionCode) {
    return res
      .status(400)
      .json({ success: false, message: "No session code provided." });
  }

  const selectQuery = "SELECT * FROM game_sessions WHERE session_id = ?";
  db.query(selectQuery, [sessionCode], (err, results) => {
    if (err) {
      console.error("Database error:", err);
      return res
        .status(500)
        .json({ success: false, message: "Failed to retrieve game state." });
    }

    if (results.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Game session not found." });
    }

    const gameSession = results[0];
    const gameStarted = gameSession.game_started;
    const hostId = gameSession.host_id;

    const selectPlayersQuery =
      "SELECT player_id FROM session_players WHERE session_id = ?";
    db.query(
      selectPlayersQuery,
      [sessionCode],
      (playersErr, playersResults) => {
        if (playersErr) {
          console.error("Database error:", playersErr);
          return res.status(500).json({
            success: false,
            message: "Failed to retrieve player data.",
          });
        }

        res.json({
          success: true,
          gameStarted,
          gameStage: gameSession.game_stage, // Make sure this is included
          host_id: hostId, // Add host_id to the response
          players: playersResults,
          currentPlayerIndex: gameSession.current_player_index || 0,
        });
      }
    );
  });
});

module.exports = router;
