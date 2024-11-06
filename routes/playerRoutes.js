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

    const currentPlayerIndex = req.session.currentPlayerIndex;
    const players = req.session.players;

    if (!players || players.length === 0) {
      console.error("No players found in session.");
      return res.status(500).send("No players found in session.");
    }

    const currentPlayer = players[currentPlayerIndex];
    const diceValue = req.session.diceValue; // Retrieve the dice value stored in the session

    if (!diceValue) {
      console.error("No dice value found in session.");
      return res.status(500).send("No dice value found.");
    }

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
      playerId: currentPlayer,
      points,
      sessionCode,
    });

    const updateScoreQuery = `
      UPDATE session_players 
      SET score = score + ? 
      WHERE session_id = ? AND player_id = ?
    `;

    db.query(
      updateScoreQuery,
      [points, sessionCode, currentPlayer],
      (updateErr) => {
        if (updateErr) {
          console.error("Database error while updating score:", updateErr);
          return res.status(500).send("Failed to update player score.");
        }

        // Update the current player index
        req.session.currentPlayerIndex =
          (currentPlayerIndex + 1) % players.length;

        // Save the updated session state before emitting the next turn
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error("Error saving session:", saveErr);
            return res.status(500).json({
              success: false,
              message: "Failed to update player turn.",
            });
          }

          // Emit `turnEnded` to all players in the session AFTER saving session
          const nextPlayerIndex = req.session.currentPlayerIndex;
          const nextPlayer = players[nextPlayerIndex];

          console.log(`It's now ${nextPlayer}'s turn`);

          req.app.get("io").to(sessionCode).emit("turnEnded", {
            currentPlayer: nextPlayer, // Send just the player name
            moveSteps: moveSteps, // Inform all players about the steps
          });

          // Respond to the player who made the move
          res.json({
            success: true,
            points,
            moveSteps,
            message: responseMessage,
            currentPlayer: nextPlayer, // Send just the player name
          });
        });
      }
    );
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
