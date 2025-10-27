async function fetchUsers() {
  try {
    const response = await fetch(`${window.API_BASE_URL}/api/auth/users`, {
      headers: {
        'Authorization': `Bearer ${sessionStorage.getItem('token')}`,
      },
    });
    if (!response.ok) {
      if (response.status === 401) {
        sessionStorage.removeItem('token');
        window.location.href = '/customer/login.html';
        throw new Error('Unauthorized: Please log in again');
      }
      throw new Error('Failed to fetch users');
    }
    const users = await response.json();
    const activeTbody = document.querySelector('.active-users');
    const archivedTbody = document.querySelector('.archived-users');
    activeTbody.innerHTML = '';
    archivedTbody.innerHTML = '';

    users.forEach((user) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${user.employeeID || 'N/A'}</td>
        <td>${user.name}</td>
        <td>${user.email}</td>
        <td>${user.userLevel}</td>
        <td><span class="status ${user.isArchived ? 'archived' : 'active'}">${user.isArchived ? 'Archived' : 'Active'}</span></td>
        <td>
          <label class="archive-toggle">
            <input type="checkbox" class="archive-checkbox" data-user-id="${user.userID}" ${user.isArchived ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </td>
      `;
      if (user.isArchived) {
        archivedTbody.appendChild(row);
      } else {
        activeTbody.appendChild(row);
      }
    });

    // Re-attach archive toggle listeners
    document.querySelectorAll('.archive-checkbox').forEach(addArchiveToggleListener);
  } catch (error) {
    console.error('Error fetching users:', error);
     Swal.fire({
        icon: "error",
        title: "Oops...",
        text: `Failed to load users: ${error.message}`,
        confirmButtonColor: "#2c9045"
      });
  }
}

// Add new user functionality
document.getElementById('addUserForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  // Get the modal form elements specifically
  const modal = document.getElementById('addUserModal');
  const nameInput = modal.querySelector('#userName');
  const emailInput = modal.querySelector('#userEmail');
  const passwordInput = modal.querySelector('#userPassword');
  const roleSelect = modal.querySelector('#userRole');

  // Debug each element individually
  console.log('Name input:', nameInput, 'Value:', nameInput?.value);
  console.log('Email input:', emailInput, 'Value:', emailInput?.value);
  console.log('Password input:', passwordInput, 'Value:', passwordInput?.value);
  console.log('Role select:', roleSelect, 'Value:', roleSelect?.value);

  // Check for missing elements with specific messages
  if (!nameInput) {
    console.error('Element with ID "userName" not found');
    Swal.fire({
      icon: "error",
      title: "Oops...",
      text: "Name field is missing",
      confirmButtonColor: "#2c9045"
    });
    return;
  }
  if (!emailInput) {
    console.error('Element with ID "userEmail" not found');
    Swal.fire({
      icon: "error",
      title: "Oops...",
      text: "Email field is missing",
      confirmButtonColor: "#2c9045"
    });
    return;
  }
  if (!passwordInput) {
    console.error('Element with ID "userPassword" not found');
     Swal.fire({
      icon: "error",
      title: "Oops...",
      text: "Password field is missing",
      confirmButtonColor: "#2c9045"
    });
    return;
  }
  if (!roleSelect) {
    console.error('Element with ID "userRole" not found');
     Swal.fire({
      icon: "error",
      title: "Oops...",
      text: "Role field is missing",
      confirmButtonColor: "#2c9045"
    });
    return;
  }

  // Get form values with safe access
  const name = nameInput.value ? nameInput.value.trim() : '';
  const email = emailInput.value ? emailInput.value.trim() : '';
  const password = passwordInput.value ? passwordInput.value.trim() : '';
  const role = roleSelect.value || '';

  console.log('Trimmed values:', { name, email, password, role });

  // Validate form inputs
  if (!name || !email || !password || !role) {
     Swal.fire({
      icon: "error",
      title: "Oops...",
      text: "Please fill out all fields",
      confirmButtonColor: "#2c9045"
    });
    return;
  }

  // Client-side email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
     Swal.fire({
      icon: "error",
      title: "Oops...",
      text: "Please enter a valid email address",
      confirmButtonColor: "#2c9045"
    });
    return;
  }

  // Client-side password validation
  if (password.length < 8) {
     Swal.fire({
      icon: "error",
      title: "Oops...",
      text: "Password must be at least 8 characters long",
      confirmButtonColor: "#2c9045"
    });
    return;
  }

  const token = sessionStorage.getItem('token');
  if (!token) {
     await Swal.fire({
      icon: "error",
      title: "Oops...",
      text: "Please log in again",
      confirmButtonColor: "#2c9045"
    });
    window.location.href = '/customer/login.html';
    return;
  }

  try {
    const response = await fetch(`${window.API_BASE_URL}/api/auth/create-staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ name, email, password, role }),
    });

    if (!response.ok) {
      const errorResult = await response.json();
      if (response.status === 401) {
        sessionStorage.removeItem('token');
        window.location.href = '/customer/login.html';
        throw new Error('Unauthorized: Please log in again');
      }
      throw new Error(errorResult.message || 'Failed to add user');
    }

    const result = await response.json();

    // Refresh user list
    await fetchUsers();

    // Close modal and reset form
    const modalElement = document.getElementById('addUserModal');
    if (modalElement) {
      const modal = bootstrap.Modal.getInstance(modalElement);
      if (modal) {
        modal.hide();
      }
    }
    document.getElementById('addUserForm').reset();
    Swal.fire({
      title: "Success!",
      text: `User ${name} added successfully!`,
      icon: "success",
      confirmButtonColor: "#2c9045"
    });

  } catch (error) {
    console.error('Error adding user:', error);
    Swal.fire({
        icon: "error",
        title: "Oops...",
        text: `Error: ${error.message}`,
        confirmButtonColor: "#2c9045"
      });
  }
});

