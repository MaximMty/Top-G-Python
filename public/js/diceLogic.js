export function setupDiceRolling(socket) {
  const rollDiceButton = document.getElementById("roll-dice-btn");
  if (rollDiceButton) {
    rollDiceButton.addEventListener("click", () => {
      console.log("Rolling the dice...");

      // Send a request to the server to roll the dice
      fetch(`/onlinegame/roll-dice`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
      })
        .then((response) => {
          if (!response.ok) {
            return response.json().then((data) => {
              throw new Error(data.message || "Unknown error occurred");
            });
          }
          return response.json();
        })
        .then((data) => {
          if (data.success) {
            console.log(`Dice roll successful. You rolled a ${data.diceRoll}`);
            showDiceRollResult("You", data.diceRoll);

            // Emit the dice rolled event to update other clients
            socket.emit("diceRolled", {
              playerId: window.currentUser,
              diceValue: data.diceRoll,
              currentPlayer: { name: window.currentUser }, // Ensure currentPlayer has a `name` property
            });

            // Ensure questionDifficulty element exists before trying to change its style
            const questionDifficultyElement =
              document.getElementById("questionDifficulty");
            if (questionDifficultyElement) {
              questionDifficultyElement.style.display = "block"; // Show difficulty selection
            } else {
              console.error(
                "Element #questionDifficulty not found in the DOM."
              );
            }
          } else {
            console.error("Dice roll failed.");
          }
        })
        .catch((error) => {
          console.error("Error rolling dice:", error);
        });
    });
  }
}

export function updatePlayerTurn(currentPlayer) {
  const playerTurnElement = document.getElementById("playerTurn");
  const rollDiceButton = document.getElementById("roll-dice-btn");

  if (!currentPlayer || !currentPlayer.name) {
    console.error("Current player is undefined or missing the name property");
    if (playerTurnElement) {
      playerTurnElement.textContent = "Waiting for the current player...";
    }
    if (rollDiceButton) {
      rollDiceButton.style.display = "none";
    }
    return;
  }

  if (playerTurnElement) {
    playerTurnElement.textContent = `It's ${currentPlayer.name}'s turn`;
  }

  // Make sure the roll dice button is only shown for the current player
  if (currentPlayer.name === window.currentUser) {
    console.log("It's your turn, showing the roll dice button.");
    if (rollDiceButton) {
      rollDiceButton.style.display = "block";
    }
  } else {
    console.log("It's not your turn, hiding the roll dice button.");
    if (rollDiceButton) {
      rollDiceButton.style.display = "none";
    }
  }
}

export function showDiceRollResult(playerId, diceValue) {
  const diceResultElement = document.getElementById("diceResult");
  if (diceResultElement) {
    diceResultElement.textContent = `Player ${playerId} rolled a ${diceValue}`;
  }
}
