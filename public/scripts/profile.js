//Handles profile data fetching, updating, tab switching, cart display, and order history

class ProfileManager {
  constructor() {
    this.token = sessionStorage.getItem("token");
    // Dynamic API URL - same approach as your other modules
    this.init();
  }

  //initialiaze page
  async init() {
    if (!this.token) {
      window.location.href = "/customer/login.html";
      return;
    }

    // Validate token with server before proceeding
    const isValid = await this.validateToken();
    if (!isValid) {
      sessionStorage.removeItem("token");
      window.location.href = "/customer/login.html";
      return;
    }

    this.setupEventListeners();
    this.loadProfile();
    this.loadOrders();

    const hash = window.location.hash.substring(1);
    const section = hash || "profile";
    this.showSection(section);
  }

  //validate token if still valid
  async validateToken() {
    try {
      const response = await fetch(`${window.API_BASE_URL}/api/auth/profile`, {
        headers: { Authorization: `Bearer ${this.token}` },
      });

      // Handle 403 error from allowCustomerOnly middleware
      if (response.status === 403) {
        const errorData = await response.json();
        await Swal.fire({
          icon: "error",
          title: "Access Denied",
          text:
            errorData.message ||
            "Access denied: Only customer accounts can access this page.",
          confirmButtonColor: "#2c9045",
        });

        // Redirect to appropriate dashboard based on user level
        const userLevel = sessionStorage.getItem("userLevel");
        if (userLevel === "Staff") {
          window.location.href = "/staff/staff-dashboard.html";
        } else if (userLevel === "Admin") {
          window.location.href = "/admin/admin-dashboard.html";
        } else {
          window.location.href = "/customer/login.html";
        }
        return false;
      }

      return response.ok;
    } catch (error) {
      console.error("Token validation failed:", error);
      return false;
    }
  }

