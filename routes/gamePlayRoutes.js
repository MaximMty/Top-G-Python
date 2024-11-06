const express = require("express");
const router = express.Router();
const db = require("../routes/db");

// Route to serve game page
router.get("/game/:sessionCode", (req, res) => {
  const { sessionCode } = req.params;

  const selectQuery = "SELECT * FROM game_sessions WHERE session_id = ?";
  db.query(selectQuery, [sessionCode], (err, results) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).send("Failed to retrieve game session.");
    }

    if (results.length > 0) {
      const gameSession = results[0];
      const gameStarted = gameSession.game_started;

      if (gameStarted) {
        // Pass the current game state to the game board
        res.render("gameBoard", {
          title: "Game Board",
          session: gameSession,
          players: req.session.players,
          currentPlayer: req.session.players[req.session.currentPlayerIndex],
        });
      } else {
        // If the game hasn't started, show the lobby
        res.render("onlineGame", {
          title: "Game Lobby",
          session: gameSession,
          user: req.session.user,
        });
      }
    } else {
      res.status(404).send("Session not found.");
    }
  });
});

module.exports = router;
