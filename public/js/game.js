// Wait until the DOM is fully loaded
document.addEventListener("DOMContentLoaded", () => {
  const diceRollBtn = document.querySelector("#roll-dice-btn");
  const questionForm = document.querySelector("#question-form");
  const diceResult = document.querySelector("#dice-result");
  const playerTurn = document.querySelector("#player-turn");
  const currentPlayerName = playerTurn.getAttribute("data-player-name");

  // Handle dice roll button click
  diceRollBtn?.addEventListener("click", () => {
    const diceRoll = Math.floor(Math.random() * 6) + 1;
    diceResult.textContent = `You rolled a ${diceRoll}`;
  });

  // Handle form submission for question choice (high/low risk)
  questionForm?.addEventListener("submit", (e) => {
    const selectedType = e.submitter.value; // 'high' or 'low' from button value
    const confirmMsg =
      selectedType === "high"
        ? "You selected a high-risk question. Are you sure?"
        : "You selected a low-risk question.";

    if (!confirm(confirmMsg)) {
      e.preventDefault(); // Prevent form submission if user cancels
    }
  });

  // Display current player's turn
  if (currentPlayerName) {
    playerTurn.textContent = `${currentPlayerName}'s turn. Roll the dice!`;
  }
});
