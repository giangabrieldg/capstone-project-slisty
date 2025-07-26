// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
  // Get the inquiry form element
  const inquiryForm = document.getElementById('inquiryForm');
  if (!inquiryForm) return; // Exit if form is not found

  // Add submit event listener to the form
  inquiryForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // Prevent default form submission

    // Extract form input values
    const name = document.getElementById('inquiryName').value;
    const email = document.getElementById('inquiryEmail').value;
    const phone = document.getElementById('inquiryPhone').value;
    const subject = document.getElementById('inquirySubject').value;
    const message = document.getElementById('inquiryMessage').value;
    const recaptchaToken = grecaptcha.getResponse(); // Get reCAPTCHA token

    // Validate reCAPTCHA
    if (!recaptchaToken) {
      alert('Please complete the reCAPTCHA.');
      return;
    }

    try {
      // Prepare headers for API request
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`; // Add JWT token if logged in

      // Send inquiry data to the backend
      const response = await fetch('http://localhost:3000/api/inquiries', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name, email, phone, subject, message, recaptchaToken }),
      });

      // Parse response
      const result = await response.json();
      if (response.ok) {
        // Success: Show confirmation and reset form
        alert('Inquiry submitted successfully! You will receive a confirmation email.');
        inquiryForm.reset();
        grecaptcha.reset(); // Reset reCAPTCHA widget
      } else {
        // Error: Display error message
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error submitting inquiry:', error);
      alert('Error submitting inquiry. Please try again.');
    }
  });
});