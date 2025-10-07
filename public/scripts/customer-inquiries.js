// scripts/customer-inquiries.js
document.addEventListener('DOMContentLoaded', () => {
  const inquiryForm = document.getElementById('inquiryForm');
  if (!inquiryForm) return;

  // Use your cleaner approach
  const API_BASE_URL = window.location.origin === 'http://localhost:3000'
    ? 'http://localhost:3000'
    : 'https://capstone-project-slisty.onrender.com';

  inquiryForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('inquiryName').value;
    const email = document.getElementById('inquiryEmail').value;
    const phone = document.getElementById('inquiryPhone').value;
    const subject = document.getElementById('inquirySubject').value;
    const message = document.getElementById('inquiryMessage').value;
    const recaptchaToken = grecaptcha.getResponse();

    if (!recaptchaToken) {
      alert('Please complete the reCAPTCHA.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      // Use the dynamic API_BASE_URL
      const response = await fetch(`${API_BASE_URL}/api/inquiries`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name, email, phone, subject, message, recaptchaToken }),
      });

      const result = await response.json();
      if (response.ok) {
        alert('Inquiry submitted successfully! You will receive a confirmation email.');
        inquiryForm.reset();
        grecaptcha.reset();
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error submitting inquiry:', error);
      alert('Error submitting inquiry. Please try again.');
    }
  });
});