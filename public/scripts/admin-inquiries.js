document.addEventListener('DOMContentLoaded', () => {
  const inquiriesTableBody = document.querySelector('#inquiriesTable tbody');
  const searchBar = document.querySelector('.search-bar');
  const dateFilter = document.getElementById('dateFilter');

  async function loadInquiries() {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        inquiriesTableBody.innerHTML = '<tr><td colspan="7">Please log in.</td></tr>';
        return;
      }

      const response = await fetch(`${window.API_BASE_URL}/api/inquiries`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        inquiriesTableBody.innerHTML = `<tr><td colspan="7">Error: ${error.message}</td></tr>`;
        return;
      }

      const inquiries = await response.json();
      renderInquiries(inquiries);
    } catch (error) {
      console.error('Error loading inquiries:', error);
      inquiriesTableBody.innerHTML = '<tr><td colspan="7">Error loading inquiries.</td></tr>';
    }
  }

  // Function to render inquiries in the table
  function renderInquiries(inquiries) {
    inquiriesTableBody.innerHTML = inquiries.map(inquiry => `
      <tr>
        <td>${inquiry.User?.name || inquiry.name}</td>
        <td>${inquiry.subject}</td>
        <td>${inquiry.message}</td>
        <td>${new Date(inquiry.createdAt).toISOString().split('T')[0]}</td>
        <td><span class="status ${inquiry.status.toLowerCase()}">${inquiry.status}</span></td>
        <td>
          ${inquiry.status === 'Replied' ? 
            inquiry.reply : 
            `<textarea class="form-control reply-text" rows="2" placeholder="Enter reply..."></textarea>`
          }
        </td>
        <td>
          ${inquiry.status === 'Replied' ? 
            '' : 
            `<button class="btn btn-success btn-sm send-reply" data-id="${inquiry.inquiryId}">Send Reply</button>`
          }
        </td>
      </tr>
    `).join('');

    document.querySelectorAll('.send-reply').forEach(button => {
      button.addEventListener('click', async () => {
        const inquiryId = parseInt(button.dataset.id);
        const replyText = button.closest('tr').querySelector('.reply-text').value;
        if (!replyText) {
          alert('Please enter a reply.');
          return;
        }

        try {
          const response = await fetch(`${window.API_BASE_URL}/api/inquiries/reply`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
            body: JSON.stringify({ inquiryId, reply: replyText }),
          });

          if (response.ok) {
            loadInquiries();
            alert('Reply sent successfully!');
          } else {
            const error = await response.json();
            alert(`Error: ${error.error}`);
          }
        } catch (error) {
          console.error('Error sending reply:', error);
          alert('Error sending reply.');
        }
      });
    });
  }

  // Function to filter inquiries based on search and date
  function filterInquiries() {
    const searchTerm = searchBar.value.toLowerCase();
    const selectedDate = dateFilter.value;
    const rows = inquiriesTableBody.querySelectorAll('tr');

    rows.forEach(row => {
      const customer = row.cells[0].textContent.toLowerCase();
      const subject = row.cells[1].textContent.toLowerCase();
      const date = row.cells[3].textContent; // Corrected to use date column
      const matchesSearch = customer.includes(searchTerm) || subject.includes(searchTerm);
      const matchesDate = !selectedDate || date === selectedDate;
      row.style.display = matchesSearch && matchesDate ? '' : 'none';
    });
  }

  // Add event listeners for search and date filters
  searchBar.addEventListener('input', filterInquiries);
  dateFilter.addEventListener('change', filterInquiries);

  // Load inquiries on page load
  loadInquiries();
});