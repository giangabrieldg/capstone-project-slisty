document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('form');
  if (!form) {
    console.error('Form element not found');
    return;
  }

  const messageDiv = document.createElement('div');
  messageDiv.className = 'text-center mt-3';
  form.appendChild(messageDiv);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const response = await fetch('http://localhost:3000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();
    messageDiv.textContent = data.message;
    messageDiv.className = `text-center mt-3 ${data.success ? 'text-success' : 'text-danger'}`;

    if (data.success) {
      window.location.href = 'index.html'; // Redirect on success
    }
  });
});