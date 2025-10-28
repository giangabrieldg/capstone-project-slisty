// Password generation function
function generatePassword() {
  const length = 12;
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";

  // Ensure at least one of each required character type
  password += "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 26)]; // uppercase
  password += "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)]; // lowercase
  password += "0123456789"[Math.floor(Math.random() * 10)]; // number
  password += "!@#$%^&*"[Math.floor(Math.random() * 8)]; // special character

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }

  // Shuffle the password to make it more random
  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

// Password visibility variables
let isPasswordVisible = false;
let currentPassword = "";

// Initialize password generation and visibility toggle
document.addEventListener("DOMContentLoaded", function () {
  const showPasswordBtn = document.getElementById("showPasswordBtn");
  const passwordInput = document.getElementById("userPassword");

  // Password visibility toggle
  if (showPasswordBtn && passwordInput) {
    showPasswordBtn.addEventListener("click", function () {
      if (!currentPassword) return; // Don't toggle if no password generated

      if (isPasswordVisible) {
        // Hide password
        passwordInput.type = "password";
        passwordInput.value = "••••••••••••";
        showPasswordBtn.innerHTML = '<i class="bi bi-eye"></i>';
        showPasswordBtn.title = "Show password";
      } else {
        // Show password
        passwordInput.type = "text";
        passwordInput.value = currentPassword;
        showPasswordBtn.innerHTML = '<i class="bi bi-eye-slash"></i>';
        showPasswordBtn.title = "Hide password";
      }
      isPasswordVisible = !isPasswordVisible;
    });
  }

  const addUserModal = document.getElementById("addUserModal");
  if (addUserModal) {
    addUserModal.addEventListener("show.bs.modal", function () {
      // Auto-generate password when modal opens
      const passwordInput = document.getElementById("userPassword");
      if (passwordInput) {
        currentPassword = generatePassword();
        passwordInput.value = "••••••••••••";
        passwordInput.type = "password";
        isPasswordVisible = false;
        // Reset eye icon
        const showPasswordBtn = document.getElementById("showPasswordBtn");
        if (showPasswordBtn) {
          showPasswordBtn.innerHTML = '<i class="bi bi-eye"></i>';
          showPasswordBtn.title = "Show password";
        }
      }
    });
  }

  // Generate password button functionality
  const generatePasswordBtn = document.getElementById("generatePasswordBtn");
  if (generatePasswordBtn) {
    generatePasswordBtn.addEventListener("click", function () {
      const passwordInput = document.getElementById("userPassword");
      if (passwordInput) {
        currentPassword = generatePassword();
        passwordInput.value = "••••••••••••";
        passwordInput.type = "password";
        isPasswordVisible = false;

        // Reset eye icon
        const showPasswordBtn = document.getElementById("showPasswordBtn");
        if (showPasswordBtn) {
          showPasswordBtn.innerHTML = '<i class="bi bi-eye"></i>';
          showPasswordBtn.title = "Show password";
        }

        // Show brief feedback
        const originalText = generatePasswordBtn.textContent;
        generatePasswordBtn.textContent = "Generated!";
        generatePasswordBtn.classList.remove("btn-outline-secondary");
        generatePasswordBtn.classList.add("btn-success");

        setTimeout(() => {
          generatePasswordBtn.textContent = "Generate";
          generatePasswordBtn.classList.remove("btn-success");
          generatePasswordBtn.classList.add("btn-outline-secondary");
        }, 1000);
      }
    });
  }
});

async function fetchUsers() {
  try {
    const response = await fetch(`${window.API_BASE_URL}/api/auth/users`, {
      headers: {
        Authorization: `Bearer ${sessionStorage.getItem("token")}`,
      },
    });
    if (!response.ok) {
      if (response.status === 401) {
        sessionStorage.removeItem("token");
        window.location.href = "/customer/login.html";
        throw new Error("Unauthorized: Please log in again");
      }
      throw new Error("Failed to fetch users");
    }
    const users = await response.json();
    const activeTbody = document.querySelector(".active-users");
    const archivedTbody = document.querySelector(".archived-users");
    activeTbody.innerHTML = "";
    archivedTbody.innerHTML = "";

    users.forEach((user) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${user.employeeID || "N/A"}</td>
        <td>${user.name}</td>
        <td>${user.email}</td>
        <td>${user.userLevel}</td>
        <td><span class="status ${user.isArchived ? "archived" : "active"}">${
        user.isArchived ? "Archived" : "Active"
      }</span></td>
        <td>
          <label class="archive-toggle">
            <input type="checkbox" class="archive-checkbox" data-user-id="${
              user.userID
            }" ${user.isArchived ? "checked" : ""}>
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
    document
      .querySelectorAll(".archive-checkbox")
      .forEach(addArchiveToggleListener);
  } catch (error) {
    console.error("Error fetching users:", error);
    Swal.fire({
      icon: "error",
      title: "Oops...",
      text: `Failed to load users: ${error.message}`,
      confirmButtonColor: "#2c9045",
    });
  }
}

