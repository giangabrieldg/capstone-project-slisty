// custom-cake-controller.js - Main controller for the custom cake interface

class CustomCakeController {
  constructor() {
    this.config = {
      size: "small",
      cakeColor: "#8B4513",
      icingStyle: "buttercream",
      icingColor: "#FFFFFF",
      filling: "none",
      bottomBorder: "none",
      topBorder: "none",
      bottomBorderColor: "#FFFFFF",
      topBorderColor: "#FFFFFF",
      decorations: "none",
      flowerType: "none",
      customText: "",
      messageChoice: "none",
      toppingsColor: "#FFFFFF",
    };

    this.pricing = {
      base: {
        small: 850,
        medium: 1020,
        large: 1700,
      },
      fillings: {
        none: 0,
        strawberry: 150,
        bavarian: 150,
      },
    };

    this.currentWizardStep = 1;
    this.totalWizardSteps = 8;
    this.stepNames = [
      "",
      "Size",
      "Flavor",
      "Icing",
      "Filling",
      "Bottom Border",
      "Top Border",
      "Custom Message",
      "Decorations",
    ];

    // Initialize services
    this.renderer = null;
    this.apiService = new CakeAPIService();
    this.guidedTour = null;
  }

  // Initialize the application
  async init() {
  // Initialize 3D renderer
  this.renderer = new Cake3DRenderer("canvas-container");
  await this.renderer.init();

  // Initialize guided tour with reference to this controller
  this.guidedTour = new GuidedTour(this);

  // Setup event listeners
  this.setupEventListeners();

  // Initialize UI
  this.setupInitialView();

  // Update initial display
  this.updateCake();
  this.updateOrderSummary();
  
}
// checkout custom cake order
async checkoutCustomCake() {
  if (!this.apiService.isAuthenticated()) {
    alert('Please log in to checkout your custom cake');
    window.location.href = '/public/customer/login.html';
    return;
  }

  // Calculate total price
  const totalPrice = this.pricing.base[this.config.size] + this.pricing.fillings[this.config.filling];
  
  if (!totalPrice || totalPrice <= 0) {
    alert('Invalid price calculation. Please try again.');
    return;
  }

  try {
    // Submit the order first
    const submitResponse = await this.apiService.submitCustomOrder(
      this.config, 
      this.pricing, 
      this.renderer
    );

    if (submitResponse.success) {
      // Redirect to checkout with custom cake data
      const customCakeId = submitResponse.data.customCakeId;
      window.location.href = `/public/customer/checkout.html?customCakeId=${customCakeId}&isImageOrder=false&amount=${totalPrice}`;
    } else {
      throw new Error(submitResponse.message);
    }
  } catch (error) {
    console.error('Checkout process error:', error);
    alert('Checkout failed: ' + error.message);
  }
}

// Add this helper method to the CustomCakeController class
selectPaymentMethod() {
  return new Promise((resolve) => {
    const useGcash = confirm('Would you like to pay with GCash? Click OK for GCash, Cancel for Cash on Delivery.');
    resolve(useGcash ? 'gcash' : 'cash');
  });
}
  // Setup event listeners for all UI interactions
  setupEventListeners() {
    this.setupSizeOptions();
    this.setupFlavorOptions();
    this.setupIcingOptions();
    this.setupColorOptions();
    this.setupFillingOptions();
    this.setupBorderOptions();
    this.setupMessageOptions();
    this.setupDecorationOptions();
    this.setupImageUpload();
    this.setupImageOrderForm();
    this.setupCustomTextInput();
  }

  // Setup size option event listeners
  setupSizeOptions() {
    document.querySelectorAll(".size-option-walmart").forEach((el) =>
      el.addEventListener("click", () => {
        document.querySelectorAll(".size-option-walmart").forEach((o) => o.classList.remove("active"));
        el.classList.add("active");
        this.config.size = el.dataset.size;
        this.updateCake();
        this.updateOrderSummary();
      })
    );
  }

  // Setup flavor option event listeners
  setupFlavorOptions() {
    document.querySelectorAll(".flavor-option-walmart").forEach((el) =>
      el.addEventListener("click", () => {
        document.querySelectorAll(".flavor-option-walmart").forEach((o) => o.classList.remove("active"));
        el.classList.add("active");
        this.config.cakeColor = el.dataset.color;
        this.updateCake();
        this.updateOrderSummary();
      })
    );
  }

