const express = require("express");
const router = express.Router();
const db = require("./db");

// Store players and game state in memory
let players = [];
let currentPlayerIndex = 0;

// Add Player Route
router.post("/add-player", (req, res) => {
  const { name } = req.body;
  if (name) {
    const player = { id: players.length + 1, name, score: 0 };
    players.push(player);
  }
  res.redirect("/game");
});

// Roll Dice Route
router.post("/roll-dice", (req, res) => {
  const diceValue = Math.floor(Math.random() * 6) + 1;
  const currentPlayer = players[currentPlayerIndex];

  res.json({ diceValue, player: currentPlayer });
});

// Get Question (High/Low Risk) Route
router.get("/get-question/:risk", (req, res) => {
  const { risk } = req.params;
  const table = risk === "high" ? "high_risk_questions" : "low_risk_questions";
  const query = `SELECT * FROM ${table} ORDER BY RAND() LIMIT 1`;

  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching question:", err);
      return res.status(500).json({ error: "Error fetching question" });
    }
    res.json(results[0]); // Send the question, options, and correct answer
  });
});

// Submit Answer Route
router.post("/game/submit-answer", (req, res) => {
  const { answer, diceValue, risk } = req.body;
  const query = `SELECT * FROM ${risk}_risk_questions WHERE correct_answer = ?`;

  db.query(query, [answer], (err, results) => {
    if (err) {
      console.error("Error checking answer:", err);
      return res.status(500).send("Error checking answer");
    }

    const correct = results.length > 0;
    const tip = correct ? null : results[0].tip;

    if (correct && risk === "high") {
      players[currentPlayerIndex].score += diceValue * 2; // Double points for high-risk correct answer
    } else if (correct) {
      players[currentPlayerIndex].score += diceValue; // Normal points for correct low-risk answer
    }

    // Move to the next player
    currentPlayerIndex = (currentPlayerIndex + 1) % players.length;

    res.json({ correct, tip });
  });
});

// End Game Route
router.post("/end-game", (req, res) => {
  const query = "INSERT INTO leaderboard (player_id, score) VALUES (?, ?)";

  players.forEach((player) => {
    db.query(query, [player.id, player.score], (err) => {
      if (err) console.error("Error saving leaderboard:", err);
    });
  });

  // Reset the game state
  players = [];
  currentPlayerIndex = 0;

  res.redirect("/leaderboard");
});

// Leaderboard View Route
router.get("/leaderboard", (req, res) => {
  const query = `
    SELECT p.name, l.score 
    FROM leaderboard l 
    JOIN players p ON l.player_id = p.id 
    ORDER BY l.score DESC
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching leaderboard:", err);
      return res.status(500).send("Error fetching leaderboard");
    }

    res.render("leaderboard", { leaderboard: results });
  });
});

module.exports = router;
