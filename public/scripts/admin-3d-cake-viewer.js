// admin-cake-3d-viewer.js - Optimized 3D Cake Viewer for Admin Panel
class AdminCake3DViewer {
  constructor() {
    this.renderer = null;
    this.currentOrderId = null;
    this.modal = null;
    this.is3DView = false;
    this.isInitialized = false;
  }

  // Initialize the 3D viewer
  init() {
    if (this.isInitialized) return;

    this.modal = new bootstrap.Modal(document.getElementById("imageModal"));
    this.setupEventListeners();
    this.modifyExistingModal();
    this.isInitialized = true;

    console.log("🎯 3D Viewer initialized");
  }

  // Modify the existing image modal to support 3D content
  modifyExistingModal() {
    const modalBody = document.querySelector("#imageModal .modal-body");

    // Clear any existing 3D containers
    const existingContainer = document.getElementById(
      "admin-cake-3d-container"
    );
    if (existingContainer) {
      existingContainer.remove();
    }

    // Add 3D container
    const threeDContainer = document.createElement("div");
    threeDContainer.id = "admin-cake-3d-container";
    threeDContainer.style.display = "none";
    threeDContainer.style.width = "100%";
    threeDContainer.style.height = "500px";
    threeDContainer.style.background = "#f5f1e9";
    threeDContainer.style.borderRadius = "8px";
    threeDContainer.style.position = "relative";
    threeDContainer.style.overflow = "hidden";

    modalBody.appendChild(threeDContainer);

    // Add 3D controls info
    const controlsInfo = document.createElement("div");
    controlsInfo.id = "admin-3d-controls";
    controlsInfo.className = "mt-2 text-center text-muted small";
    controlsInfo.style.display = "none";
    controlsInfo.innerHTML = `
            <i class="bi bi-arrow-left-right"></i> Click and drag to rotate • 
        `;
    modalBody.appendChild(controlsInfo);

    // Add configuration details
    const configDetails = document.createElement("div");
    configDetails.id = "admin-cake-config-details";
    configDetails.className = "mt-3";
    configDetails.style.display = "none";
    configDetails.innerHTML = `
            <div class="cake-config-details border-top pt-3">
                <h6 class="border-bottom pb-2">Cake Configuration</h6>
                <div id="cakeConfigDetails"></div>
            </div>
        `;
    modalBody.appendChild(configDetails);
  }

  // Setup event listeners
  setupEventListeners() {
    // Listen for clicks on 3D design buttons
    document.addEventListener("click", (e) => {
      if (
        e.target.classList.contains("view-3d-design") ||
        e.target.closest(".view-3d-design")
      ) {
        e.preventDefault();
        const button = e.target.classList.contains("view-3d-design")
          ? e.target
          : e.target.closest(".view-3d-design");
        const orderId = button.dataset.orderId;
        this.open3DViewer(orderId);
      }
    });

    // Handle modal events
    const imageModal = document.getElementById("imageModal");
    if (imageModal) {
      imageModal.addEventListener("hidden.bs.modal", () => {
        this.resetModal();
      });

      imageModal.addEventListener("shown.bs.modal", () => {
        if (this.is3DView) {
          this.forceResize();
        }
      });
    }
  }

  // Open 3D viewer for a specific order
  async open3DViewer(orderId) {
    console.log("🎂 Opening 3D viewer for order:", orderId);

    // Cleanup previous session
    this.cleanup();

    this.currentOrderId = orderId;
    this.is3DView = true;

    try {
      // Update modal title
      document.getElementById(
        "imageModalLabel"
      ).textContent = `3D Cake Design - Order #CC${String(orderId).padStart(
        3,
        "0"
      )}`;

      // Show 3D view
      this.show3DView();

      // Fetch cake configuration data
      const cakeConfig = await this.fetchCakeConfig(orderId);
      console.log("📦 Cake config received:", cakeConfig);

      // Initialize 3D viewer
      await this.init3DViewer(cakeConfig);

      // Show configuration details
      this.showConfigDetails(cakeConfig);

      // Show modal
      this.modal.show();

      // Force resize after modal is shown
      setTimeout(() => {
        this.forceResize();
      }, 100);
    } catch (error) {
      console.error("❌ Error opening 3D viewer:", error);
      this.showError("Failed to load 3D cake viewer. Please try again.");
      this.resetModal();
    }
  }

