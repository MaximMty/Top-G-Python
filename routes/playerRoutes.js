const express = require("express");
const router = express.Router();
const db = require("./db");

router.post("/answer-question", (req, res) => {
  const sessionCode = req.session ? req.session.session_id : null;
  const { questionId, answer, difficulty } = req.body;

  if (!sessionCode) {
    console.error("Session code is not defined");
    return res.status(400).send("No session code provided.");
  }

  if (!questionId || !answer || !difficulty) {
    console.error("Missing question data:", req.body);
    return res.status(400).send("Missing question data.");
  }

  // Fetch the current game session from the database
  const getSessionQuery = `SELECT * FROM game_sessions WHERE session_id = ?`;
  db.query(getSessionQuery, [sessionCode], (sessionErr, sessionResults) => {
    if (sessionErr) {
      console.error("Database error while fetching session:", sessionErr);
      return res.status(500).send("Failed to fetch session.");
    }

    if (sessionResults.length === 0) {
      console.error("Session not found with id:", sessionCode);
      return res.status(404).send("Session not found.");
    }

    const gameSession = sessionResults[0];
    const currentPlayerIndex = gameSession.current_player_index;

    // Fetch the players from the database
    const getPlayersQuery = `SELECT player_id, finished FROM session_players WHERE session_id = ? ORDER BY id ASC`;
    db.query(getPlayersQuery, [sessionCode], (playersErr, playersResults) => {
      if (playersErr) {
        console.error("Database error while fetching players:", playersErr);
        return res.status(500).send("Failed to fetch players.");
      }

      if (playersResults.length === 0) {
        console.error("No players found in session:", sessionCode);
        return res.status(500).send("No players found in session.");
      }

      // Extract the list of players and their finished status
      const players = playersResults.map((row) => ({
        playerId: row.player_id,
        finished: row.finished,
      }));

      if (currentPlayerIndex < 0 || currentPlayerIndex >= players.length) {
        console.error("Invalid current player index:", currentPlayerIndex);
        return res.status(500).send("Invalid current player index.");
      }

      const currentPlayer = players[currentPlayerIndex];

      if (currentPlayer.finished) {
        console.error("Current player has already finished.");
        return res.status(403).send("Player has already finished.");
      }

      const diceValue = req.session.diceValue;

      if (!diceValue) {
        console.error("No dice value found in session.");
        return res.status(500).send("No dice value found.");
      }

      const questionTable =
        difficulty === "hard" ? "high_risk_questions" : "low_risk_questions";
      const query = `SELECT correct_answer, tip FROM ${questionTable} WHERE id = ?`;

      db.query(query, [questionId], (err, results) => {
        if (err) {
          console.error("Database error while checking the answer:", err);
          return res.status(500).send("Failed to check the answer.");
        }

        if (results.length === 0) {
          console.error("Question not found with id:", questionId);
          return res.status(404).send("Question not found.");
        }

        const correctAnswer = results[0].correct_answer;
        const tip = results[0].tip;

        let points = 0;
        let moveSteps = 0;
        let responseMessage = "";

        // Determine points and moves based on the answer and difficulty
        if (answer === correctAnswer) {
          points = difficulty === "hard" ? 20 : 10;
          moveSteps = difficulty === "hard" ? diceValue * 2 : diceValue;
          responseMessage = `Correct! You've earned ${points} points and can move ${moveSteps} steps!`;
        } else {
          points = difficulty === "hard" ? 0 : 5;
          moveSteps = difficulty === "hard" ? 0 : diceValue;
          responseMessage =
            difficulty === "hard"
              ? `Incorrect. The correct answer was '${correctAnswer}'. No points awarded.`
              : `Incorrect. The correct answer was '${correctAnswer}'. Here's a tip: ${tip}. You can move ${moveSteps} steps.`;
        }

        console.log("Updating score for player:", {
          playerId: currentPlayer.playerId,
          points,
          sessionCode,
        });

        const updateScoreQuery = `
          UPDATE session_players 
          SET score = score + ? 
          WHERE session_id = ? AND player_id = ?
        `;

        // Update player's score
        db.query(
          updateScoreQuery,
          [points, sessionCode, currentPlayer.playerId],
          (updateErr) => {
            if (updateErr) {
              console.error("Database error while updating score:", updateErr);
              return res.status(500).send("Failed to update player score.");
            }

            // Find the next player who has not finished
            let nextPlayerIndex = (currentPlayerIndex + 1) % players.length;
            while (
              players[nextPlayerIndex].finished &&
              nextPlayerIndex !== currentPlayerIndex
            ) {
              nextPlayerIndex = (nextPlayerIndex + 1) % players.length;
            }

            const updatePlayerIndexQuery = `
              UPDATE game_sessions 
              SET current_player_index = ? 
              WHERE session_id = ?
            `;

            // Update current player index in the database
            db.query(
              updatePlayerIndexQuery,
              [nextPlayerIndex, sessionCode],
              (playerIndexErr) => {
                if (playerIndexErr) {
                  console.error(
                    "Database error while updating player index:",
                    playerIndexErr
                  );
                  return res.status(500).send("Failed to update player turn.");
                }

                req.app
                  .get("io")
                  .to(sessionCode)
                  .emit("turnEnded", {
                    currentPlayer: { name: players[nextPlayerIndex].playerId },
                    moveSteps: moveSteps,
                  });

                // Respond to the player who made the move
                res.json({
                  success: true,
                  points,
                  moveSteps,
                  message: responseMessage,
                  currentPlayer: { name: players[nextPlayerIndex].playerId },
                });
              }
            );
          }
        );
      });
    });
  });
});

router.post("/select-question", (req, res) => {
  const sessionCode = req.session.session_id;
  const { difficulty } = req.body;

  if (!sessionCode) {
    return res.status(400).send("No session code provided.");
  }

  if (!difficulty) {
    return res.status(400).send("Missing difficulty parameter.");
  }

  // Determine which table to query based on difficulty
  const questionTable =
    difficulty === "hard" ? "high_risk_questions" : "low_risk_questions";

  // Fetch a random question from the respective table
  const query = `SELECT id, question, option_a, option_b, option_c, option_d FROM ${questionTable} ORDER BY RAND() LIMIT 1`;
  db.query(query, (err, results) => {
    if (err) {
      console.error("Database error while selecting the question:", err);
      return res.status(500).send("Failed to select a question.");
    }

    if (results.length === 0) {
      return res.status(404).send("No questions available.");
    }

    // Send the question to the client
    res.json({
      success: true,
      question: results[0],
    });
  });
});

module.exports = router;
