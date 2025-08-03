// profile.js - scripts extracted from profile.html

const API_BASE_URL = "http://localhost:3000"; // Change to 'https://slice-n-grind.onrender.com' for Render

// Section management
function showSection(sectionId) {
  // Hide all sections
  document.querySelectorAll('.main-content-section').forEach(section => {
    section.style.display = 'none';
  });
  
  // Show the requested section
  const targetSection = document.getElementById(sectionId + '-section');
  if (targetSection) {
    targetSection.style.display = 'block';
  }
}

// Handle hash changes
function handleHashChange() {
  const hash = window.location.hash.substring(1) || 'profile'; // Default to profile
  showSection(hash);
  
  // Special handling for cart section to load cart items
  if (hash === 'cart') {
    // Trigger cart loading
    if (typeof loadCartItems === 'function') {
      loadCartItems();
    }
  }
}

// Initialize section visibility based on hash
window.addEventListener('load', () => {
  handleHashChange();
  loadUserData();
});

// Listen for hash changes
window.addEventListener('hashchange', handleHashChange);

// Profile functions (existing code)
async function loadUserData(attempt = 1, maxAttempts = 3, delay = 1000) {
  try {
    const token = localStorage.getItem("token");
    if (!token) {
      console.error("No token found in localStorage");
      window.location.href = "/public/customer/login.html";
      return;
    }

    const profileUrl = `${API_BASE_URL}/api/auth/profile`;
    console.log(
      `Fetching user data (attempt ${attempt}): ${profileUrl}, Token: ${token.substring(
        0,
        10
      )}...`
    );

    const response = await fetch(profileUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `Fetch failed: ${response.status} ${response.statusText} - ${errorText}`
      );
      if (response.status === 401) {
        console.error("Unauthorized: Invalid or expired token");
        localStorage.removeItem("token");
        window.location.href = "/public/customer/login.html";
        return;
      }
      throw new Error(
        `Failed to fetch user data: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const user = await response.json();
    console.log("User data fetched:", user); // Debug: Check the full response

    document.getElementById("userName").textContent =
      user.name || "Not set";
    document.getElementById("userEmail").textContent =
      user.email || "Not set";
    document.getElementById("userPhone").textContent =
      user.phone || "Not set"; // Changed to 'phone'
    document.getElementById("userAddress").textContent =
      user.address || "Not set";

    document.getElementById("editName").value = user.name || "";
    document.getElementById("editPhone").value = user.phone || ""; // Changed to 'phone'
    document.getElementById("editAddress").value = user.address || "";
  } catch (error) {
    console.error(`Error loading user data (attempt ${attempt}):`, error);
    if (attempt < maxAttempts) {
      console.log(`Retrying... (${attempt + 1}/${maxAttempts})`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return loadUserData(attempt + 1, maxAttempts, delay * 2);
    }
    alert(
      `Failed to load profile after ${maxAttempts} attempts: ${error.message}. Please try again or log in again.`
    );
    window.location.href = "/public/customer/login.html";
  }
}

function toggleEditForm() {
  const editForm = document.getElementById("editForm");
  const editBtn = document.getElementById("editBtn");
  const isEditing = editForm.style.display === "block";

  editForm.style.display = isEditing ? "none" : "block";
  editBtn.textContent = isEditing ? "Edit Profile" : "Cancel Edit";
  editBtn.classList.toggle("btn-outline-success", isEditing);
  editBtn.classList.toggle("btn-outline-danger", !isEditing);

  document
    .querySelectorAll(".form-control")
    .forEach((input) => input.classList.remove("is-invalid"));
  document
    .querySelectorAll(".invalid-feedback")
    .forEach((error) => (error.textContent = ""));
}

function validateForm() {
  let isValid = true;
  const name = document.getElementById("editName").value.trim();
  const phone = document.getElementById("editPhone").value.trim();
  const address = document.getElementById("editAddress").value.trim();

  document
    .querySelectorAll(".form-control")
    .forEach((input) => input.classList.remove("is-invalid"));
  document
    .querySelectorAll(".invalid-feedback")
    .forEach((error) => (error.textContent = ""));

  if (!name) {
    document.getElementById("editName").classList.add("is-invalid");
    document.getElementById("nameError").textContent = "Name is required";
    isValid = false;
  }

  if (phone && !/^\+63\d{10}$|^09\d{9}$/.test(phone)) {
    document.getElementById("editPhone").classList.add("is-invalid");
    document.getElementById("phoneError").textContent =
      "Enter a valid Philippine phone number (e.g., +639123456789 or 09123456789)";
    isValid = false;
  }

  if (!address) {
    document.getElementById("editAddress").classList.add("is-invalid");
    document.getElementById("addressError").textContent =
      "Address is required";
    isValid = false;
  }

  return isValid;
}

async function handleFormSubmit(event) {
  event.preventDefault();
  if (!validateForm()) return;

  const userData = {
    name: document.getElementById("editName").value.trim(),
    phone: document.getElementById("editPhone").value.trim() || null, // Changed to 'phone'
    address: document.getElementById("editAddress").value.trim(),
  };
  console.log("Sending update:", userData); // Debug: Check sent data
  const token = localStorage.getItem("token");

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/auth/profile/update`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(userData),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to update profile");
    }

    // Load updated user data from server
    await loadUserData();

    // Update localStorage with new user name
    const newName = document.getElementById("editName").value.trim();
    localStorage.setItem("userName", newName);

    toggleEditForm();
    alert("Profile updated successfully!");
  } catch (error) {
    console.error("Error updating profile:", error);
    alert(error.message || "Failed to update profile. Please try again.");
  }
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("userName");
  localStorage.removeItem("userEmail");
  window.location.href = "/public/customer/login.html";
}

// Event listeners for profile section
document
  .getElementById("editBtn")
  .addEventListener("click", toggleEditForm);
document
  .getElementById("cancelBtn")
  .addEventListener("click", toggleEditForm);
document
  .getElementById("profileForm")
  .addEventListener("submit", handleFormSubmit);

// Event listener for logout link
document
  .getElementById("logoutLink")
  .addEventListener("click", function(e) {
    e.preventDefault();
    showSection('logout');
    window.location.hash = 'logout';
  });

// Event listener for logout confirmation
document
  .getElementById("confirmLogoutBtn")
  .addEventListener("click", logout);