  // Setup icing option event listeners
  setupIcingOptions() {
    document.querySelectorAll(".icing-style-option").forEach((el) =>
      el.addEventListener("click", () => {
        document.querySelectorAll(".icing-style-option").forEach((o) => o.classList.remove("active"));
        el.classList.add("active");
        this.config.icingStyle = el.dataset.icing.toLowerCase().replace(" ", "");
        this.updateOrderSummary();
      })
    );
  }

  // Setup color option event listeners
  setupColorOptions() {
    document.querySelectorAll(".color-options-walmart .color-option-walmart").forEach((c) =>
      c.addEventListener("click", () => {
        const parent = c.closest(".color-options-walmart");
        const borderType = parent.dataset.borderType;
        if (borderType === "bottom") {
          parent.querySelectorAll(".color-option-walmart").forEach((o) => o.classList.remove("active"));
          c.classList.add("active");
          this.config.bottomBorderColor = c.dataset.color;
          document.getElementById("selectedBottomBorderColorName").textContent = c.dataset.name;
          this.updateCake();
        } else if (borderType === "top") {
          parent.querySelectorAll(".color-option-walmart").forEach((o) => o.classList.remove("active"));
          c.classList.add("active");
          this.config.topBorderColor = c.dataset.color;
          document.getElementById("selectedTopBorderColorName").textContent = c.dataset.name;
          this.updateCake();
        } else {
          parent.querySelectorAll(".color-option-walmart").forEach((o) => o.classList.remove("active"));
          c.classList.add("active");
          this.config.icingColor = c.dataset.color;
          document.getElementById("selectedColorName").textContent = c.dataset.name;
          this.updateCake();
        }
        this.updateOrderSummary();
      })
    );

    document.querySelectorAll(".toppings-color-option").forEach((c) =>
      c.addEventListener("click", () => {
        document.querySelectorAll(".toppings-color-option").forEach((o) => o.classList.remove("active"));
        c.classList.add("active");
        this.config.toppingsColor = c.dataset.color;
        document.getElementById("selectedToppingsColorName").textContent = c.dataset.name;
        this.updateCake();
        this.updateOrderSummary();
      })
    );
  }

  // Setup filling option event listeners
  setupFillingOptions() {
    document.querySelectorAll(".filling-option-walmart").forEach((el) =>
      el.addEventListener("click", () => {
        document.querySelectorAll(".filling-option-walmart").forEach((o) => o.classList.remove("active"));
        el.classList.add("active");
        this.config.filling = el.dataset.filling;
        this.updateCake();
        this.updateOrderSummary();
      })
    );
  }

  // Setup border option event listeners
  setupBorderOptions() {
    document.querySelectorAll("#step-5 .border-option-walmart").forEach((el) =>
      el.addEventListener("click", () => {
        document.querySelectorAll("#step-5 .border-option-walmart").forEach((o) => o.classList.remove("active"));
        el.classList.add("active");
        this.config.bottomBorder = el.dataset.border;
        const colorSection = document.getElementById("bottomBorderColorSection");
        if (this.config.bottomBorder !== "none") {
          colorSection.style.display = "block";
        } else {
          colorSection.style.display = "none";
        }
        this.updateCake();
        this.updateOrderSummary();
      })
    );

    document.querySelectorAll("#step-6 .border-option-walmart").forEach((el) =>
      el.addEventListener("click", () => {
        document.querySelectorAll("#step-6 .border-option-walmart").forEach((o) => o.classList.remove("active"));
        el.classList.add("active");
        this.config.topBorder = el.dataset.border;
        const colorSection = document.getElementById("topBorderColorSection");
        if (this.config.topBorder !== "none") {
          colorSection.style.display = "block";
        } else {
          colorSection.style.display = "none";
        }
        this.updateCake();
        this.updateOrderSummary();
      })
    );
  }

