// Wait until the DOM is fully loaded
document.addEventListener("DOMContentLoaded", () => {
  const diceRollBtn = document.querySelector("#roll-dice-btn");
  const playerTurn = document.querySelector("#player-turn");
  const currentPlayerName = playerTurn.getAttribute("data-player-name");

  // Get the hidden input field for the dice roll
  const hiddenDiceRollInput = document.getElementById("hidden-dice-roll");

  // Display current player's turn
  if (currentPlayerName) {
    playerTurn.textContent = `${currentPlayerName}'s turn. Roll the dice!`;
  }

  // Handle Roll Dice Button click
  diceRollBtn?.addEventListener("click", (e) => {
    e.preventDefault(); // Prevent form submission right away

    let iteration = 0;
    const maxIterations = 10; // Number of times to change faces
    const intervalTime = 100; // Time between each face change in ms

    // Add the bounce animation class to the dice
    const diceImg = document.getElementById("dice-img");
    const diceFaces = [
      "/images/dice1.png",
      "/images/dice2.png",
      "/images/dice3.png",
      "/images/dice4.png",
      "/images/dice5.png",
      "/images/dice6.png",
    ];

    // Function to iterate through dice faces
    const interval = setInterval(() => {
      const randomFace = Math.floor(Math.random() * 6); // Random dice face
      diceImg.src = diceFaces[randomFace]; // Update dice image
      iteration++;

      if (iteration >= maxIterations) {
        clearInterval(interval); // Stop the face changing

        // Final dice roll result
        const finalDiceRoll = Math.floor(Math.random() * 6) + 1; // Generate the final roll
        diceImg.src = diceFaces[finalDiceRoll - 1]; // Show final dice face

        // Store the rolled value in the hidden input
        hiddenDiceRollInput.value = finalDiceRoll; // Set the dice roll value

        // Remove the bounce animation
        diceImg.classList.remove("bouncing");

        // Submit the form after a small delay
        setTimeout(() => {
          document.getElementById("roll-dice-form").submit();
        }, 500);
      }
    }, intervalTime);
  });
});
