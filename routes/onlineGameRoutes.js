const express = require("express");
const router = express.Router();
const db = require("../routes/db"); // or '../db' if `db.js` is in the root folder
const { v4: uuidv4 } = require("uuid");

const gameSessionRoutes = require("./gameSessionRoutes");
const gamePlayRoutes = require("./gamePlayRoutes");
const playerRoutes = require("./playerRoutes");
const diceRoutes = require("./diceRoutes");

router.use("/", gameSessionRoutes);
router.use("/", gamePlayRoutes);
router.use("/", playerRoutes);
router.use("/", diceRoutes);

const POSITION_POINTS = [100, 75, 50, 25]; // Points for 1st, 2nd, 3rd, etc.

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

    const selectPlayersQuery = `
    SELECT session_players.player_id, users.avatar 
    FROM session_players 
    INNER JOIN users ON session_players.player_id = users.username 
    WHERE session_players.session_id = ?
  `;

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

        // Set protocol to 'http' by default if it can't be determined
        const protocol =
          req.protocol && req.protocol.includes("http") ? req.protocol : "http";
        const host = req.get("host");

        // Construct the full avatar URLs
        const playersWithAvatar = playersResults.map((player) => ({
          id: player.player_id,
          avatar: player.avatar
            ? `${protocol}://${host}${player.avatar}`
            : `${protocol}://${host}/uploads/avatars/default.png`,
        }));

        res.json({
          success: true,
          gameStarted,
          gameStage: gameSession.game_stage,
          host_id: hostId,
          players: playersWithAvatar,
          currentPlayerIndex: gameSession.current_player_index || 0,
        });
      }
    );
  });
});

router.post("/finish-turn", (req, res) => {
  const sessionCode = req.session.session_id;

  if (!sessionCode) {
    return res.status(400).send("No session code provided.");
  }

  const user = req.session.user;

  if (!user) {
    return res.status(400).send("User not found in session.");
  }

  // Update player status to finished in the database
  const updatePlayerStatusQuery = `
    UPDATE session_players 
    SET finished = TRUE 
    WHERE session_id = ? AND player_id = ?
  `;

  db.query(updatePlayerStatusQuery, [sessionCode, user], (updateErr) => {
    if (updateErr) {
      console.error("Error updating player status to finished:", updateErr);
      return res.status(500).send("Failed to update player status.");
    }

    // Count how many players have finished to determine the position
    const countFinishedPlayersQuery = `
      SELECT COUNT(*) AS finishedCount 
      FROM session_players 
      WHERE session_id = ? AND finished = TRUE
    `;

    db.query(
      countFinishedPlayersQuery,
      [sessionCode],
      (countErr, countResults) => {
        if (countErr) {
          console.error("Error counting finished players:", countErr);
          return res.status(500).send("Failed to count finished players.");
        }

        const finishedCount = countResults[0].finishedCount;
        const positionPoints = POSITION_POINTS[finishedCount - 1] || 0;

        // Update player's score with the position points
        const updateScoreQuery = `
        UPDATE session_players 
        SET score = score + ? 
        WHERE session_id = ? AND player_id = ?
      `;

        db.query(
          updateScoreQuery,
          [positionPoints, sessionCode, user],
          (scoreUpdateErr) => {
            if (scoreUpdateErr) {
              console.error(
                "Error updating player score with position points:",
                scoreUpdateErr
              );
              return res
                .status(500)
                .send("Failed to update player score with position points.");
            }

            // Check if all players have finished
            const checkAllFinishedQuery = `
          SELECT * FROM session_players 
          WHERE session_id = ? AND finished = FALSE
        `;

            db.query(
              checkAllFinishedQuery,
              [sessionCode],
              (checkErr, results) => {
                if (checkErr) {
                  console.error(
                    "Error checking players' finished status:",
                    checkErr
                  );
                  return res
                    .status(500)
                    .send("Failed to check players' status.");
                }

                if (results.length === 0) {
                  // All players have finished, end the game and compute final rankings
                  endGame(sessionCode, req, res);
                } else {
                  // Get the list of players to determine the next active player
                  const getPlayersQuery = `
              SELECT player_id, finished 
              FROM session_players 
              WHERE session_id = ? 
              ORDER BY id ASC
            `;

                  db.query(
                    getPlayersQuery,
                    [sessionCode],
                    (err, playersResults) => {
                      if (err) {
                        console.error("Database error fetching players:", err);
                        return res.status(500).send("Failed to fetch players.");
                      }

                      const players = playersResults.map(
                        (row) => row.player_id
                      );
                      const finishedPlayers = playersResults
                        .filter((row) => row.finished)
                        .map((row) => row.player_id);

                      let currentPlayerIndex = players.findIndex(
                        (player) => player === user
                      );
                      let nextPlayerIndex = getNextActivePlayerIndex(
                        players,
                        currentPlayerIndex,
                        finishedPlayers
                      );

                      const updatePlayerIndexQuery = `
                UPDATE game_sessions 
                SET current_player_index = ? 
                WHERE session_id = ?
              `;
                      db.query(
                        updatePlayerIndexQuery,
                        [nextPlayerIndex, sessionCode],
                        (playerIndexErr) => {
                          if (playerIndexErr) {
                            console.error(
                              "Database error while updating player index:",
                              playerIndexErr
                            );
                            return res
                              .status(500)
                              .send("Failed to update player turn.");
                          }

                          // Emit the turn-ended event to the clients with the new player
                          req.app
                            .get("io")
                            .to(sessionCode)
                            .emit("turnEnded", {
                              currentPlayer: { name: players[nextPlayerIndex] },
                              moveSteps: 0, // No immediate movement after finishing turn
                            });

                          res.json({
                            success: true,
                            message: `You have finished your turn and earned ${positionPoints} points.`,
                          });
                        }
                      );
                    }
                  );
                }
              }
            );
          }
        );
      }
    );
  });
});