  // Setup message option event listeners
  setupMessageOptions() {
    document.querySelectorAll(".message-option-walmart").forEach((option) =>
      option.addEventListener("click", () => {
        document.querySelectorAll(".message-option-walmart").forEach((o) => o.classList.remove("active"));
        option.classList.add("active");
        this.config.messageChoice = option.dataset.message;
        if (option.dataset.message === "none") {
          this.config.customText = "";
          document.getElementById("customTextWalmart").value = "";
          document.getElementById("charCountWalmart").textContent = "0";
        }
        this.updateOrderSummary();
      })
    );
  }

  // Setup decoration option event listeners
  setupDecorationOptions() {
    document.querySelectorAll(".decoration-option-walmart").forEach((el) =>
      el.addEventListener("click", () => {
        document.querySelectorAll(".decoration-option-walmart").forEach((o) => o.classList.remove("active"));
        el.classList.add("active");
        this.config.decorations = el.dataset.decoration;
        const flowerSubOptions = document.getElementById("flowerSubOptions");
        const toppingsColorSection = document.getElementById("toppingsColorSection");
        if (this.config.decorations === "flowers") {
          flowerSubOptions.style.display = "flex";
          toppingsColorSection.style.display = "none";
          if (!document.querySelector(".flower-option-walmart.active")) {
            document.querySelector('.flower-option-walmart[data-flower-type="daisies"]').classList.add("active");
            this.config.flowerType = "daisies";
          }
        } else if (this.config.decorations === "toppings") {
          flowerSubOptions.style.display = "none";
          toppingsColorSection.style.display = "block";
        } else {
          flowerSubOptions.style.display = "none";
          toppingsColorSection.style.display = "none";
          document.querySelectorAll(".flower-option-walmart").forEach((o) => o.classList.remove("active"));
          this.config.flowerType = "none";
        }
        this.updateCake();
        this.updateOrderSummary();
      })
    );

    document.querySelectorAll(".flower-option-walmart").forEach((el) =>
      el.addEventListener("click", () => {
        document.querySelectorAll(".flower-option-walmart").forEach((o) => o.classList.remove("active"));
        el.classList.add("active");
        this.config.flowerType = el.dataset.flowerType;
        this.updateCake();
        this.updateOrderSummary();
      })
    );
  }

  // Setup custom text input
  setupCustomTextInput() {
    document.getElementById("customTextWalmart").addEventListener("input", (e) => {
      const charCount = document.getElementById("charCountWalmart");
      charCount.textContent = e.target.value.length;
      this.config.customText = e.target.value;
      this.updateOrderSummary();
    });
  }

  // Setup image upload functionality
  setupImageUpload() {
    const uploadArea = document.getElementById("uploadArea");
    const imageUpload = document.getElementById("imageUpload");
    const uploadedImageDiv = document.getElementById("uploadedImage");
    const previewImage = document.getElementById("previewImage");

    uploadArea.addEventListener("click", () => {
      imageUpload.click();
    });

    uploadArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      uploadArea.style.borderColor = "var(--primary-color)";
      uploadArea.style.backgroundColor = "rgba(44, 144, 69, 0.05)";
    });

    uploadArea.addEventListener("dragleave", () => {
      uploadArea.style.borderColor = "#d0d0d0";
      uploadArea.style.backgroundColor = "#fafafa";
    });

    uploadArea.addEventListener("drop", (e) => {
      e.preventDefault();
      uploadArea.style.borderColor = "#d0d0d0";
      uploadArea.style.backgroundColor = "#fafafa";
      const files = e.dataTransfer.files;
      if (files.length > 0 && files[0].type.startsWith("image/")) {
        this.handleImageUpload(files[0]);
      }
    });

    imageUpload.addEventListener("change", (e) => {
      if (e.target.files.length > 0) {
        this.handleImageUpload(e.target.files[0]);
      }
    });
  }

  // Handle image upload
 handleImageUpload(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    // Show preview image
    document.getElementById("previewImage").src = e.target.result;
    document.getElementById("uploadedImage").style.display = "block";
    
    // Hide upload area, show form
    document.getElementById("uploadArea").style.display = "none";
    document.getElementById("imageOrderForm").style.display = "block";
    
    // Show file name in the form
    document.getElementById("uploadedFileName").textContent = file.name;
  };
  reader.readAsDataURL(file);
}

  // Setup image order form
  // In custom-cake-controller.js - replace the entire setupImageOrderForm method:
// In custom-cake-controller.js - replace the entire setupImageOrderForm method:
setupImageOrderForm() {
  // Set minimum date to tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  document.getElementById("eventDate").min = tomorrow.toISOString().split("T")[0];

  // Character count handlers
  document.getElementById("imageNotes").addEventListener("input", (e) => {
    document.getElementById("notesCharCount").textContent = e.target.value.length;
  });

  document.getElementById("imageMessage").addEventListener("input", (e) => {
    document.getElementById("messageCharCount").textContent = e.target.value.length;
  });

  // Form submission - FIXED VERSION
  document.getElementById("imageOrderFormContent").addEventListener("submit", async (e) => {
    e.preventDefault();
    
    // Get the form element directly
    const result = await this.apiService.submitImageBasedOrder(e.target);
    
    this.apiService.handleResponse(result, () => {
      this.resetImageOrderForm();
    });
  });
}
  // Reset image order form
  resetImageOrderForm() {
    document.getElementById("imageOrderFormContent").reset();
    document.getElementById("imageOrderForm").style.display = "none";
    document.getElementById("uploadedImage").style.display = "none";
    document.getElementById("uploadArea").style.display = "block";
    document.getElementById("imageUpload").value = "";
  }

  // Remove uploaded image
// Update handleImageUpload function
handleImageUpload(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    // Show preview image
    document.getElementById("previewImage").src = e.target.result;
    document.getElementById("uploadedImage").style.display = "block";
    
    // Hide upload area, show form
    document.getElementById("uploadArea").style.display = "none";
    document.getElementById("imageOrderForm").style.display = "block";
    
    // Show file name in the form
    document.getElementById("uploadedFileName").textContent = file.name;
  };
  reader.readAsDataURL(file);
}