// Add new user functionality
document.getElementById("addUserForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  // Get the modal form elements specifically
  const modal = document.getElementById("addUserModal");
  const nameInput = modal.querySelector("#userName");
  const emailInput = modal.querySelector("#userEmail");
  const passwordInput = document.getElementById("userPassword");
  const roleSelect = modal.querySelector("#userRole");

  // Get form values with safe access
  const name = nameInput.value ? nameInput.value.trim() : "";
  const email = emailInput.value ? emailInput.value.trim() : "";
  const password = currentPassword; // Use the stored password
  const role = roleSelect.value || "";

  console.log("Creating user:", { name, email, role });

  // Validate form inputs
  if (!name || !email || !password || !role) {
    Swal.fire({
      icon: "error",
      title: "Oops...",
      text: "Please fill out all fields",
      confirmButtonColor: "#2c9045",
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
      confirmButtonColor: "#2c9045",
    });
    return;
  }

  // Show password confirmation before creating user
  const result = await Swal.fire({
    title: "Confirm User Creation",
    html: `
      <div class="text-start">
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Role:</strong> ${role}</p>
        <p><strong>Password:</strong> 
          <button type="button" id="tempShowPass" class="btn btn-sm btn-outline-secondary ms-2">
            <i class="bi bi-eye"></i> Show Password
          </button>
          <span id="passwordDisplay" style="display:none;"><code>${password}</code></span>
        </p>
        <div class="alert alert-info mt-2">
          <small>This password will be automatically sent to the user's email.</small>
        </div>
      </div>
    `,
    icon: "info",
    showCancelButton: true,
    confirmButtonText: "Create User & Send Email",
    cancelButtonText: "Cancel",
    confirmButtonColor: "#2c9045",
    didOpen: () => {
      document
        .getElementById("tempShowPass")
        .addEventListener("click", function () {
          this.style.display = "none";
          document.getElementById("passwordDisplay").style.display = "inline";
        });
    },
  });

  if (!result.isConfirmed) {
    return;
  }

  const token = sessionStorage.getItem("token");
  if (!token) {
    await Swal.fire({
      icon: "error",
      title: "Oops...",
      text: "Please log in again",
      confirmButtonColor: "#2c9045",
    });
    window.location.href = "/customer/login.html";
    return;
  }

  try {
    const response = await fetch(
      `${window.API_BASE_URL}/api/auth/create-staff`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, email, password, role }),
      }
    );

    if (!response.ok) {
      const errorResult = await response.json();
      if (response.status === 401) {
        sessionStorage.removeItem("token");
        window.location.href = "/customer/login.html";
        throw new Error("Unauthorized: Please log in again");
      }
      throw new Error(errorResult.message || "Failed to add user");
    }

    const result = await response.json();

    // Refresh user list
    await fetchUsers();

    // Close modal and reset form
    const modalElement = document.getElementById("addUserModal");
    if (modalElement) {
      const modal = bootstrap.Modal.getInstance(modalElement);
      if (modal) {
        modal.hide();
      }
    }
    document.getElementById("addUserForm").reset();

    // Reset password variables
    currentPassword = "";
    isPasswordVisible = false;

    // Show success message with email confirmation
    Swal.fire({
      title: "Success!",
      html: `
        <div class="text-center">
          <p>User <strong>${name}</strong> added successfully!</p>
          <div class="alert alert-success mt-2">
            <small>
              <strong>✓ Credentials sent:</strong> The login credentials have been sent to <strong>${email}</strong><br>
              The user will receive their password via email.
            </small>
          </div>
        </div>
      `,
      icon: "success",
      confirmButtonColor: "#2c9045",
    });
  } catch (error) {
    console.error("Error adding user:", error);
    Swal.fire({
      icon: "error",
      title: "Oops...",
      text: `Error: ${error.message}`,
      confirmButtonColor: "#2c9045",
    });
  }
});

// Archive toggle functionality
function addArchiveToggleListener(checkbox) {
  checkbox.addEventListener("change", async () => {
    const userId = checkbox.getAttribute("data-user-id");
    const isArchived = checkbox.checked;
    try {
      const response = await fetch(
        `${window.API_BASE_URL}/api/auth/users/${userId}/archive`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionStorage.getItem("token")}`,
          },
          body: JSON.stringify({ isArchived }),
        }
      );
      if (!response.ok) {
        if (response.status === 401) {
          sessionStorage.removeItem("token");
          window.location.href = "/customer/login.html";
          throw new Error("Unauthorized: Please log in again");
        }
        throw new Error("Failed to update user status");
      }
      await fetchUsers();
      Swal.fire({
        title: "Success!",
        text: `User ${isArchived ? "archived" : "unarchived"} successfully!`,
        icon: "success",
        confirmButtonColor: "#2c9045",
      });
    } catch (error) {
      console.error("Error updating archive status:", error);
      Swal.fire({
        icon: "error",
        title: "Oops...",
        text: `Error: ${error.message}`,
        confirmButtonColor: "#2c9045",
      });
    }
  });
}

// View switch functionality
document.querySelectorAll(".view-link").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    document
      .querySelectorAll(".view-link")
      .forEach((l) => l.classList.remove("active"));
    link.classList.add("active");
    const view = link.getAttribute("data-view");
    document.querySelector(".active-users").style.display =
      view === "active" ? "table-row-group" : "none";
    document.querySelector(".archived-users").style.display =
      view === "archived" ? "table-row-group" : "none";
  });
});

// Search functionality
document.querySelector(".search-bar").addEventListener("input", (e) => {
  const searchTerm = e.target.value.toLowerCase();
  document.querySelectorAll("tbody tr").forEach((row) => {
    const name = row.cells[1].textContent.toLowerCase();
    const email = row.cells[2].textContent.toLowerCase();
    row.style.display =
      name.includes(searchTerm) || email.includes(searchTerm) ? "" : "none";
  });
});

// Initial fetch of users
fetchUsers();