// Function to determine the next active player
function getNextActivePlayerIndex(
  players,
  currentPlayerIndex,
  finishedPlayers
) {
  let nextIndex = (currentPlayerIndex + 1) % players.length;

  // Skip players who have finished the game
  while (finishedPlayers.includes(players[nextIndex])) {
    nextIndex = (nextIndex + 1) % players.length;

    // Safety measure to avoid infinite loop
    if (nextIndex === currentPlayerIndex) {
      // If we end up back at the current player, it means all players have finished
      break;
    }
  }

  return nextIndex;
}

// Function to handle ending the game
function endGame(sessionCode, req, res) {
  const getPlayerScoresQuery = `
    SELECT player_id, score 
    FROM session_players 
    WHERE session_id = ? 
    ORDER BY score DESC
  `;

  db.query(getPlayerScoresQuery, [sessionCode], (scoreErr, scoreResults) => {
    if (scoreErr) {
      console.error("Error fetching player scores:", scoreErr);
      return res.status(500).send("Failed to fetch player scores.");
    }

    // Calculate the final rankings
    const finalRankings = scoreResults.map((row, index) => {
      return {
        name: row.player_id,
        score: row.score,
        positionPoints: POSITION_POINTS[index] || 0,
      };
    });

    // Update leaderboard
    const insertLeaderboardQuery = `
      INSERT INTO leaderboard (name, score) VALUES ?
    `;
    const leaderboardValues = finalRankings.map((ranking) => [
      ranking.name,
      ranking.score,
    ]);

    db.query(insertLeaderboardQuery, [leaderboardValues], (leaderboardErr) => {
      if (leaderboardErr) {
        console.error("Error updating leaderboard:", leaderboardErr);
        return res.status(500).send("Failed to update leaderboard.");
      }

      // Update the game state to "finished"
      const updateGameStateQuery = `
        UPDATE game_sessions
        SET game_stage = 'finished'
        WHERE session_id = ?
      `;
      db.query(updateGameStateQuery, [sessionCode], (updateErr) => {
        if (updateErr) {
          console.error("Error updating game state to finished:", updateErr);
          return res.status(500).send("Failed to update game state.");
        }

        // Emit the `gameEnded` event with rankings to all clients
        req.app.get("io").to(sessionCode).emit("gameEnded", {
          rankings: finalRankings,
        });

        // Respond to the client confirming that the game has ended
        res.json({
          success: true,
          message: "Game has ended successfully.",
        });
      });
    });
  });
}

module.exports = router;