removeUploadedImage() {
  // Reset file input
  document.getElementById('imageUpload').value = '';
  
  // Hide preview and form
  document.getElementById("uploadedImage").style.display = "none";
  document.getElementById("imageOrderForm").style.display = "none";
  
  // Show upload area again
  document.getElementById("uploadArea").style.display = "block";
}

  // Setup initial view
  setupInitialView() {
    document.getElementById("orderSummaryView").style.display = "none";
    document.querySelector(".step-content").style.display = "block";
    document.querySelector(".step-navigation").style.display = "flex";
    this.showStep(1);
  }

  // Update the 3D cake model
  updateCake() {
    if (this.renderer) {
      this.renderer.updateCake(this.config);
    }
  }

  // Update the order summary display
  updateOrderSummary() {
    const sizeLabels = {
      small: '6" Round',
      medium: '8" Round',
      large: '10" Round',
    };

    document.getElementById("summarySize").textContent = sizeLabels[this.config.size];
    document.getElementById("summarySizePrice").innerHTML = `<strong>₱${this.pricing.base[this.config.size].toFixed(2)}</strong>`;
    document.getElementById("summaryFlavor").textContent = this.config.cakeColor === "#8B4513" ? "Chocolate" : "White";

    const icingStyle = this.config.icingStyle === "buttercream" ? "Buttercream" : "Whipped";
    const icingColorName = document.getElementById("selectedColorName").textContent;
    document.getElementById("summaryIcing").textContent = `${icingStyle} - ${icingColorName}`;

    const fillingNames = {
      none: "None",
      strawberry: "Strawberry",
      bavarian: "Bavarian Creme",
    };
    document.getElementById("summaryFilling").textContent = fillingNames[this.config.filling];

    const fillingPriceElement = document.getElementById("summaryFillingPrice");
    if (this.config.filling !== "none") {
      fillingPriceElement.innerHTML = `<strong>+₱${this.pricing.fillings[this.config.filling].toFixed(2)}</strong>`;
      fillingPriceElement.style.display = "block";
    } else {
      fillingPriceElement.style.display = "none";
    }

    this.updateBorderSummary();
    this.updateMessageSummary();
    this.updateDecorationsSummary();

    const total = this.pricing.base[this.config.size] + this.pricing.fillings[this.config.filling];
    document.getElementById("summaryTotal").innerHTML = `<strong>₱${total.toFixed(2)}</strong>`;
  }

  // Update border summary
  updateBorderSummary() {
    const bottomBorderItem = document.getElementById("summaryBottomBorderItem");
    if (this.config.bottomBorder !== "none") {
      bottomBorderItem.style.display = "flex";
      const borderName = this.config.bottomBorder.charAt(0).toUpperCase() + this.config.bottomBorder.slice(1);
      const borderColorName = document.getElementById("selectedBottomBorderColorName").textContent;
      document.getElementById("summaryBottomBorder").textContent = `${borderName} - ${borderColorName}`;
    } else {
      bottomBorderItem.style.display = "none";
    }

    const topBorderItem = document.getElementById("summaryTopBorderItem");
    if (this.config.topBorder !== "none") {
      topBorderItem.style.display = "flex";
      const borderName = this.config.topBorder.charAt(0).toUpperCase() + this.config.topBorder.slice(1);
      const borderColorName = document.getElementById("selectedTopBorderColorName").textContent;
      document.getElementById("summaryTopBorder").textContent = `${borderName} - ${borderColorName}`;
    } else {
      topBorderItem.style.display = "none";
    }
  }

  // Update message summary
  updateMessageSummary() {
    const messageItem = document.getElementById("summaryMessageItem");
    if (this.config.customText && this.config.messageChoice === "custom") {
      messageItem.style.display = "flex";
      document.getElementById("summaryMessage").textContent = `"${this.config.customText}"`;
    } else {
      messageItem.style.display = "none";
    }
  }

  // Update decorations summary
  updateDecorationsSummary() {
    const decorationsItem = document.getElementById("summaryDecorationsItem");
    if (this.config.decorations !== "none") {
      decorationsItem.style.display = "flex";
      let decorationText = "";
      if (this.config.decorations === "flowers") {
        const flowerNames = {
          daisies: "Daisies",
          buttonRoses: "Button Roses",
        };
        decorationText = `Flowers (${flowerNames[this.config.flowerType] || "None"})`;
      } else if (this.config.decorations === "toppings") {
        const toppingsColorName = document.getElementById("selectedToppingsColorName").textContent;
        decorationText = `Toppings (${toppingsColorName})`;
      } else {
        const decorationNames = {
          balloons: "Balloons",
        };
        decorationText = decorationNames[this.config.decorations];
      }
      document.getElementById("summaryDecorations").textContent = decorationText;
    } else {
      decorationsItem.style.display = "none";
    }
  }

  // Navigate to a specific wizard step
  goToStep(stepNumber) {
    this.currentWizardStep = stepNumber;
    this.showStep(stepNumber);
    document.getElementById("orderSummaryView").style.display = "none";
    document.querySelector(".step-content").style.display = "block";
    document.querySelector(".step-navigation").style.display = "flex";
  }

  // Show the specified wizard step
  showStep(stepNumber) {
    document.querySelectorAll(".step-section").forEach((section) => {
      section.classList.remove("active");
    });
    document.getElementById(`step-${stepNumber}`).classList.add("active");

    const flowerSubOptions = document.getElementById("flowerSubOptions");
    if (stepNumber === 8 && this.config.decorations === "flowers") {
      flowerSubOptions.style.display = "flex";
    } else {
      flowerSubOptions.style.display = "none";
    }

    const toppingsColorSection = document.getElementById("toppingsColorSection");
    if (stepNumber === 8 && this.config.decorations === "toppings") {
      toppingsColorSection.style.display = "block";
    } else {
      toppingsColorSection.style.display = "none";
    }

    this.updateNavigationButtons(stepNumber);
  }

  // Update navigation buttons
  updateNavigationButtons(stepNumber) {
    const prevBtn = document.getElementById("prevBtn");
    const nextBtn = document.getElementById("nextBtn");
    const nextStepName = document.getElementById("nextStepName");

    prevBtn.style.display = stepNumber === 1 ? "none" : "block";

    if (stepNumber === this.totalWizardSteps) {
      nextBtn.textContent = "Done";
      nextBtn.className = "nav-btn";
      nextBtn.onclick = () => this.showOrderSummary();
      nextStepName.textContent = "";
    } else {
      nextBtn.innerHTML = "→";
      nextBtn.className = "nav-btn";
      nextBtn.onclick = () => this.nextStep();
      nextStepName.textContent = this.stepNames[stepNumber + 1];
    }
  }

  // Move to the next wizard step
  nextStep() {
    if (this.currentWizardStep < this.totalWizardSteps) {
      this.currentWizardStep++;
      this.showStep(this.currentWizardStep);
    } else {
      this.showOrderSummary();
    }
  }

  // Move to the previous wizard step
  prevStep() {
    if (this.currentWizardStep > 1) {
      this.currentWizardStep--;
      this.showStep(this.currentWizardStep);
    }
  }

  // Show the order summary view
  showOrderSummary() {
    document.getElementById("orderSummaryView").style.display = "block";
    document.querySelector(".step-content").style.display = "none";
    document.querySelector(".step-navigation").style.display = "none";
    this.updateOrderSummary();
  }

  // Show the first wizard step
  showFirstStep() {
    document.getElementById("orderSummaryView").style.display = "none";
    document.querySelector(".step-content").style.display = "block";
    document.querySelector(".step-navigation").style.display = "flex";
    this.goToStep(1);
  }

  // Submit custom cake order
  async submitOrder() {
    if (document.getElementById("imageUpload").files.length > 0) {
      alert("Please use the 'Submit Image Order' button for image-based orders.");
      return;
    }

    const result = await this.apiService.submitCustomOrder(this.config, this.pricing, this.renderer);
    
    this.apiService.handleResponse(result, () => {
      this.resetForm();
    });
  }

  // Reset the form to initial state
  resetForm() {
    this.config = {
      size: "small",
      cakeColor: "#8B4513",
      icingStyle: "buttercream",
      icingColor: "#FFFFFF",
      filling: "none",
      bottomBorder: "none",
      topBorder: "none",
      bottomBorderColor: "#FFFFFF",
      topBorderColor: "#FFFFFF",
      decorations: "none",
      flowerType: "none",
      customText: "",
      messageChoice: "none",
      toppingsColor: "#FFFFFF",
    };

    document.getElementById("imageUpload").value = "";
    document.getElementById("uploadedImage").style.display = "none";
    document.getElementById("uploadArea").style.display = "block";
    
    this.updateCake();
    this.updateOrderSummary();
    this.showFirstStep();
  }

  // Save design as image
  saveDesignImage() {
    if (this.renderer) {
      this.renderer.saveDesignImage();
    }
  }

  // Add to cart (placeholder - requires admin approval)
  addToCart() {
    alert("Please submit your custom cake order for admin review. Once approved, you can add it to your cart from the 'My Custom Orders' page.");
  }

  // Checkout (placeholder - requires admin approval)
    checkout() {
    this.checkoutCustomCake();
  }
}

