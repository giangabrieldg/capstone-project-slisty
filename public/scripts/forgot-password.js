// Toggle between email and security question forms
document.getElementById("useSecretQuestion").addEventListener("click", (e) => {
  e.preventDefault();
  document.getElementById("forgot-password-form").style.display = "none";
  document.getElementById("forgot-password-secret-form").style.display =
    "block";
  document.getElementById("useSecretQuestion").parentElement.style.display =
    "none";
  document.getElementById("backToEmail").style.display = "block";
  document.getElementById("message").innerHTML = "";
});

document.getElementById("useEmail").addEventListener("click", (e) => {
  e.preventDefault();
  document.getElementById("forgot-password-form").style.display = "block";
  document.getElementById("forgot-password-secret-form").style.display = "none";
  document.getElementById("backToEmail").style.display = "none";
  document.getElementById("useSecretQuestion").parentElement.style.display =
    "block";
  document.getElementById("message").innerHTML = "";

  // Reset secret question form
  document.getElementById("name").value = "";
  document.getElementById("secretAnswer").value = "";
  document.getElementById("questionSection").style.display = "none";
  document.getElementById("securityQuestionDisplay").textContent = "";
});

// Email-based password recovery
document
  .getElementById("forgot-password-form")
  .addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const messageDiv = document.getElementById("message");

    try {
      const response = await fetch(
        `${window.API_BASE_URL}/api/password/forgot-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        }
      );

      const data = await response.json();
      messageDiv.innerHTML = `<div class="alert ${
        response.ok ? "alert-success" : "alert-danger"
      }">${data.message}</div>`;
    } catch (error) {
      console.error("Error:", error);
      messageDiv.innerHTML = `<div class="alert alert-danger">An error occurred. Please try again.</div>`;
    }
  });

// Security question-based password recovery
document
  .getElementById("forgot-password-secret-form")
  .addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("emailForSecret").value;
    const secretAnswer = document.getElementById("secretAnswer").value;

    try {
      const response = await fetch(
        `${window.API_BASE_URL}/api/password/forgot-password-secret`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, secretAnswer }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        Swal.fire({
          icon: "success",
          title: "Verified!",
          text: data.message,
          confirmButtonColor: "#2c9045",
        });

        setTimeout(() => {
          window.location.href = `/customer/reset-password.html?token=${data.token}`;
        }, 2000);
      } else {
        Swal.fire({
          icon: "error",
          title: "Verification Failed",
          text: data.message,
          confirmButtonColor: "#2c9045",
        });
      }
    } catch (error) {
      console.error("Error:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "An error occurred. Please try again.",
        confirmButtonColor: "#2c9045",
      });
    }
  });

// Get security question
document
  .getElementById("getQuestionBtn")
  .addEventListener("click", async () => {
    const email = document.getElementById("emailForSecret").value;
    const messageDiv = document.getElementById("message");

    if (!email) {
      Swal.fire({
        icon: "warning",
        title: "Email Required",
        text: "Please enter your email address first.",
        confirmButtonColor: "#2c9045",
      });
      return;
    }

    try {
      const response = await fetch(
        `${window.API_BASE_URL}/api/password/get-secret-question`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        document.getElementById("securityQuestionDisplay").textContent =
          data.secretQuestion;
        document.getElementById("questionSection").style.display = "block";

        Swal.fire({
          icon: "success",
          title: "Security Question Found",
          text: `Hello ${data.userName}! Please answer your security question.`,
          confirmButtonColor: "#2c9045",
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "Not Found",
          text: data.message,
          confirmButtonColor: "#2c9045",
        });
      }
    } catch (error) {
      console.error("Error:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "An error occurred. Please try again.",
        confirmButtonColor: "#2c9045",
      });
    }
  });
