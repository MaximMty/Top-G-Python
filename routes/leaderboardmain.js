const express = require("express");
const router = express.Router();
const db = require("../routes/db");

// Add a route to render the leaderboard page
router.get("/leaderboardmain", (req, res) => {
  const query = "SELECT * FROM leaderboard ORDER BY score DESC LIMIT 10";

  db.query(query, (err, results) => {
    if (err) {
      console.error("Database error fetching leaderboard:", err);
      return res.status(500).send("Failed to retrieve leaderboard.");
    }

    res.render("leaderboardmain", {
      title: "Leaderboard",
      players: results,
    });
  });
});

module.exports = router;
