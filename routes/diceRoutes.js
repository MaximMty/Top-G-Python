const express = require("express");
const router = express.Router();
const db = require("../routes/db");

router.post("/roll-dice", (req, res) => {
  const sessionCode = req.session.session_id;

  if (!sessionCode) {
    return res.status(400).send("No session code provided.");
  }

  console.log("Session data on dice roll:", req.session);

  // Fetch players array directly from the session
  let players = req.session.players;

  // If players array is not available in session, retrieve from the database
  if (!players || players.length === 0) {
    const getPlayersQuery = `SELECT player_id FROM session_players WHERE session_id = ? ORDER BY id ASC`;
    db.query(getPlayersQuery, [sessionCode], (err, results) => {
      if (err) {
        console.error("Database error fetching players:", err);
        return res
          .status(500)
          .json({ success: false, message: "Failed to fetch players." });
      }

      if (results.length === 0) {
        console.error("No players found in session:", sessionCode);
        return res
          .status(500)
          .json({ success: false, message: "No players found in session." });
      }

      players = results.map((row) => row.player_id);
      req.session.players = players;

      req.session.save((saveErr) => {
        if (saveErr) {
          console.error(
            "Error saving session after fetching players:",
            saveErr
          );
          return res
            .status(500)
            .json({ success: false, message: "Failed to save session data." });
        }

        // Proceed with rolling dice after ensuring session players are saved
        rollDiceAndProceed(req, res, players, sessionCode);
      });
    });
  } else {
    // If players are already in session, proceed with rolling dice
    rollDiceAndProceed(req, res, players, sessionCode);
  }
});

// Function to roll dice and proceed with game logic
function rollDiceAndProceed(req, res, players, sessionCode) {
  // Roll the dice (random value between 1 and 6)
  const diceValue = Math.floor(Math.random() * 6) + 1;
  console.log("Dice rolled, value:", diceValue);

  // Save the rolled dice value in the session
  req.session.diceValue = diceValue;

  req.session.save((err) => {
    if (err) {
      console.error("Error saving session:", err);
      return res
        .status(500)
        .json({ success: false, message: "Failed to save dice roll." });
    }

    // Get the current player index
    let currentPlayerIndex = req.session.currentPlayerIndex || 0;
    const currentPlayer = { name: players[currentPlayerIndex] }; // Ensure currentPlayer is an object with a `name` property

    // Emit `diceRolled` to all players in the session
    req.app.get("io").to(sessionCode).emit("diceRolled", {
      playerId: currentPlayer.name,
      diceValue: diceValue,
      currentPlayer: currentPlayer,
    });

    // Don't update the player turn immediately, wait until the question is answered
    // Respond to the player who rolled the dice
    res.json({
      success: true,
      diceRoll: diceValue,
      currentPlayer: currentPlayer,
    });
  });
}

module.exports = router;