// Guided Tour System (moved from original file)
class GuidedTour {
  constructor(controller) {
    this.controller = controller; // Reference to CustomCakeController instance
    this.currentStep = 0;
    this.isActive = false;
    this.steps = [
      {
        target: "#cakeViewer",
        title: "Welcome to Cake Customizer!",
        content: "This is your 3D cake preview. You can rotate and view your cake design in real-time as you make customizations.",
        position: "right",
      },
      {
        target: "#sizeOptions",
        title: "Choose Your Cake Size",
        content: "Start by selecting the perfect size for your occasion. Each size shows servings and pricing to help you decide.",
        position: "left",
      },
      {
        target: "#flavorOptions",
        title: "Select Cake Flavor",
        content: "Pick your favorite cake flavor. Choose between rich chocolate or classic white cake base.",
        position: "left",
      },
      {
        target: "#icingStyles",
        title: "Choose Icing Style",
        content: "First, select your preferred icing style - Buttercream or Whipped cream.",
        position: "left",
      },
      {
        target: "#icingColors",
        title: "Pick Icing Color",
        content: "Now choose from our wide range of colors to match your theme perfectly.",
        position: "left",
      },
      {
        target: "#fillingOptions",
        title: "Add Delicious Filling",
        content: "Enhance your cake with premium fillings. Some fillings have additional costs but add amazing flavor.",
        position: "left",
      },
      {
        target: "#bottomBorderOptions",
        title: "Bottom Border Style",
        content: "Choose your bottom border style - None, Beads, or Shells.",
        position: "left",
      },
      {
        target: "#bottomBorderColorSection .color-options-walmart",
        title: "Bottom Border Colors",
        content: "Select the perfect color for your bottom border.",
        position: "left",
      },
      {
        target: "#topBorderOptions",
        title: "Top Border Style",
        content: "Choose your top border style - None, Beads, or Shells.",
        position: "left",
      },
      {
        target: "#topBorderColorSection .color-options-walmart",
        title: "Top Border Colors",
        content: "Select the perfect color for your top border.",
        position: "left",
      },
      {
        target: "#messageOptions",
        title: "Personal Message",
        content: "Make it personal! Add a custom message to your cake. If you choose 'Add custom message', please type your message before the tour continues.",
        position: "left",
        waitForInput: true,
      },
      {
        target: "#decorationOptions",
        title: "Choose Decorations",
        content: "Add beautiful decorations to make your cake extra special - flowers, balloons, or toppings.",
        position: "left",
      },
    ];
    this.overlay = document.getElementById("tourOverlay");
    this.highlight = document.getElementById("tourHighlight");
    this.tooltip = document.getElementById("tourTooltip");
    this.tooltipHeader = document.getElementById("tourTooltipHeader");
    this.tooltipContent = document.getElementById("tourTooltipContent");
    this.stepCounter = document.getElementById("tourStepCounter");
    this.startBtn = document.getElementById("tourStartBtn");
    this.bindEvents();
  }