  // Show 3D view and hide image view
  show3DView() {
    const modalImg = document.querySelector("#imageModal img");
    const container = document.getElementById("admin-cake-3d-container");

    if (modalImg) modalImg.style.display = "none";
    if (container) {
      container.style.display = "block";
      container.innerHTML = `
                <div id="admin-3d-loading" class="text-center p-4" style="
                    position: absolute; top: 50%; left: 50%; 
                    transform: translate(-50%, -50%); z-index: 10;
                ">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading 3D viewer...</span>
                    </div>
                    <p class="mt-2">Loading 3D cake viewer...</p>
                </div>
            `;
    }

    const controls = document.getElementById("admin-3d-controls");
    const configDetails = document.getElementById("admin-cake-config-details");

    if (controls) controls.style.display = "block";
    if (configDetails) configDetails.style.display = "block";
  }

  // Reset modal to image view
  resetModal() {
    this.is3DView = false;

    const modalImg = document.querySelector("#imageModal img");
    const container = document.getElementById("admin-cake-3d-container");
    const controls = document.getElementById("admin-3d-controls");
    const configDetails = document.getElementById("admin-cake-config-details");

    if (modalImg) modalImg.style.display = "block";
    if (container) container.style.display = "none";
    if (controls) controls.style.display = "none";
    if (configDetails) configDetails.style.display = "none";

    // Cleanup 3D resources
    this.cleanup();
  }

  // Fetch cake configuration from backend
  async fetchCakeConfig(orderId) {
    const token = sessionStorage.getItem("token");
    const response = await fetch(
      `${window.API_BASE_URL}/api/custom-cake/admin/orders/${orderId}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch order data: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success || !data.order) {
      throw new Error("Order not found");
    }

    return data.order;
  }

  // Initialize Three.js 3D viewer
  async init3DViewer(cakeConfig) {
    const container = document.getElementById("admin-cake-3d-container");
    if (!container) {
      throw new Error("3D container not found");
    }

    try {
      console.log("🚀 Initializing 3D viewer...");

      // Create new renderer instance
      this.renderer = new Cake3DRenderer("admin-cake-3d-container");

      // Initialize the renderer
      await this.renderer.init();

      // Hide loading
      const loadingElement = document.getElementById("admin-3d-loading");
      if (loadingElement) {
        loadingElement.style.display = "none";
      }

      // Update cake with the configuration
      const mappedConfig = this.mapToCakeConfig(cakeConfig);
      console.log("🎨 Applying cake config:", mappedConfig);
      this.renderer.updateCake(mappedConfig);

      // Force immediate render
      this.forceResize();

      console.log("✅ 3D viewer initialized successfully");
    } catch (error) {
      console.error("❌ Error initializing 3D viewer:", error);

      // Show error state
      const loadingElement = document.getElementById("admin-3d-loading");
      if (loadingElement) {
        loadingElement.innerHTML = `
                    <div class="alert alert-warning">
                        <h6>3D Viewer Error</h6>
                        <p>Unable to load 3D preview: ${error.message}</p>
                        <small>Showing configuration details only</small>
                    </div>
                `;
      }

      throw new Error("Failed to initialize 3D viewer");
    }
  }

  // Force canvas resize and render
  forceResize() {
    if (this.renderer && this.renderer.renderer) {
      const container = document.getElementById("admin-cake-3d-container");
      if (container) {
        const width = container.clientWidth;
        const height = container.clientHeight;

        if (this.renderer.camera) {
          this.renderer.camera.aspect = width / height;
          this.renderer.camera.updateProjectionMatrix();
        }

        this.renderer.renderer.setSize(width, height);

        // Force render
        if (this.renderer.scene && this.renderer.camera) {
          this.renderer.renderer.render(
            this.renderer.scene,
            this.renderer.camera
          );
        }
      }
    }
  }

  // Cleanup resources
  cleanup() {
    console.log("🧹 Cleaning up 3D viewer...");

    if (this.renderer) {
      // Remove canvas from DOM
      const container = document.getElementById("admin-cake-3d-container");
      if (container && this.renderer.domElement) {
        // Check if canvas is still in DOM before removing
        if (this.renderer.domElement.parentNode === container) {
          container.removeChild(this.renderer.domElement);
        }
      }

      // Dispose of WebGL resources
      this.renderer.dispose();
      this.renderer = null;
    }
  }

  // Map database fields to cake configuration format
  mapToCakeConfig(orderData) {
    const ensureHexColor = (color) => {
      if (!color) return "#FFFFFF";
      const cleanColor = color.replace("#", "").toUpperCase();
      return `#${cleanColor}`;
    };

    const ensureLowerCase = (value) => {
      return value ? value.toLowerCase() : "none";
    };

    return {
      size: ensureLowerCase(orderData.size),
      cakeColor: ensureHexColor(orderData.cakeColor),
      icingStyle: ensureLowerCase(orderData.icingStyle),
      icingColor: ensureHexColor(orderData.icingColor),
      filling: ensureLowerCase(orderData.filling),
      bottomBorder: ensureLowerCase(orderData.bottomBorder),
      topBorder: ensureLowerCase(orderData.topBorder),
      bottomBorderColor: ensureHexColor(orderData.bottomBorderColor),
      topBorderColor: ensureHexColor(orderData.topBorderColor),
      decorations: ensureLowerCase(orderData.decorations),
      flowerType: ensureLowerCase(orderData.flowerType || "none"),
      customText: orderData.customText || "",
      messageChoice: ensureLowerCase(orderData.messageChoice || "none"),
      toppingsColor: ensureHexColor(orderData.toppingsColor),
    };
  }

