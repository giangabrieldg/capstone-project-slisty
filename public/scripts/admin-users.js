// Add this configuration at the top of your file
const AUTO_DELETE_DAYS = 30; // Set the number of days after which archived accounts should be deleted

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

let currentPassword = "";

// Remove the password visibility toggle functionality
document.addEventListener("DOMContentLoaded", function () {
  // Remove the entire password visibility toggle section
  const showPasswordBtn = document.getElementById("showPasswordBtn");
  if (showPasswordBtn) {
    showPasswordBtn.style.display = "none"; // Hide the show password button
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
        // Remove the visibility toggle reset
      }
    });
  }

  // Generate password button functionality - remove success state visibility
  const generatePasswordBtn = document.getElementById("generatePasswordBtn");
  if (generatePasswordBtn) {
    generatePasswordBtn.addEventListener("click", function () {
      const passwordInput = document.getElementById("userPassword");
      if (passwordInput) {
        currentPassword = generatePassword();
        passwordInput.value = "••••••••••••";
        passwordInput.type = "password";

        // Show brief feedback (keep this but remove any password display)
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

  // Check for accounts that should be auto-deleted
  checkAutoDeleteAccounts();
});

// Add this function to check and delete old archived accounts
async function checkAutoDeleteAccounts() {
  try {
    const response = await fetch(
      `${window.API_BASE_URL}/api/auth/auto-delete-archived`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionStorage.getItem("token")}`,
        },
        body: JSON.stringify({ days: AUTO_DELETE_DAYS }),
      }
    );

    if (response.ok) {
      const result = await response.json();
      if (result.deletedCount > 0) {
        console.log(
          `Auto-deleted ${result.deletedCount} archived accounts older than ${AUTO_DELETE_DAYS} days`
        );
        // Refresh the user list if any accounts were deleted
        await fetchUsers();
      }
    }
  } catch (error) {
    console.error("Error in auto-delete check:", error);
  }
}

// Modified fetchUsers function to show archive date and auto-delete status
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

      // Calculate days until auto-delete for archived users
      let autoDeleteInfo = "";
      if (user.isArchived && user.archivedAt) {
        const archivedDate = new Date(user.archivedAt);
        const daysArchived = Math.floor(
          (new Date() - archivedDate) / (1000 * 60 * 60 * 24)
        );
        const daysLeft = AUTO_DELETE_DAYS - daysArchived;

        if (daysLeft > 0) {
          autoDeleteInfo = `<br><small class="text-warning">Auto-delete in ${daysLeft} days</small>`;
        } else {
          autoDeleteInfo = `<br><small class="text-danger">Scheduled for deletion</small>`;
        }
      }

      row.innerHTML = `
        <td>${user.employeeID || "N/A"}</td>
        <td>${user.name}</td>
        <td>${user.email}</td>
        <td>${user.userLevel}</td>
        <td>
          <span class="status ${user.isArchived ? "archived" : "active"}">
            ${user.isArchived ? "Archived" : "Active"}
          </span>
          ${autoDeleteInfo}
        </td>
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

// Modified archive toggle functionality to include archive date
function addArchiveToggleListener(checkbox) {
  checkbox.addEventListener("change", async () => {
    const userId = checkbox.getAttribute("data-user-id");
    const isArchived = checkbox.checked;

    // Show confirmation for archiving with auto-delete warning
    if (isArchived) {
      const result = await Swal.fire({
        title: "Archive User?",
        html: `
          <div class="text-start">
            <p>Are you sure you want to archive this user?</p>
            <div class="alert alert-warning">
              <small>
                <strong>Auto-delete Notice:</strong> Archived accounts will be automatically deleted after ${AUTO_DELETE_DAYS} days.
              </small>
            </div>
          </div>
        `,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Yes, Archive User",
        cancelButtonText: "Cancel",
        confirmButtonColor: "#2c9045",
      });

      if (!result.isConfirmed) {
        checkbox.checked = false;
        return;
      }
    }

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
        text: `User ${isArchived ? "archived" : "unarchived"} successfully!${
          isArchived
            ? ` Account will be auto-deleted after ${AUTO_DELETE_DAYS} days.`
            : ""
        }`,
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

// The rest of your existing functions remain the same...
// (addUserForm event listener, view switch functionality, search functionality)

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
  // Show password confirmation without revealing the password
  const result = await Swal.fire({
    title: "Confirm User Creation",
    html: `
      <div class="text-start">
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Role:</strong> ${role}</p>
        <p><strong>Password:</strong> <code>••••••••••••</code></p>
        <div class="alert alert-info mt-2">
          <small>
            <strong>Password generated successfully</strong><br>
            The password has been automatically generated and will be sent to the user's email.
          </small>
        </div>
      </div>
    `,
    icon: "info",
    showCancelButton: true,
    confirmButtonText: "Create User & Send Email",
    cancelButtonText: "Cancel",
    confirmButtonColor: "#2c9045",
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
              The login credentials have been sent to <strong>${email}</strong><br>
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