// Archive toggle functionality
function addArchiveToggleListener(checkbox) {
  checkbox.addEventListener('change', async () => {
    const userId = checkbox.getAttribute('data-user-id');
    const isArchived = checkbox.checked;
    try {
      const response = await fetch(`${window.API_BASE_URL}/api/auth/users/${userId}/archive`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionStorage.getItem('token')}`,
        },
        body: JSON.stringify({ isArchived }),
      });
      if (!response.ok) {
        if (response.status === 401) {
          sessionStorage.removeItem('token');
          window.location.href = '/customer/login.html';
          throw new Error('Unauthorized: Please log in again');
        }
        throw new Error('Failed to update user status');
      }
      await fetchUsers();
      Swal.fire({
        title: "Success!",
        text: `User ${isArchived ? 'archived' : 'unarchived'} successfully!`,
        icon: "success",
        confirmButtonColor: "#2c9045"
      });
    } catch (error) {
      console.error('Error updating archive status:', error);
       Swal.fire({
        icon: "error",
        title: "Oops...",
        text: `Error: ${error.message}`,
        confirmButtonColor: "#2c9045"
      });
    }
  });
}
// View switch functionality
document.querySelectorAll('.view-link').forEach((link) => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelectorAll('.view-link').forEach((l) => l.classList.remove('active'));
    link.classList.add('active');
    const view = link.getAttribute('data-view');
    document.querySelector('.active-users').style.display = view === 'active' ? 'table-row-group' : 'none';
    document.querySelector('.archived-users').style.display = view === 'archived' ? 'table-row-group' : 'none';
  });
});

// Search functionality
document.querySelector('.search-bar').addEventListener('input', (e) => {
  const searchTerm = e.target.value.toLowerCase();
  document.querySelectorAll('tbody tr').forEach((row) => {
    const name = row.cells[1].textContent.toLowerCase();
    const email = row.cells[2].textContent.toLowerCase();
    row.style.display = name.includes(searchTerm) || email.includes(searchTerm) ? '' : 'none';
  });
});

// Initial fetch of users
fetchUsers();