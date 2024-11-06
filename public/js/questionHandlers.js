export function setupQuestionHandling(socket) {
  // Handle low-risk button click
  const lowRiskButton = document.getElementById("lowRiskBtn");
  if (lowRiskButton) {
    lowRiskButton.addEventListener("click", () => {
      selectQuestion("easy");
    });
  }

  // Handle high-risk button click
  const highRiskButton = document.getElementById("highRiskBtn");
  if (highRiskButton) {
    highRiskButton.addEventListener("click", () => {
      selectQuestion("hard");
    });
  }

  // Attach the answer submission listener once
  const submitAnswerButton = document.getElementById("submitAnswerBtn");
  if (submitAnswerButton) {
    submitAnswerButton.addEventListener("click", () => {
      const selectedOption = document.querySelector(
        'input[name="option"]:checked'
      );

      if (!selectedOption) {
        alert("Please select an option before submitting.");
        return;
      }

      const answer = selectedOption.value;
      const questionId = submitAnswerButton.dataset.questionId;
      const difficulty = submitAnswerButton.dataset.difficulty;

      // Disable the submit button to prevent spamming
      submitAnswerButton.disabled = true;

      // Submit the answer using `/answer-question`
      fetch("/onlinegame/answer-question", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          questionId,
          answer,
          difficulty,
        }),
        credentials: "same-origin",
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error("Failed to submit answer.");
          }
          return response.json();
        })
        .then((result) => {
          if (result.success) {
            console.log("Answer submitted successfully.");

            // Display the response message (e.g., correct or incorrect with tip)
            alert(result.message);

            // Emit the `questionAnswered` event
            socket.emit("questionAnswered", {
              playerId: window.currentUser,
              currentPlayer: result.currentPlayer,
            });

            // Show movement steps on the game board
            document.getElementById(
              "diceResult"
            ).textContent = `You can move ${result.moveSteps} steps.`;

            // Hide the question section and proceed to next step
            document.getElementById("questionSection").style.display = "none";
            document.getElementById("gameBoard").style.display = "block";
          } else {
            console.error("Answer submission failed.");
          }
        })
        .catch((error) => {
          console.error("Error submitting answer:", error);
        })
        .finally(() => {
          // Re-enable the submit button after processing
          submitAnswerButton.disabled = false;
        });
    });
  }

  // Function to select a question based on difficulty
  function selectQuestion(difficulty) {
    console.log(`Selecting a ${difficulty} question...`);

    // Send a request to the server to get a question
    fetch("/onlinegame/select-question", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ difficulty }),
      credentials: "same-origin",
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to get a question.");
        }
        return response.json();
      })
      .then((data) => {
        if (data.success) {
          // Show the question
          document.getElementById("questionDifficulty").style.display = "none";
          const questionSection = document.getElementById("questionSection");
          questionSection.style.display = "block";

          const questionTextElement = document.getElementById("questionText");
          questionTextElement.textContent = data.question.question;

          // Populate options
          document.getElementById("optionA").value = "A";
          document.getElementById("optionB").value = "B";
          document.getElementById("optionC").value = "C";
          document.getElementById("optionD").value = "D";

          document.querySelector("label[for='optionA']").textContent =
            data.question.option_a;
          document.querySelector("label[for='optionB']").textContent =
            data.question.option_b;
          document.querySelector("label[for='optionC']").textContent =
            data.question.option_c;
          document.querySelector("label[for='optionD']").textContent =
            data.question.option_d;

          // Store the question ID and difficulty for later use
          submitAnswerButton.dataset.questionId = data.question.id;
          submitAnswerButton.dataset.difficulty = difficulty;
        } else {
          console.error("Failed to get a question.");
        }
      })
      .catch((error) => {
        console.error("Error fetching question:", error);
      });
  }
}
