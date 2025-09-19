document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('reset-password-form');
  if (!form) {
    console.error('Form with ID "reset-password-form" not found');
    return;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    const messageDiv = document.getElementById('message');

    if (!passwordInput || !confirmPasswordInput || !messageDiv) {
      console.error('One or more form elements not found');
      messageDiv.innerHTML = `<div class="alert alert-danger">Form elements missing. Please refresh the page.</div>`;
      return;
    }

    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const email = urlParams.get('email');

    if (!token || !email) {
      messageDiv.innerHTML = `<div class="alert alert-danger">Invalid or missing reset link. Please request a new password reset.</div>`;
      return;
    }

    if (password !== confirmPassword) {
      messageDiv.innerHTML = `<div class="alert alert-danger">Passwords do not match.</div>`;
      return;
    }

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email, password })
      });

      const data = await response.json();
      messageDiv.innerHTML = `<div class="alert ${response.ok ? 'alert-success' : 'alert-danger'}">${data.message}</div>`;
      if (response.ok) {
        setTimeout(() => window.location.href = '/customer/login.html', 2000);
      }
    } catch (error) {
      console.error('Error:', error);
      messageDiv.innerHTML = `<div class="alert alert-danger">An error occurred. Please try again.</div>`;
    }
  });
});