  bindEvents() {
    this.startBtn?.addEventListener("click", () => this.startTour());
    this.overlay?.addEventListener("click", (e) => {
      if (e.target === this.overlay) {
        this.nextStep();
      }
    });
    document.addEventListener("click", (e) => {
      if (this.isActive && !this.tooltip.contains(e.target) && e.target !== this.startBtn) {
        const currentStep = this.steps[this.currentStep];
        if (
          currentStep &&
          currentStep.target === "#messageOptions" &&
          this.controller.config.messageChoice === "custom" &&
          document.getElementById("customTextWalmart").value.trim() === ""
        ) {
          return;
        }
        this.nextStep();
      }
    });
  }

  startTour() {
    this.isActive = true;
    this.currentStep = 0;
    this.startBtn?.classList.add("hidden");
    this.overlay?.classList.add("active");
    if (document.getElementById("orderSummaryView").style.display !== "none") {
      this.controller.showFirstStep();
    }
    this.showStep();
  }

  positionHighlight(target) {
    const rect = target.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    this.highlight.style.top = rect.top + scrollTop - 8 + "px";
    this.highlight.style.left = rect.left + scrollLeft - 8 + "px";
    this.highlight.style.width = rect.width + 16 + "px";
    this.highlight.style.height = rect.height + 16 + "px";
    this.highlight.style.display = "block";
  }

  positionTooltip(target, step) {
    const rect = target.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    this.tooltip.style.display = "block";
    this.tooltip.style.visibility = "hidden";
    const tooltipRect = this.tooltip.getBoundingClientRect();
    this.tooltip.style.visibility = "visible";
    let top, left;
    let arrowClass = "";
    this.tooltip.className = "tour-tooltip";
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    switch (step.position) {
      case "right":
        top = rect.top + scrollTop + rect.height / 2 - tooltipRect.height / 2;
        left = rect.right + scrollLeft + 20;
        arrowClass = "arrow-left";
        if (left + tooltipRect.width > viewportWidth - 10) {
          left = rect.left + scrollLeft - tooltipRect.width - 20;
          arrowClass = "arrow-right";
        }
        break;
      case "left":
        top = rect.top + scrollTop + rect.height / 2 - tooltipRect.height / 2;
        left = rect.left + scrollLeft - tooltipRect.width - 20;
        arrowClass = "arrow-right";
        if (left < 10) {
          left = rect.right + scrollLeft + 20;
          arrowClass = "arrow-left";
        }
        break;
      case "bottom":
        top = rect.bottom + scrollTop + 20;
        left = rect.left + scrollLeft + rect.width / 2 - tooltipRect.width / 2;
        arrowClass = "arrow-top";
        break;
      case "top":
        top = rect.top + scrollTop - tooltipRect.height - 20;
        left = rect.left + scrollLeft + rect.width / 2 - tooltipRect.width / 2;
        arrowClass = "arrow-bottom";
        break;
    }
    if (left < 10) left = 10;
    if (left + tooltipRect.width > viewportWidth - 10) left = viewportWidth - tooltipRect.width - 10;
    if (top < 10) top = 10;
    if (top + tooltipRect.height > viewportHeight + scrollTop - 10) {
      top = viewportHeight + scrollTop - tooltipRect.height - 10;
    }
    this.tooltip.style.top = top + "px";
    this.tooltip.style.left = left + "px";
    this.tooltip.classList.add(arrowClass);
  }

