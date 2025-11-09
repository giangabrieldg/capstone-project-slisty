class CakeOptionsManager {
  constructor() {
    this.options = {};
    this.hasChanges = false;
    this.allOptions = [];
    this.filteredOptions = [];
    this.init();
  }

  async init() {
    await this.loadOptions();
    this.renderOptions();
    this.setupEventListeners();
    this.setupSearch();
  }

  async loadOptions() {
    try {
      const response = await fetch("/api/admin/cake-options");
      const result = await response.json();

      if (result.success) {
        this.options = result.data;
        this.allOptions = this.getCategoryStructure();
        this.filteredOptions = [...this.allOptions];
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error("Error loading options:", error);
      this.showSweetAlert("Error loading options: " + error.message, "error");
    }
  }

  getCategoryStructure() {
    return [
      {
        key: "sizes",
        displayName: "Cake Sizes",
        options: [
          { value: "small", name: '6" Round (12 servings)', type: "size" },
          { value: "medium", name: '8" Round (16 servings)', type: "size" },
          { value: "large", name: '10" Round (24 servings)', type: "size" },
        ],
      },
      {
        key: "flavors",
        displayName: "Cake Flavors",
        options: [
          {
            value: "#8B4513",
            name: "Chocolate",
            type: "flavor",
            color: "#8B4513",
          },
          {
            value: "#F3E6C6",
            name: "Vanilla",
            type: "flavor",
            color: "#F3E6C6",
          },
        ],
      },
      {
        key: "icingStyles",
        displayName: "Icing Styles",
        options: [
          { value: "buttercream", name: "Buttercreme Style", type: "style" },
          { value: "whipped", name: "Whipped", type: "style" },
        ],
      },
      {
        key: "icingColors",
        displayName: "Icing Colors",
        options: [
          { value: "#FFFFFF", name: "White", type: "color", color: "#FFFFFF" },
          {
            value: "#FFDDEE",
            name: "Light Pink",
            type: "color",
            color: "#FFDDEE",
          },
          { value: "#FFB6C1", name: "Pink", type: "color", color: "#FFB6C1" },
          { value: "#FF6347", name: "Red", type: "color", color: "#FF6347" },
          { value: "#FFA500", name: "Orange", type: "color", color: "#FFA500" },
          { value: "#FFFF00", name: "Yellow", type: "color", color: "#FFFF00" },
          {
            value: "#87CEEB",
            name: "Light Blue",
            type: "color",
            color: "#87CEEB",
          },
          { value: "#1E90FF", name: "Blue", type: "color", color: "#1E90FF" },
          { value: "#8A2BE2", name: "Purple", type: "color", color: "#8A2BE2" },
          { value: "#32CD32", name: "Green", type: "color", color: "#32CD32" },
          { value: "#ADFF2F", name: "Lime", type: "color", color: "#ADFF2F" },
          { value: "#20B2AA", name: "Teal", type: "color", color: "#20B2AA" },
          { value: "#2F2F2F", name: "Black", type: "color", color: "#2F2F2F" },
          { value: "#A9A9A9", name: "Gray", type: "color", color: "#A9A9A9" },
          { value: "#8B4513", name: "Brown", type: "color", color: "#8B4513" },
        ],
      },
      {
        key: "fillings",
        displayName: "Fillings",
        options: [
          { value: "none", name: "No Selection", type: "filling" },
          { value: "strawberry", name: "Strawberry", type: "filling" },
          { value: "bavarian", name: "Bavarian Creme", type: "filling" },
        ],
      },
      {
        key: "borders_bottom",
        displayName: "Bottom Borders",
        options: [
          { value: "none", name: "No Border", type: "border" },
          { value: "beads", name: "Beads", type: "border" },
          { value: "shells", name: "Shells", type: "border" },
        ],
      },
      {
        key: "borders_top",
        displayName: "Top Borders",
        options: [
          { value: "none", name: "No Border", type: "border" },
          { value: "beads", name: "Beads", type: "border" },
          { value: "shells", name: "Shells", type: "border" },
        ],
      },
      {
        key: "decorations",
        displayName: "Decorations",
        options: [
          { value: "none", name: "No Decorations", type: "decoration" },
          { value: "flowers", name: "Flowers", type: "decoration" },
          { value: "balloons", name: "Balloons", type: "decoration" },
          { value: "toppings", name: "Toppings", type: "decoration" },
        ],
      },
      {
        key: "flowerTypes",
        displayName: "Flower Types",
        options: [
          { value: "daisies", name: "Daisies", type: "flower" },
          { value: "buttonRoses", name: "Button Roses", type: "flower" },
        ],
      },
    ];
  }

  renderOptions() {
    const container = document.getElementById("optionsContainer");

    if (this.filteredOptions.length === 0) {
      container.innerHTML = `
                <div class="text-center py-5">
                    <i class="bi bi-search display-1 text-muted"></i>
                    <h4 class="mt-3 text-muted">No options found</h4>
                    <p class="text-muted">Try adjusting your search terms</p>
                </div>
            `;
      return;
    }

    let html = "";

    this.filteredOptions.forEach((category) => {
      const hasVisibleOptions = category.options.some(
        (option) => !option._hidden
      );

      if (!hasVisibleOptions) return;

      html += `
                <div class="option-section">
                    <div class="category-header">
                        <h5>${category.displayName}</h5>
                    </div>
            `;

      category.options.forEach((option) => {
        if (option._hidden) return;

        const isDisabled = this.isOptionDisabled(category.key, option.value);
        const colorPreview = option.color
          ? `<span class="color-preview" style="background-color: ${option.color}"></span>`
          : "";

        html += `
                    <div class="option-item ${
                      isDisabled ? "option-disabled" : ""
                    }">
                        <div class="option-info">
                            <div class="option-name">
                                ${colorPreview}${option.name}
                            </div>
                            <div class="option-value">${option.value}</div>
                        </div>
                        <div class="option-toggle">
                            <div class="form-check form-switch">
                                <input class="form-check-input" type="checkbox" 
                                       ${isDisabled ? "" : "checked"}
                                       data-category="${category.key}"
                                       data-value="${option.value}"
                                       id="opt_${
                                         category.key
                                       }_${option.value.replace("#", "")}">
                                <label class="form-check-label" for="opt_${
                                  category.key
                                }_${option.value.replace("#", "")}">
                                    ${isDisabled ? "Disabled" : "Enabled"}
                                </label>
                            </div>
                        </div>
                    </div>
                `;
      });

      html += `</div>`;
    });

    container.innerHTML = html;
  }

  isOptionDisabled(category, value) {
    return (
      this.options[category]?.some(
        (opt) => opt.option_value === value && opt.is_disabled
      ) || false
    );
  }

  setupEventListeners() {
    document
      .getElementById("optionsContainer")
      .addEventListener("change", (e) => {
        if (e.target.type === "checkbox") {
          this.hasChanges = true;
          document.getElementById("saveBtn").disabled = false;

          const optionItem = e.target.closest(".option-item");
          if (e.target.checked) {
            optionItem.classList.remove("option-disabled");
            e.target.nextElementSibling.textContent = "Enabled";
          } else {
            optionItem.classList.add("option-disabled");
            e.target.nextElementSibling.textContent = "Disabled";
          }
        }
      });

    document
      .getElementById("saveBtn")
      .addEventListener("click", () => this.saveChanges());
    document
      .getElementById("toggleAllBtn")
      .addEventListener("click", () => this.toggleAllOptions());
  }

  setupSearch() {
    const searchInput = document.getElementById("searchOptions");
    searchInput.addEventListener("input", (e) => {
      const searchTerm = e.target.value.toLowerCase().trim();
      this.filterOptions(searchTerm);
    });
  }

  filterOptions(searchTerm) {
    if (!searchTerm) {
      this.filteredOptions = [...this.allOptions];
      this.renderOptions();
      return;
    }

    this.filteredOptions = this.allOptions.map((category) => {
      const filteredCategory = {
        ...category,
        options: category.options.map((option) => ({
          ...option,
          _hidden:
            !option.name.toLowerCase().includes(searchTerm) &&
            !option.value.toLowerCase().includes(searchTerm) &&
            !category.displayName.toLowerCase().includes(searchTerm),
        })),
      };
      return filteredCategory;
    });

    this.renderOptions();
  }

  toggleAllOptions() {
    const toggleAllBtn = document.getElementById("toggleAllBtn");
    const isCurrentlyEnabled = toggleAllBtn.textContent.includes("Enable");

    // Update all checkboxes
    document.querySelectorAll(".form-check-input").forEach((checkbox) => {
      checkbox.checked = isCurrentlyEnabled;
      const optionItem = checkbox.closest(".option-item");
      if (isCurrentlyEnabled) {
        optionItem.classList.remove("option-disabled");
        checkbox.nextElementSibling.textContent = "Enabled";
      } else {
        optionItem.classList.add("option-disabled");
        checkbox.nextElementSibling.textContent = "Disabled";
      }
    });

    // Update button text
    toggleAllBtn.textContent = isCurrentlyEnabled
      ? "Disable All Options"
      : "Enable All Options";
    this.hasChanges = true;
    document.getElementById("saveBtn").disabled = false;
  }

  async saveChanges() {
    const saveBtn = document.getElementById("saveBtn");
    const spinner = saveBtn.querySelector(".spinner-border");
    const updates = [];

    // Collect all changes
    document.querySelectorAll(".form-check-input").forEach((checkbox) => {
      const category = checkbox.dataset.category;
      const value = checkbox.dataset.value;
      const optionName = checkbox
        .closest(".option-item")
        .querySelector(".option-name")
        .textContent.trim();

      updates.push({
        category: category,
        option_value: value,
        option_name: optionName,
        is_disabled: !checkbox.checked,
      });
    });

    try {
      spinner.classList.remove("d-none");
      saveBtn.disabled = true;

      const response = await fetch("/api/admin/cake-options", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ updates }),
      });

      const result = await response.json();

      if (result.success) {
        this.showSweetAlert("Options saved successfully!", "success");
        this.hasChanges = false;
        saveBtn.disabled = true;
        await this.loadOptions(); // Reload to get updated state
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error("Error saving options:", error);
      this.showSweetAlert("Error saving options: " + error.message, "error");
      saveBtn.disabled = false;
    } finally {
      spinner.classList.add("d-none");
    }
  }

  async resetToDefault() {
    const result = await Swal.fire({
      title: "Enable All Options?",
      text: "Are you sure you want to enable all options? This cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#2c9045",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, enable all!",
      cancelButtonText: "Cancel",
    });

    if (result.isConfirmed) {
      try {
        const response = await fetch("/api/admin/cake-options", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ updates: [] }), // Empty array will reset all to enabled
        });

        const result = await response.json();

        if (result.success) {
          this.showSweetAlert("All options have been enabled!", "success");
          await this.loadOptions();
          this.renderOptions();
          this.hasChanges = false;
          document.getElementById("saveBtn").disabled = true;
          document.getElementById("toggleAllBtn").textContent =
            "Disable All Options";
        } else {
          throw new Error(result.message);
        }
      } catch (error) {
        console.error("Error resetting options:", error);
        this.showSweetAlert(
          "Error resetting options: " + error.message,
          "error"
        );
      }
    }
  }

  // sweet alert for saving changes

  showSweetAlert(message, type = "success") {
    const config = {
      title: type === "success" ? "Success!" : "Error!",
      text: message,
      icon: type,
      confirmButtonText: "OK",
      confirmButtonColor: "#2c9045",
      timer: type === "success" ? 3000 : null,
      timerProgressBar: type === "success",
    };

    if (type === "success") {
      config.showClass = {
        popup: "animate__animated animate__fadeInDown",
      };
      config.hideClass = {
        popup: "animate__animated animate__fadeOutUp",
      };
    }

    Swal.fire(config);
  }
}

// Initialize when page loads
document.addEventListener("DOMContentLoaded", () => {
  new CakeOptionsManager();
});
