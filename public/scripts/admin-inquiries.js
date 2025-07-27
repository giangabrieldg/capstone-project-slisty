// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
  // Get DOM elements for inquiries table and filters
  const inquiriesTableBody = document.querySelector('#inquiriesTable tbody');
  const searchBar = document.querySelector('.search-bar');
  const dateFilter = document.getElementById('dateFilter');

  // Function to fetch and display inquiries from backend
  async function loadInquiries() {
    try {
      // Get JWT token from localStorage
      const token = localStorage.getItem('token');
      if (!token) {
        inquiriesTableBody.innerHTML = '<tr><td colspan="6">Please log in.</td></tr>';
        return;
      }

      // Fetch inquiries from API
      const response = await fetch('http://localhost:3000/api/inquiries', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      // Handle response
      if (!response.ok) {
        const error = await response.json();
        inquiriesTableBody.innerHTML = `<tr><td colspan="6">Error: ${error.message}</td></tr>`;
        return;
      }

      // Render inquiries
      const inquiries = await response.json();
      renderInquiries(inquiries);
    } catch (error) {
      console.error('Error loading inquiries:', error);
      inquiriesTableBody.innerHTML = '<tr><td colspan="6">Error loading inquiries.</td></tr>';
    }
  }

  // Function to render inquiries in the table
  function renderInquiries(inquiries) {
    inquiriesTableBody.innerHTML = inquiries.map(inquiry => `
      <tr>
        <td>${inquiry.User?.name || inquiry.name}</td>
        <td>${inquiry.subject}</td>
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

    // Add event listeners for send reply buttons
    document.querySelectorAll('.send-reply').forEach(button => {
      button.addEventListener('click', async () => {
        const inquiryId = parseInt(button.dataset.id);
        const replyText = button.closest('tr').querySelector('.reply-text').value;
        if (!replyText) {
          alert('Please enter a reply.');
          return;
        }

        try {
          // Send reply to backend
          const response = await fetch('http://localhost:3000/api/inquiries/reply', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
            body: JSON.stringify({ inquiryId, reply: replyText }),
          });

          // Handle response
          if (response.ok) {
            loadInquiries(); // Refresh inquiries
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
    // Get the selected date from the date picker input
    const selectedDate = dateFilter.value;
    const rows = inquiriesTableBody.querySelectorAll('tr');

    rows.forEach(row => {
      const customer = row.cells[0].textContent.toLowerCase();
      const subject = row.cells[1].textContent.toLowerCase();
      const date = row.cells[2].textContent;
      // Check if the row matches the search term in customer or subject
      const matchesSearch = customer.includes(searchTerm) || subject.includes(searchTerm);
      // Check if the row matches the selected date or if no date is selected
      const matchesDate = !selectedDate || date === selectedDate;
      // Show or hide the row based on both search and date match
      row.style.display = matchesSearch && matchesDate ? '' : 'none';
    });
  }

  // Add event listeners for search and date filters
  searchBar.addEventListener('input', filterInquiries);
  dateFilter.addEventListener('change', filterInquiries);

  // Load inquiries on page load
  loadInquiries();

  // FAQ functionality (client-side, retained from original)
  const faqForm = document.getElementById('faqForm');
  const faqsTableBody = document.querySelector('#faqsTable tbody');
  const addFaqBtn = document.querySelector('.add-faq-btn');

  // Open FAQ modal for adding new FAQ
  addFaqBtn.addEventListener('click', () => {
    document.getElementById('faqModalLabel').textContent = 'Add New FAQ';
    document.getElementById('editQuestion').value = '';
    faqForm.reset();
    bootstrap.Modal.getOrCreateInstance(document.getElementById('faqModal')).show();
  });

  // Handle FAQ form submission
  faqForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const question = document.getElementById('question').value;
    const answer = document.getElementById('answer').value;
    const editQuestion = document.getElementById('editQuestion').value;

    if (editQuestion) {
      // Update existing FAQ
      const rows = faqsTableBody.querySelectorAll('tr');
      for (let row of rows) {
        if (row.cells[0].textContent === editQuestion) {
          row.cells[0].textContent = question;
          row.cells[1].textContent = answer;
          row.querySelector('.edit-faq').setAttribute('data-question', question);
          row.querySelector('.remove-faq').setAttribute('data-question', question);
          alert(`FAQ "${editQuestion}" updated successfully!`);
          break;
        }
      }
    } else {
      // Add new FAQ
      faqsTableBody.innerHTML += `
        <tr>
          <td>${question}</td>
          <td>${answer}</td>
          <td>
            <button class="btn btn-warning btn-sm edit-faq" data-question="${question}">Edit</button>
            <button class="btn btn-danger btn-sm remove-faq" data-question="${question}">Remove</button>
          </td>
        </tr>
      `;
      alert(`FAQ "${question}" added successfully!`);
    }

    // Close modal and reset form
    bootstrap.Modal.getInstance(document.getElementById('faqModal')).hide();
    faqForm.reset();

    // Re-attach FAQ event listeners
    attachFaqListeners();
  });

  // Function to attach event listeners for FAQ edit/remove
  function attachFaqListeners() {
    document.querySelectorAll('.edit-faq').forEach(button => {
      button.addEventListener('click', () => {
        const question = button.getAttribute('data-question');
        const row = button.closest('tr');
        document.getElementById('faqModalLabel').textContent = 'Edit FAQ';
        document.getElementById('editQuestion').value = question;
        document.getElementById('question').value = row.cells[0].textContent;
        document.getElementById('answer').value = row.cells[1].textContent;
        bootstrap.Modal.getOrCreateInstance(document.getElementById('faqModal')).show();
      });
    });

    document.querySelectorAll('.remove-faq').forEach(button => {
      button.addEventListener('click', () => {
        const question = button.getAttribute('data-question');
        if (confirm(`Are you sure you want to remove FAQ "${question}"?`)) {
          button.closest('tr').remove();
          alert(`FAQ "${question}" removed successfully!`);
        }
      });
    });
  }

  // Attach FAQ listeners on page load
  attachFaqListeners();

  // Sidebar toggle functionality for responsive design
  const sidebarToggle = document.querySelector('.sidebar-toggle');
  const sidebar = document.querySelector('.sidebar');
  const body = document.body;

  sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('show');
    body.classList.toggle('sidebar-visible');
  });

  // Close sidebar on outside click for mobile
  document.addEventListener('click', (e) => {
    if (
      window.innerWidth <= 992 &&
      !sidebar.contains(e.target) &&
      !sidebarToggle.contains(e.target) &&
      sidebar.classList.contains('show')
    ) {
      sidebar.classList.remove('show');
      body.classList.remove('sidebar-visible');
    }
  });
});