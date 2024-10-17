$(document).ready(function () {
  $("#username").on("input", function () {
    const username = $(this).val();

    if (username.length > 0) {
      $.ajax({
        url: "/check-username",
        method: "GET",
        data: { username: username },
        success: function (response) {
          if (response.available) {
            $("#username").css("border", "2px solid green");
            $("#username-status")
              .text("Username available")
              .css("color", "green");
            $("#registerBtn").prop("disabled", false); // Enable register button
          } else {
            $("#username").css("border", "2px solid red");
            $("#username-status")
              .text("Username already taken")
              .css("color", "red");
            $("#registerBtn").prop("disabled", true); // Disable button
          }
        },
        error: function () {
          $("#username-status")
            .text("Error checking username")
            .css("color", "red");
        },
      });
    } else {
      $("#username").css("border", "");
      $("#username-status").text("");
      $("#registerBtn").prop("disabled", true); // Disable button if empty
    }
  });
});