  showStep() {
    const step = this.steps[this.currentStep];
    let target = document.querySelector(step.target);
    if (step.target.includes("bottomBorderColorSection") && this.controller.config.bottomBorder === "none") {
      this.nextStep();
      return;
    }
    if (step.target.includes("topBorderColorSection") && this.controller.config.topBorder === "none") {
      this.nextStep();
      return;
    }
    if (!target || (target.style && target.style.display === "none")) {
      if (step.target.includes("BorderColorSection")) {
        if (step.target.includes("bottom") && this.controller.config.bottomBorder !== "none") {
          document.querySelector('#bottomBorderOptions .border-option-walmart[data-border="beads"]').click();
          target = document.querySelector(step.target + " .color-options-walmart");
        } else if (step.target.includes("top") && this.controller.config.topBorder !== "none") {
          document.querySelector('#topBorderOptions .border-option-walmart[data-border="beads"]').click();
          target = document.querySelector(step.target + " .color-options-walmart");
        }
      }
    }
    if (!target) {
      this.nextStep();
      return;
    }
    if (step.target === "#messageOptions" && this.controller.config.messageChoice === "custom") {
      const customInput = document.getElementById("customTextWalmart");
      if (customInput && customInput.value.trim() === "") {
        const inputHandler = () => {
          if (customInput.value.trim() !== "") {
            customInput.removeEventListener("input", inputHandler);
            setTimeout(() => this.nextStep(), 1000);
          }
        };
        customInput.addEventListener("input", inputHandler);
      }
    }
    const stepMapping = {
      0: 1, // Welcome
      1: 1, // Size
      2: 2, // Flavor
      3: 3, // Icing styles
      4: 3, // Icing colors
      5: 4, // Filling
      6: 5, // Bottom border options
      7: 5, // Bottom border colors
      8: 6, // Top border options
      9: 6, // Top border colors
      10: 7, // Message
      11: 8, // Decorations
    };
    const wizardStep = stepMapping[this.currentStep];
    if (wizardStep && this.controller.currentWizardStep !== wizardStep) {
      this.controller.goToStep(wizardStep);
    }
    this.positionHighlight(target);
    this.positionTooltip(target, step);
    this.tooltipHeader.textContent = step.title;
    this.tooltipContent.textContent = step.content;
    this.stepCounter.textContent = `${this.currentStep + 1} of ${this.steps.length}`;
    this.tooltip.style.display = "block";
  }

  nextStep() {
    this.currentStep++;
    if (this.currentStep >= this.steps.length) {
      this.endTour();
    } else {
      setTimeout(() => this.showStep(), 100);
    }
  }

  endTour() {
    this.isActive = false;
    this.overlay?.classList.remove("active");
    this.highlight && (this.highlight.style.display = "none");
    this.tooltip && (this.tooltip.style.display = "none");
    this.startBtn?.classList.remove("hidden");
    this.currentStep = 0;
  }
}

// Initialize the application when DOM is ready
document.addEventListener("DOMContentLoaded", async () => {
  window.cakeController = new CustomCakeController();
  await window.cakeController.init();
});

// Expose global functions for backward compatibility
window.nextStep = () => window.cakeController?.nextStep();
window.prevStep = () => window.cakeController?.prevStep();
window.goToStep = (step) => window.cakeController?.goToStep(step);
window.showFirstStep = () => window.cakeController?.showFirstStep();
window.addToCart = () => window.cakeController?.addToCart();
window.saveDesignImage = () => window.cakeController?.saveDesignImage();
window.checkout = () => window.cakeController?.checkout();
window.submitOrder = () => window.cakeController?.submitOrder();
window.removeUploadedImage = () => window.cakeController?.removeUploadedImage();

window.checkoutCustomCake = () => window.cakeController?.checkoutCustomCake();