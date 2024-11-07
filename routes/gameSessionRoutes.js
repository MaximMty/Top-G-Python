const express = require("express");
const router = express.Router();
const db = require("../routes/db");
const { v4: uuidv4 } = require("uuid");

router.post("/create-session", (req, res) => {
  if (!req.session.user) {
    return res.status(403).send("Not logged in.");
  }

  const sessionId = uuidv4();
  const userId = req.session.user;

  const insertSessionQuery =
    "INSERT INTO game_sessions (session_id, host_id) VALUES (?, ?)";
  db.query(insertSessionQuery, [sessionId, userId], (err, results) => {
    if (err) {
      console.error("Database error while creating session:", err);
      return res.status(500).send("Failed to create session.");
    }

    // Set the session host_id and session_id
    req.session.session_id = sessionId;
    req.session.host_id = userId; // Set the host ID in the session

    // Add the host as a player in the session_players table
    const insertPlayerQuery = `
      INSERT INTO session_players (session_id, player_id)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE player_id = player_id;`;

    db.query(insertPlayerQuery, [sessionId, userId], (playerErr) => {
      if (playerErr) {
        console.error("Database error while adding host as player:", playerErr);
        return res.status(500).send("Failed to add host as player.");
      }

      req.session.save((saveErr) => {
        if (saveErr) {
          console.error("Error saving session (create-session):", saveErr);
          return res.status(500).send("Failed to create session.");
        }

        console.log(
          "Session successfully saved (create-session):",
          req.session
        );
        res.redirect(`/onlinegame`);
      });
    });
  });
});

router.post("/join-session", (req, res) => {
  if (!req.session.user) {
    console.log("User not logged in, cannot join session.");
    return res.status(403).send("Not logged in.");
  }

  const { sessionCode } = req.body;
  const userId = req.session.user;

  if (!sessionCode) {
    console.log("No session code provided.");
    return res.status(400).send("No session code provided.");
  }

  // Add the new player to the session players array if they are not already there
  const insertQuery = `
    INSERT INTO session_players (session_id, player_id)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE player_id = player_id;`;

  db.query(insertQuery, [sessionCode, userId], (err, results) => {
    if (err) {
      console.error("Database error while adding player to session:", err);
      return res.status(500).send("Failed to join session.");
    }

    // Update the session with the current session code
    req.session.session_id = sessionCode;

    // Retrieve the host ID from the database
    db.query(
      "SELECT host_id FROM game_sessions WHERE session_id = ?",
      [sessionCode],
      (selectErr, selectResults) => {
        if (selectErr) {
          console.error("Database error while retrieving host:", selectErr);
          return res.status(500).send("Failed to retrieve host information.");
        }

        if (selectResults.length > 0) {
          req.session.host_id = selectResults[0].host_id; // Set the host ID in the session
        }

        req.session.save((saveErr) => {
          if (saveErr) {
            console.error("Error saving session (join-session):", saveErr);
            return res.status(500).send("Failed to save session.");
          }

          console.log("Player successfully joined session:", userId);
          res.redirect(`/onlinegame`);
        });
      }
    );
  });
});

module.exports = router;
