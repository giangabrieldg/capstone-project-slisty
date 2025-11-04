document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("reset-password-form");
  if (!form) {
    console.error('Form with ID "reset-password-form" not found');
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const passwordInput = document.getElementById("password");
    const confirmPasswordInput = document.getElementById("confirm-password");

    if (!passwordInput || !confirmPasswordInput) {
      console.error("One or more form elements not found");
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Form elements missing. Please refresh the page.",
        confirmButtonColor: "#2c9045",
      });
      return;
    }

    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");

    if (!token) {
      Swal.fire({
        icon: "error",
        title: "Invalid Reset Link",
        text: "Invalid or missing reset link. Please request a new password reset.",
        confirmButtonColor: "#2c9045",
      });
      return;
    }

    if (password !== confirmPassword) {
      Swal.fire({
        icon: "error",
        title: "Passwords Don't Match",
        text: "Please make sure both passwords match.",
        confirmButtonColor: "#2c9045",
      });
      return;
    }

    // Validate password strength (optional - you can remove this if not needed)
    if (password.length < 6) {
      Swal.fire({
        icon: "warning",
        title: "Weak Password",
        text: "Password should be at least 6 characters long.",
        confirmButtonColor: "#2c9045",
      });
      return;
    }

    try {
      // Show loading state
      Swal.fire({
        title: "Resetting Password...",
        text: "Please wait while we update your password.",
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      // Use the correct endpoint and send only token and password
      const response = await fetch(
        `${window.API_BASE_URL}/api/password/reset-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, password }),
        }
      );

      const data = await response.json();

      // Close loading SweetAlert
      Swal.close();

      if (response.ok) {
        await Swal.fire({
          icon: "success",
          title: "Password Reset!",
          text: data.message,
          confirmButtonColor: "#2c9045",
          timer: 2000,
          showConfirmButton: false,
        });

        window.location.href = "/customer/login.html";
      } else {
        await Swal.fire({
          icon: "error",
          title: "Reset Failed",
          text: data.message,
          confirmButtonColor: "#2c9045",
        });
      }
    } catch (error) {
      console.error("Error:", error);
      Swal.close(); // Close loading alert if open

      await Swal.fire({
        icon: "error",
        title: "Connection Error",
        text: "An error occurred. Please check your connection and try again.",
        confirmButtonColor: "#2c9045",
      });
    }
  });
});