  //event listeners for profile page
  setupEventListeners() {
    // Tab navigation
    document.querySelectorAll(".sidebar-menu .nav-link").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const section = link.getAttribute("href").substring(1);
        this.showSection(section);
      });
    });

    window.addEventListener("hashchange", () => {
      const hash = window.location.hash.substring(1);
      this.showSection(hash || "profile");
    });

    // Edit profile button
    const editBtn = document.getElementById("editBtn");
    if (editBtn) {
      editBtn.addEventListener("click", () => this.toggleEditForm(true));
    }

    // Cancel edit button
    const cancelBtn = document.getElementById("cancelBtn");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => this.toggleEditForm(false));
    }

    // Profile form submission
    const profileForm = document.getElementById("profileForm");
    if (profileForm) {
      profileForm.addEventListener("submit", (e) =>
        this.handleProfileSubmit(e)
      );
    }

    // Logout confirmation
    const confirmLogoutBtn = document.getElementById("confirmLogoutBtn");
    if (confirmLogoutBtn) {
      confirmLogoutBtn.addEventListener("click", () => this.handleLogout());
    }
  }

  //section id display
  showSection(section) {
    document.querySelectorAll(".main-content-section").forEach((s) => {
      s.style.display = "none";
    });
    const activeSection = document.getElementById(`${section}-section`);
    if (activeSection) {
      activeSection.style.display = "block";
    }

    document.querySelectorAll(".sidebar-menu .nav-link").forEach((link) => {
      link.classList.remove("active");
      if (link.getAttribute("href") === `#${section}`) {
        link.classList.add("active");
      }
    });
  }

  //load user data
  async loadProfile() {
    try {
      const response = await fetch(`${window.API_BASE_URL}/api/auth/profile`, {
        headers: { Authorization: `Bearer ${this.token}` },
      });
      // Handle 403 error from allowCustomerOnly middleware
      if (response.status === 403) {
        const errorData = await response.json();
        await Swal.fire({
          icon: "error",
          title: "Oops...",
          text:
            errorData.message ||
            "Access denied: Only customer accounts can view profiles.",
          confirmButtonColor: "#2c9045",
        });

        // Redirect to appropriate dashboard
        const userLevel = sessionStorage.getItem("userLevel");
        if (userLevel === "Staff") {
          window.location.href = "/staff/staff-dashboard.html";
        } else if (userLevel === "Admin") {
          window.location.href = "/admin/admin-dashboard.html";
        }
        return;
      }

      if (!response.ok) throw new Error("Failed to load profile");
      const data = await response.json();
      this.renderProfile(data);

      // Also check if secret question is set
      await this.checkSecretQuestionStatus();
    } catch (error) {
      console.error("Error loading profile:", error);
      Swal.fire({
        icon: "error",
        title: "Oops...",
        text: "Error loading profile. Please log in again.",
        confirmButtonColor: "#2c9045",
      });
      window.location.href = "/customer/login.html";
    }
  }

  //profile/user information
  renderProfile(profile) {
    document.getElementById("userName").textContent = profile.name || "Not set";
    document.getElementById("userEmail").textContent =
      profile.email || "Not set";
    document.getElementById("userPhone").textContent =
      profile.phone || "Not set";
    document.getElementById("userAddress").textContent =
      profile.address || "Not set";
  }

  //show or hide edit form
  toggleEditForm(show) {
    const editForm = document.getElementById("editForm");
    const editBtn = document.getElementById("editBtn");
    if (editForm && editBtn) {
      editForm.style.display = show ? "block" : "none";
      editBtn.style.display = show ? "none" : "block";
      if (show) {
        document.getElementById("editName").value =
          document.getElementById("userName").textContent;
        document.getElementById("contactNumber").value =
          document.getElementById("userPhone").textContent;
        document.getElementById("editAddress").value =
          document.getElementById("userAddress").textContent === "Not set"
            ? ""
            : document.getElementById("userAddress").textContent;

        // Load secret question status when opening edit form
        this.loadSecretQuestionForm();
      }
    }
  }

  //profile form submission
  async handleProfileSubmit(e) {
    e.preventDefault();
    const name = document.getElementById("editName").value;
    const phone = document.getElementById("contactNumber").value;
    const address = document.getElementById("editAddress").value;

    // Get secret question data if provided
    const secretQuestion = document.getElementById("secretQuestion").value;
    const secretAnswer = document.getElementById("secretAnswer").value;

    document.getElementById("nameError").textContent = "";
    document.getElementById("phoneError").textContent = "";
    document.getElementById("editName").classList.remove("is-invalid");
    document.getElementById("contactNumber").classList.remove("is-invalid");

    let isValid = true;

    if (!name) {
      document.getElementById("nameError").textContent = "Name is required";
      document.getElementById("editName").classList.add("is-invalid");
      isValid = false;
    }

    // Validate secret question if provided
    if (secretQuestion && !secretAnswer) {
      Swal.fire({
        icon: "warning",
        title: "Incomplete Secret Question",
        text: "Please provide an answer for your secret question",
        confirmButtonColor: "#2c9045",
      });
      isValid = false;
    }

    if (!isValid) return;

    try {
      const requestBody = { name, phone, address };

      // Add secret question data if provided
      if (secretQuestion && secretAnswer) {
        requestBody.secretQuestion = secretQuestion;
        requestBody.secretAnswer = secretAnswer;
      }

      const response = await fetch(
        `${window.API_BASE_URL}/api/auth/profile/update`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update profile");
      }

      const data = await response.json();
      this.renderProfile(data);
      await this.checkSecretQuestionStatus();
      this.toggleEditForm(false);

      // Show appropriate success message
      if (data.secretQuestionUpdated) {
        Swal.fire({
          title: "Success!",
          text: "Profile and secret question updated successfully!",
          icon: "success",
          confirmButtonColor: "#2c9045",
        });
      } else {
        Swal.fire({
          title: "Success!",
          text: "Profile updated successfully!",
          icon: "success",
          confirmButtonColor: "#2c9045",
        });
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      Swal.fire({
        icon: "error",
        title: "Oops...",
        text: `Error updating profile: ${error.message}`,
        confirmButtonColor: "#2c9045",
      });
    }
  }

  //load user orders
  async loadOrders() {
    try {
      const response = await fetch(
        `${window.API_BASE_URL}/api/orders/user/me`,
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        let errorMsg = "Failed to load orders";
        try {
          const errorData = await response.json();
          errorMsg += `: ${errorData.message || JSON.stringify(errorData)}`;
        } catch (e) {
          errorMsg += `: HTTP ${response.status}`;
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      console.log("Orders data:", data);
      this.renderOrders(data.orders || []);
    } catch (error) {
      console.error("Error loading orders:", error);
      const ordersContent = document.querySelector(".orders-content");
      if (ordersContent) {
        ordersContent.innerHTML = `
                    <div class="alert alert-danger">
                        Error loading order history: ${error.message}
                        <button class="btn btn-sm btn-secondary mt-2" onclick="profileManager.loadOrders()">
                            Retry
                        </button>
                    </div>
                `;
      }
    }
  }

  //list of orders
  renderOrders(orders) {
    const ordersContent = document.querySelector(".orders-content");
    if (!ordersContent) return;

    if (orders.length === 0) {
      ordersContent.innerHTML = `
            <div class="orders-empty">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                <h4>No orders yet</h4>
                <p>Your order history will appear here once you make your first purchase.</p>
                <a href="/customer/menu.html" class="btn btn-success">Start Shopping</a>
            </div>
        `;
      return;
    }

    // Status map for display text
    const statusMap = {
      pending: "Pending",
      pending_payment: "Pending Payment",
      order_received: "Order Received",
      processing: "In Progress",
      shipped: "Ready for Pickup/Delivery",
      delivered: "Completed",
      cancelled: "Cancelled",
    };

    ordersContent.innerHTML = `
        <div class="table-responsive">
            <table class="orders-table">
                <thead>
                    <tr>
                        <th>Image</th>
                        <th>Order ID</th>
                        <th>Date</th>
                        <th>Total</th>
                        <th>Items</th>
                        <th>Delivery</th>
                        <th>Payment</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${orders
                      .map((order) => {
                        const items =
                          typeof order.items === "string"
                            ? JSON.parse(order.items)
                            : order.items;
                        const formattedOrderId =
                          "ORD" + order.orderId.toString().padStart(3, "0");
                        const orderDate = new Date(order.createdAt);
                        const statusText =
                          statusMap[order.status] || order.status;

                        // Get the first item's image for this order
                        const firstItem = items[0];
                        const orderImage =
                          firstItem?.image || "https://via.placeholder.com/300";

                        return `
                            <tr>
                                <td data-label="Image">
                                    <img src="${orderImage}" alt="${
                          firstItem?.name || "Order item"
                        }" class="cart-item-image" 
                                         onerror="this.src='https://via.placeholder.com/300'">
                                </td>
                                <td data-label="Order ID">${formattedOrderId}</td>
                                <td data-label="Date" class="order-date">${orderDate.toLocaleDateString(
                                  "en-US",
                                  {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                  }
                                )}</td>
                                <td data-label="Total" class="order-price">₱${Number(
                                  order.total_amount
                                ).toFixed(2)}</td>
                                <td data-label="Items" class="order-items">
                                    ${items
                                      .map(
                                        (item) => `
                                        <div class="order-item">
                                            <span class="item-name">${
                                              item.name
                                            }</span>
                                            <span class="item-details">
                                                ${
                                                  item.size
                                                    ? `${item.size} • `
                                                    : ""
                                                }Qty: ${item.quantity}
                                            </span>
                                        </div>
                                    `
                                      )
                                      .join("")}
                                </td>
                                <td data-label="Delivery">
                                    <span class="order-method">${
                                      order.delivery_method
                                    }</span>
                                </td>
                                <td data-label="Payment">
                                    <span class="order-method">${
                                      order.payment_method
                                    }</span>
                                </td>
                                <td data-label="Status">
                                    <span class="status-badge status-${order.status.toLowerCase()}">${statusText}</span>
                                </td>
                            </tr>
                        `;
                      })
                      .join("")}
                </tbody>
            </table>
        </div>
    `;
  }

  //logout function
  handleLogout() {
    Swal.fire({
      title: "Are you sure?",
      text: "You will be logged out of your account",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#2c9045", // Your brand green color
      cancelButtonColor: "#6c757d",
      confirmButtonText: "Yes, logout",
      cancelButtonText: "Cancel",
      reverseButtons: true,
    }).then((result) => {
      if (result.isConfirmed) {
        // Clear all session and local storage
        sessionStorage.removeItem("token");
        sessionStorage.clear();
        localStorage.clear();

        // Show success message
        Swal.fire({
          title: "Logged Out!",
          text: "You have been successfully logged out",
          icon: "success",
          timer: 1500,
          showConfirmButton: false,
          confirmButtonColor: "#2c9045",
        }).then(() => {
          // Prevent back button from showing cached page
          window.history.pushState(null, null, "/customer/login.html");
          window.location.href = "/customer/login.html";

          // Add event listener to prevent back navigation
          window.addEventListener("popstate", () => {
            window.location.href = "/customer/login.html";
          });
        });
      }
    });
  }
  async checkSecretQuestionStatus() {
    try {
      const response = await fetch(
        `${window.API_BASE_URL}/api/password/check-secret-question`,
        {
          headers: { Authorization: `Bearer ${this.token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        this.renderSecretQuestionStatus(data);
      }
    } catch (error) {
      console.error("Error checking secret question status:", error);
    }
  }
  // NEW: Render secret question status in the UI
  renderSecretQuestionStatus(status) {
    const secretQuestionStatus = document.getElementById(
      "secretQuestionStatus"
    );
    if (!secretQuestionStatus) return;

    if (status.isSecretQuestionSet) {
      const lastUpdate = status.lastSecretQuestionUpdate
        ? new Date(status.lastSecretQuestionUpdate).toLocaleDateString()
        : "Unknown";

      secretQuestionStatus.innerHTML = `
      <div class="alert alert-success">
        <i class="fas fa-shield-alt"></i>
        <strong>Security Question Set</strong>
        <p class="mb-0">Your security question is active. Last updated: ${lastUpdate}</p>
      </div>
    `;
    } else {
      secretQuestionStatus.innerHTML = `
      <div class="alert alert-warning">
        <i class="fas fa-exclamation-triangle"></i>
        <strong>No Security Question Set</strong>
        <p class="mb-0">Set a security question to help recover your account if you forget your email.</p>
      </div>
    `;
    }
  }
  async loadSecretQuestionForm() {
    try {
      const response = await fetch(
        `${window.API_BASE_URL}/api/password/check-secret-question`,
        {
          headers: { Authorization: `Bearer ${this.token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();

        const secretQuestionSection = document.getElementById(
          "secretQuestionSection"
        );
        if (secretQuestionSection) {
          if (data.isSecretQuestionSet) {
            secretQuestionSection.innerHTML = `
            <div class="form-group">
              <label for="secretQuestion">Update Security Question</label>
              <input type="text" class="form-control" id="secretQuestion" 
                     placeholder="Enter your security question (e.g., What was your first pet's name?)">
              <small class="form-text text-muted">Create a question that only you know the answer to.</small>
            </div>
            <div class="form-group">
              <label for="secretAnswer">Security Answer</label>
              <input type="text" class="form-control" id="secretAnswer" 
                     placeholder="Enter the answer to your security question">
              <small class="form-text text-muted">This answer will be used to verify your identity if you forget your email.</small>
            </div>
          `;

            const secretQuestionInput =
              document.getElementById("secretQuestion");
            const secretAnswerInput = document.getElementById("secretAnswer");

            updateCheckbox.addEventListener("change", function () {
              const isRequired = this.checked;
              secretQuestionInput.required = isRequired;
              secretAnswerInput.required = isRequired;

              if (!isRequired) {
                secretQuestionInput.value = "";
                secretAnswerInput.value = "";
              }
            });
          } else {
            secretQuestionSection.innerHTML = `
            <div class="form-group">
              <label for="secretQuestion">Set Security Question</label>
              <input type="text" class="form-control" id="secretQuestion" 
                     placeholder="Enter your security question (e.g., What was your first pet's name?)" required>
              <small class="form-text text-muted">Create a question that only you know the answer to.</small>
            </div>
            <div class="form-group">
              <label for="secretAnswer">Security Answer</label>
              <input type="text" class="form-control" id="secretAnswer" 
                     placeholder="Enter the answer to your security question" required>
              <small class="form-text text-muted">This answer will be used to verify your identity if you forget your email.</small>
            </div>
          `;
          }
        }
      }
    } catch (error) {
      console.error("Error loading secret question form:", error);
    }
  }
}

// Instantiate the manager
const profileManager = new ProfileManager();
