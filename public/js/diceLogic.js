export function setupDiceRolling(socket) {
  const rollDiceButton = document.getElementById("roll-dice-btn");
  const diceImg = document.getElementById("dice-img");
  const diceFaces = [
    "/images/dice1.png",
    "/images/dice2.png",
    "/images/dice3.png",
    "/images/dice4.png",
    "/images/dice5.png",
    "/images/dice6.png",
  ];

  if (rollDiceButton) {
    rollDiceButton.addEventListener("click", () => {
      console.log("Rolling the dice...");

      // Animation variables
      let iteration = 0;
      const maxIterations = 10; // Number of times to change faces
      const intervalTime = 100; // Time between each face change in ms

      // Animate the dice before getting the server response
      if (diceImg) {
        diceImg.classList.add("bouncing"); // Add bounce animation

        // Start the face-changing animation
        const interval = setInterval(() => {
          const randomFace = Math.floor(Math.random() * 6); // Random dice face
          diceImg.src = diceFaces[randomFace]; // Update dice image
          iteration++;

          if (iteration >= maxIterations) {
            clearInterval(interval); // Stop the face-changing animation
          }
        }, intervalTime);
      }

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

            // Display the final result after a slight delay to match the animation
            setTimeout(() => {
              if (diceImg) {
                diceImg.src = diceFaces[data.diceRoll - 1]; // Show final dice face
                diceImg.classList.remove("bouncing"); // Remove bounce animation
              }
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
            }, maxIterations * intervalTime);
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
  const finishTurnButton = document.getElementById("finishTurnBtn");

  if (!currentPlayer || !currentPlayer.name) {
    console.error("Current player is undefined or missing the name property");
    if (playerTurnElement) {
      playerTurnElement.textContent = "Waiting for the current player...";
    }
    if (rollDiceButton) {
      rollDiceButton.style.display = "none";
    }
    if (finishTurnButton) {
      finishTurnButton.style.display = "none";
    }
    return;
  }

  if (playerTurnElement) {
    playerTurnElement.textContent = `It's ${currentPlayer.name}'s turn`;
  }

  // Make sure the roll dice and finish turn buttons are only shown for the current player
  if (currentPlayer.name === window.currentUser) {
    console.log(
      "It's your turn, showing the roll dice and finish turn buttons."
    );
    if (rollDiceButton) {
      rollDiceButton.style.display = "block";
    }
    if (finishTurnButton) {
      finishTurnButton.style.display = "block";
    }
  } else {
    console.log(
      "It's not your turn, hiding the roll dice and finish turn buttons."
    );
    if (rollDiceButton) {
      rollDiceButton.style.display = "none";
    }
    if (finishTurnButton) {
      finishTurnButton.style.display = "none";
    }
  }
}

export function showDiceRollResult(playerId, diceValue) {
  const diceResultElement = document.getElementById("diceResult");
  if (diceResultElement) {
    diceResultElement.textContent = `Player ${playerId} rolled a ${diceValue}`;
  }
}
