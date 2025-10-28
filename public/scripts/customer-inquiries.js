// scripts/customer-inquiries.js
document.addEventListener("DOMContentLoaded", () => {
  const inquiryForm = document.getElementById("inquiryForm");
  if (!inquiryForm) return;

  inquiryForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("inquiryName").value;
    const email = document.getElementById("inquiryEmail").value;
    const phone = document.getElementById("inquiryPhone").value;
    const subject = document.getElementById("inquirySubject").value;
    const message = document.getElementById("inquiryMessage").value;
    const recaptchaToken = grecaptcha.getResponse();

    if (!recaptchaToken) {
      Swal.fire({
        icon: "error",
        title: "Oops...",
        text: "Please complete the reCAPTCHA!",
        confirmButtonColor: "#2c9045",
      });
      return;
    }

    try {
      const token = sessionStorage.getItem("token");
      const headers = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      // Use the dynamic API_BASE_URL
      const response = await fetch(`${window.API_BASE_URL}/api/inquiries`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          name,
          email,
          phone,
          subject,
          message,
          recaptchaToken,
        }),
      });

      const result = await response.json();
      if (response.ok) {
        Swal.fire({
          title: "Success!",
          text: "Inquiry Submiitted! You will received a confirmation email shortly.",
          icon: "success",
          confirmButtonColor: "#2c9045",
        });
        inquiryForm.reset();
        grecaptcha.reset();
      } else {
        Swal.fire({
          icon: "error",
          title: "Oops...",
          text: `Error: ${result.error}`,
          confirmButtonColor: "#2c9045",
        });
      }
    } catch (error) {
      console.error("Error submitting inquiry:", error);
      Swal.fire({
        icon: "error",
        title: "Oops...",
        text: "Error submitting inquiry. Please try again.",
        confirmButtonColor: "#2c9045",
      });
    }
  });
});