  // Show configuration details
  showConfigDetails(cakeConfig) {
    const detailsContainer = document.getElementById("cakeConfigDetails");
    if (!detailsContainer) return;

    const sizeLabels = {
      small: '6" Round',
      medium: '8" Round',
      large: '10" Round',
    };
    const flavorNames = { "#8B4513": "Chocolate", "#FFFFFF": "White" };
    const icingStyles = {
      buttercream: "Buttercream",
      whipped: "Whipped Cream",
    };
    const fillingNames = {
      none: "None",
      strawberry: "Strawberry",
      bavarian: "Cream",
    };
    const borderNames = { none: "None", beads: "Beads", shells: "Shells" };
    const decorationNames = {
      none: "None",
      flowers: "Flowers",
      balloons: "Balloons",
      toppings: "Toppings",
    };
    const flowerNames = {
      none: "None",
      daisies: "Daisies",
      buttonRoses: "Button Roses",
    };

    detailsContainer.innerHTML = `
            <div class="config-item mb-2">
                <strong>Size:</strong> ${
                  sizeLabels[cakeConfig.size] || cakeConfig.size
                }
            </div>
            <div class="config-item mb-2">
                <strong>Flavor:</strong> ${
                  flavorNames[cakeConfig.cakeColor] || "Custom"
                }
            </div>
            <div class="config-item mb-2">
                <strong>Icing:</strong> ${
                  icingStyles[cakeConfig.icingStyle] || cakeConfig.icingStyle
                }
            </div>
            <div class="config-item mb-2">
                <strong>Icing Color:</strong> 
                <span class="color-swatch" style="background-color: ${
                  cakeConfig.icingColor
                };"></span>
            </div>
            <div class="config-item mb-2">
                <strong>Filling:</strong> ${
                  fillingNames[cakeConfig.filling] || cakeConfig.filling
                }
            </div>
            <div class="config-item mb-2">
                <strong>Bottom Border:</strong> ${
                  borderNames[cakeConfig.bottomBorder] ||
                  cakeConfig.bottomBorder
                }
            </div>
            ${
              cakeConfig.bottomBorder !== "none"
                ? `
            <div class="config-item mb-2">
                <strong>Bottom Border Color:</strong>
                <span class="color-swatch" style="background-color: ${cakeConfig.bottomBorderColor};"></span>
            </div>
            `
                : ""
            }
            <div class="config-item mb-2">
                <strong>Top Border:</strong> ${
                  borderNames[cakeConfig.topBorder] || cakeConfig.topBorder
                }
            </div>
            ${
              cakeConfig.topBorder !== "none"
                ? `
            <div class="config-item mb-2">
                <strong>Top Border Color:</strong>
                <span class="color-swatch" style="background-color: ${cakeConfig.topBorderColor};"></span>
            </div>
            `
                : ""
            }
            <div class="config-item mb-2">
                <strong>Decorations:</strong> ${
                  decorationNames[cakeConfig.decorations] ||
                  cakeConfig.decorations
                }
            </div>
            ${
              cakeConfig.decorations === "flowers"
                ? `
            <div class="config-item mb-2">
                <strong>Flower Type:</strong> ${
                  flowerNames[cakeConfig.flowerType] || cakeConfig.flowerType
                }
            </div>
            `
                : ""
            }
            ${
              cakeConfig.decorations === "toppings"
                ? `
            <div class="config-item mb-2">
                <strong>Toppings Color:</strong>
                <span class="color-swatch" style="background-color: ${cakeConfig.toppingsColor};"></span>
            </div>
            `
                : ""
            }
            ${
              cakeConfig.customText
                ? `
            <div class="config-item mb-2">
                <strong>Custom Message:</strong> "${cakeConfig.customText}"
            </div>
            `
                : ""
            }
        `;
  }

  // Show error message
  showError(message) {
    Swal.fire({
      icon: "error",
      title: "Error",
      text: message,
      confirmButtonColor: "#2c9045",
    });
  }
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.adminCake3DViewer = new AdminCake3DViewer();
  window.adminCake3DViewer.init();
});
