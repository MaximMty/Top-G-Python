const express = require("express");
const router = express.Router();
const db = require("../routes/db");

router.post("/roll-dice", (req, res) => {
  const sessionCode = req.session.session_id;

  if (!sessionCode) {
    return res.status(400).send("No session code provided.");
  }

  console.log("Session data on dice roll:", req.session);

  const players = req.session.players;

  if (!players || players.length === 0) {
    console.error("No players found in session. Current session:", req.session);
    return res
      .status(500)
      .json({ success: false, message: "No players found in session." });
  }

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

    const currentPlayerIndex = req.session.currentPlayerIndex || 0;
    const currentPlayer = players[currentPlayerIndex];

    // Emit `diceRolled` to all players in the session
    req.app.get("io").to(sessionCode).emit("diceRolled", {
      playerId: currentPlayer,
      diceValue: diceValue,
      currentPlayer: currentPlayer,
    });

    // Respond to the player who rolled the dice
    res.json({
      success: true,
      diceRoll: diceValue,
      currentPlayer: currentPlayer,
    });
  });
});

module.exports = router;
