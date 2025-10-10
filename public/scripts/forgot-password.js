document.getElementById('forgot-password-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const messageDiv = document.getElementById('message');

  try {
    const response = await fetch(`${window.API_BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    const data = await response.json();
    messageDiv.innerHTML = `<div class="alert ${response.ok ? 'alert-success' : 'alert-danger'}">${data.message}</div>`;
  } catch (error) {
    console.error('Error:', error);
    messageDiv.innerHTML = `<div class="alert alert-danger">An error occurred. Please try again.</div>`;
  }
});