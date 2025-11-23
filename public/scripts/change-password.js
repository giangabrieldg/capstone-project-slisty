// change-password.js

// Show change password modal
function showChangePasswordModal(userData) {
  // Create modal HTML
  const modalHTML = `
    <div class="modal fade change-password-modal" id="changePasswordModal" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              Change Password
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <form id="changePasswordForm">
              <div class="mb-3">
                <label for="currentPassword" class="form-label">Current Password</label>
                <div class="password-input-group">
                  <input type="password" class="form-control" id="currentPassword" required>
                  <button type="button" class="password-toggle" data-target="currentPassword">
                    <i class="bi bi-eye"></i>
                  </button>
                </div>
              </div>
              
              <div class="mb-3">
                <label for="newPassword" class="form-label">New Password</label>
                <div class="password-input-group">
                  <input type="password" class="form-control" id="newPassword" required>
                  <button type="button" class="password-toggle" data-target="newPassword">
                    <i class="bi bi-eye"></i>
                  </button>
                </div>
                <div class="password-strength" id="passwordStrength"></div>
                <div class="password-requirements mt-2">
                  <small>Password must contain:</small>
                  <ul class="mb-0 mt-1">
                    <li id="reqLength" class="invalid">At least 8 characters</li>
                    <li id="reqUppercase" class="invalid">One uppercase letter</li>
                    <li id="reqLowercase" class="invalid">One lowercase letter</li>
                    <li id="reqNumber" class="invalid">One number</li>
                    <li id="reqSpecial" class="invalid">One special character</li>
                  </ul>
                </div>
              </div>
              
              <div class="mb-3">
                <label for="confirmPassword" class="form-label">Confirm New Password</label>
                <div class="password-input-group">
                  <input type="password" class="form-control" id="confirmPassword" required>
                  <button type="button" class="password-toggle" data-target="confirmPassword">
                    <i class="bi bi-eye"></i>
                  </button>
                </div>
                <div class="text-danger small mt-1" id="passwordMatchError"></div>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-success" id="submitChangePassword">Change Password</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Remove existing modal if any
  const existingModal = document.getElementById("changePasswordModal");
  if (existingModal) {
    existingModal.remove();
  }

  // Add modal to body
  document.body.insertAdjacentHTML("beforeend", modalHTML);

  // Initialize modal
  const modalElement = document.getElementById("changePasswordModal");
  const modal = new bootstrap.Modal(modalElement);

  // Initialize password toggle and validation
  initializePasswordToggle();
  initializePasswordValidation();

  // Handle form submission
  document
    .getElementById("submitChangePassword")
    .addEventListener("click", async function () {
      await submitChangePassword(userData);
    });

  // Show modal
  modal.show();

  // Clean up on modal hide
  modalElement.addEventListener("hidden.bs.modal", function () {
    modalElement.remove();
  });
}

// Initialize password visibility toggle
function initializePasswordToggle() {
  document.querySelectorAll(".password-toggle").forEach((toggle) => {
    toggle.addEventListener("click", function () {
      const targetId = this.getAttribute("data-target");
      const passwordInput = document.getElementById(targetId);
      const icon = this.querySelector("i");

      if (passwordInput.type === "password") {
        passwordInput.type = "text";
        icon.classList.remove("bi-eye");
        icon.classList.add("bi-eye-slash");
      } else {
        passwordInput.type = "password";
        icon.classList.remove("bi-eye-slash");
        icon.classList.add("bi-eye");
      }
    });
  });
}

// Initialize password validation
function initializePasswordValidation() {
  const newPasswordInput = document.getElementById("newPassword");
  const confirmPasswordInput = document.getElementById("confirmPassword");

  newPasswordInput.addEventListener("input", validatePassword);
  confirmPasswordInput.addEventListener("input", validatePasswordMatch);
}

// Validate password strength
function validatePassword() {
  const password = document.getElementById("newPassword").value;
  const strengthBar = document.getElementById("passwordStrength");
  const requirements = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  };

  // Update requirement indicators
  document.getElementById("reqLength").className = requirements.length
    ? "valid"
    : "invalid";
  document.getElementById("reqUppercase").className = requirements.uppercase
    ? "valid"
    : "invalid";
  document.getElementById("reqLowercase").className = requirements.lowercase
    ? "valid"
    : "invalid";
  document.getElementById("reqNumber").className = requirements.number
    ? "valid"
    : "invalid";
  document.getElementById("reqSpecial").className = requirements.special
    ? "valid"
    : "invalid";

  // Calculate strength
  const metRequirements = Object.values(requirements).filter(Boolean).length;
  let strength = "weak";

  if (metRequirements >= 4) {
    strength = "strong";
  } else if (metRequirements >= 3) {
    strength = "medium";
  }

  strengthBar.className = `password-strength ${strength}`;
}

// Validate password match
function validatePasswordMatch() {
  const newPassword = document.getElementById("newPassword").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  const matchError = document.getElementById("passwordMatchError");

  if (confirmPassword && newPassword !== confirmPassword) {
    matchError.textContent = "Passwords do not match";
    return false;
  } else {
    matchError.textContent = "";
    return true;
  }
}

// Submit change password
async function submitChangePassword(userData) {
  const currentPassword = document.getElementById("currentPassword").value;
  const newPassword = document.getElementById("newPassword").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  // Validate form
  if (!currentPassword || !newPassword || !confirmPassword) {
    Swal.fire({
      icon: "error",
      title: "Missing Information",
      text: "Please fill in all fields",
      confirmButtonColor: "#2c9045",
    });
    return;
  }

  if (!validatePasswordMatch()) {
    return;
  }

  if (newPassword.length < 8) {
    Swal.fire({
      icon: "error",
      title: "Weak Password",
      text: "Password must be at least 8 characters long",
      confirmButtonColor: "#2c9045",
    });
    return;
  }

  try {
    const response = await fetch(
      `${window.API_BASE_URL}/api/auth/change-password`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      }
    );

    const result = await response.json();

    if (response.ok) {
      Swal.fire({
        icon: "success",
        title: "Password Changed",
        text: "Your password has been updated successfully",
        confirmButtonColor: "#2c9045",
      }).then(() => {
        const modal = bootstrap.Modal.getInstance(
          document.getElementById("changePasswordModal")
        );
        modal.hide();
        document.getElementById("changePasswordForm").reset();
      });
    } else {
      throw new Error(result.message || "Failed to change password");
    }
  } catch (error) {
    console.error("Error changing password:", error);
    Swal.fire({
      icon: "error",
      title: "Error",
      text: error.message || "Failed to change password. Please try again.",
      confirmButtonColor: "#2c9045",
    });
  }
}

// Initialize change password functionality
function initializeChangePassword(container, userData) {
  const changePasswordLink = container.querySelector("#changePasswordLink");

  if (!changePasswordLink) return;

  changePasswordLink.addEventListener("click", function (e) {
    e.preventDefault();
    showChangePasswordModal(userData);
  });
}
