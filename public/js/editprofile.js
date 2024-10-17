$(document).ready(function () {
  const currentUsername = $("#username").data("current-username");

  // Initially enable the button
  $("#saveChangesBtn").prop("disabled", false);

  $("#username").on("input", function () {
    const username = $(this).val();

    if (username !== currentUsername && username.length > 0) {
      $.ajax({
        url: "/check-username",
        method: "GET",
        data: { username: username },
        success: function (response) {
          if (response.available) {
            // Username is available
            $("#username").css("border", "2px solid green");
            $("#username-status")
              .text("Username available")
              .css("color", "green");
            $("#saveChangesBtn").prop("disabled", false); // Enable button
          } else {
            // Username is taken by another user
            $("#username").css("border", "2px solid red");
            $("#username-status")
              .text("Username already taken")
              .css("color", "red");
            $("#saveChangesBtn").prop("disabled", true); // Disable button
          }
        },
        error: function () {
          $("#username-status")
            .text("Error checking username")
            .css("color", "red");
        },
      });
    } else {
      // If username is unchanged or empty, reset border style and clear status message
      $("#username").css("border", "");
      $("#username-status").text("");

      // Allow submission if the username is unchanged
      $("#saveChangesBtn").prop("disabled", false); // Enable button
    }
  });
});
