class CakeOptionsService {
  constructor() {
    this.disabledOptions = new Set();
    this.isInitialized = false;
  }

  // Initialize the service and load disabled options
  async init() {
    if (this.isInitialized) return;

    try {
      await this.loadDisabledOptions();
      this.isInitialized = true;
    } catch (error) {
      console.error("Failed to initialize CakeOptionsService:", error);
    }
  }

  // Load disabled options from API
  async loadDisabledOptions() {
    try {
      const response = await fetch(
        `${window.API_BASE_URL}/api/admin/cake-options`
      );
      const result = await response.json();

      if (result.success) {
        this.disabledOptions.clear();
        result.data.forEach((option) => {
          this.disabledOptions.add(`${option.category}:${option.option_value}`);
        });
        console.log("Loaded disabled options:", this.disabledOptions.size);
      }
    } catch (error) {
      console.error("Error loading disabled options:", error);
    }
  }

  // Check if an option is disabled
  isOptionDisabled(category, value) {
    return this.disabledOptions.has(`${category}:${value}`);
  }

  // Apply disabled options to UI elements
  applyDisabledOptions() {
    this.applyToSizeOptions();
    this.applyToFlavorOptions();
    this.applyToIcingStyleOptions();
    this.applyToIcingColorOptions();
    this.applyToFillingOptions();
    this.applyToBorderOptions();
    this.applyToDecorationOptions();
    this.applyToFlowerTypeOptions();
  }

  // Size options
  applyToSizeOptions() {
    document.querySelectorAll(".size-option-walmart").forEach((option) => {
      const size = option.dataset.size;
      if (this.isOptionDisabled("sizes", size)) {
        this.disableOptionElement(option, "This size is currently unavailable");
      }
    });
  }

  // Flavor options
  applyToFlavorOptions() {
    document.querySelectorAll(".flavor-option-walmart").forEach((option) => {
      const color = option.dataset.color;
      if (this.isOptionDisabled("flavors", color)) {
        this.disableOptionElement(
          option,
          "This flavor is currently unavailable"
        );
      }
    });
  }

  // Icing style options
  applyToIcingStyleOptions() {
    document.querySelectorAll(".icing-style-option").forEach((option) => {
      const icing = option.dataset.icing;
      if (this.isOptionDisabled("icingStyles", icing)) {
        this.disableOptionElement(
          option,
          "This icing style is currently unavailable"
        );
      }
    });
  }

  // Icing color options
  applyToIcingColorOptions() {
    document
      .querySelectorAll(".color-options-walmart .color-option-walmart")
      .forEach((option) => {
        const color = option.dataset.color;
        if (this.isOptionDisabled("icingColors", color)) {
          this.disableOptionElement(
            option,
            "This color is currently unavailable"
          );
        }
      });
  }

  // Filling options
  applyToFillingOptions() {
    document.querySelectorAll(".filling-option-walmart").forEach((option) => {
      const filling = option.dataset.filling;
      if (this.isOptionDisabled("fillings", filling)) {
        this.disableOptionElement(
          option,
          "This filling is currently unavailable"
        );
      }
    });
  }

  // Border options
  applyToBorderOptions() {
    // Bottom borders
    document
      .querySelectorAll("#step-5 .border-option-walmart")
      .forEach((option) => {
        const border = option.dataset.border;
        if (this.isOptionDisabled("borders_bottom", border)) {
          this.disableOptionElement(
            option,
            "This border style is currently unavailable"
          );
        }
      });

    // Top borders
    document
      .querySelectorAll("#step-6 .border-option-walmart")
      .forEach((option) => {
        const border = option.dataset.border;
        if (this.isOptionDisabled("borders_top", border)) {
          this.disableOptionElement(
            option,
            "This border style is currently unavailable"
          );
        }
      });
  }

  // Decoration options
  applyToDecorationOptions() {
    document
      .querySelectorAll(".decoration-option-walmart")
      .forEach((option) => {
        const decoration = option.dataset.decoration;
        if (this.isOptionDisabled("decorations", decoration)) {
          this.disableOptionElement(
            option,
            "This decoration is currently unavailable"
          );
        }
      });
  }

  // Flower type options
  applyToFlowerTypeOptions() {
    document.querySelectorAll(".flower-option-walmart").forEach((option) => {
      const flowerType = option.dataset.flowerType;
      if (this.isOptionDisabled("flowerTypes", flowerType)) {
        this.disableOptionElement(
          option,
          "This flower type is currently unavailable"
        );
      }
    });
  }

  // Helper method to disable an option element
  disableOptionElement(
    element,
    tooltipText = "This option is currently unavailable"
  ) {
    element.classList.add("disabled-option");
    element.style.opacity = "0.5";
    element.style.pointerEvents = "none";
    element.style.cursor = "not-allowed";
    element.title = tooltipText;

    // Add visual indicator for color options
    if (element.classList.contains("color-option-walmart")) {
      element.style.filter = "grayscale(100%)";
    }
  }

  // Enable an option element (if needed)
  enableOptionElement(element) {
    element.classList.remove("disabled-option");
    element.style.opacity = "";
    element.style.pointerEvents = "";
    element.style.cursor = "";
    element.title = "";
    element.style.filter = "";
  }

  // Check if an option is disabled before processing click
  shouldPreventClick(element) {
    if (element.classList.contains("disabled-option")) {
      this.showTemporaryMessage("This option is currently unavailable");
      return true;
    }
    return false;
  }

  // Show temporary message to user
  showTemporaryMessage(message) {
    // You can use your existing toast system or create a simple one
    if (window.ToastNotifications) {
      ToastNotifications.showToast(message, "warning");
    } else {
      // Fallback simple notification
      const notification = document.createElement("div");
      notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #ffc107;
                color: #000;
                padding: 10px 15px;
                border-radius: 4px;
                z-index: 10000;
                font-family: inherit;
            `;
      notification.textContent = message;
      document.body.appendChild(notification);

      setTimeout(() => {
        document.body.removeChild(notification);
      }, 3000);
    }
  }

  // Refresh disabled options (useful if options change dynamically)
  async refresh() {
    await this.loadDisabledOptions();
    this.applyDisabledOptions();
  }
}

// Create global instance
window.cakeOptionsService = new CakeOptionsService();
