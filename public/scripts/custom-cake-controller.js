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

    this.renderer = null;
    this.apiService = new CakeAPIService();
    this.guidedTour = null;
  }

  async init() {
    this.renderer = new Cake3DRenderer("canvas-container");
    await this.renderer.init();
    this.guidedTour = new GuidedTour(this);
    this.setupEventListeners();
    this.setupInitialView();
    this.updateCake();
    this.initializeDownpaymentDisplay();
    this.updateOrderSummary();
  }

  calculateTotalPrice() {
    const basePrice = this.pricing.base[this.config.size] || 0;
    const fillingPrice = this.pricing.fillings[this.config.filling] || 0;
    return basePrice + fillingPrice;
  }

  // Update your existing updateTotalPrice method to include downpayment
  updateTotalPrice() {
    // Your existing price calculation logic
    const totalPrice = this.calculateTotalPrice();
    const summaryTotal = document.getElementById("summaryTotal");

    if (summaryTotal) {
      summaryTotal.innerHTML = `<strong>₱${totalPrice.toFixed(2)}</strong>`;
    }

    // NEW: Update downpayment breakdown
    this.updateDownpaymentBreakdown();
  }

  // NEW: Downpayment breakdown calculation
  updateDownpaymentBreakdown() {
    const totalPrice = this.calculateTotalPrice();
    const downpayment = totalPrice * 0.5;

    // Update breakdown display
    const breakdownTotal = document.getElementById("breakdownTotalPrice");
    const breakdownDownpayment = document.getElementById(
      "breakdownDownpayment"
    );
    const breakdownPayNow = document.getElementById("breakdownPayNow");
    const summaryDownpayment = document.getElementById("summaryDownpayment");

    if (breakdownTotal)
      breakdownTotal.textContent = `₱${totalPrice.toFixed(2)}`;
    if (breakdownDownpayment)
      breakdownDownpayment.textContent = `₱${downpayment.toFixed(2)}`;
    if (breakdownPayNow)
      breakdownPayNow.textContent = `₱${downpayment.toFixed(2)}`;
    if (summaryDownpayment)
      summaryDownpayment.textContent = `₱${downpayment.toFixed(2)}`;
  }

  // NEW: Initialize downpayment display
  initializeDownpaymentDisplay() {
    // Initial update
    this.updateDownpaymentBreakdown();

    // Update when any customization changes
    const allOptions = document.querySelectorAll(
      ".size-option-walmart, .filling-option-walmart, [data-price]"
    );
    allOptions.forEach((option) => {
      option.addEventListener("click", () => {
        setTimeout(() => this.updateDownpaymentBreakdown(), 100);
      });
    });
  }

  //Updated checkout function for downpayment
  async checkoutCustomCake() {
    // Get the button and store original state
    const checkoutButton = document.querySelector(".summary-btn.primary-btn");
    const originalText = checkoutButton.textContent;
    const originalHTML = checkoutButton.innerHTML;

    // Disable button and show loading state
    checkoutButton.disabled = true;
    checkoutButton.innerHTML = `
    <span class="loading-spinner" style="
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid #ffffff;
      border-radius: 50%;
      border-top-color: transparent;
      animation: spin 1s linear infinite;
      margin-right: 8px;
    "></span>
    Processing...
  `;
    checkoutButton.style.opacity = "0.7";

    // Add spinner animation CSS if not already present
    if (!document.querySelector("#spinner-styles")) {
      const style = document.createElement("style");
      style.id = "spinner-styles";
      style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
      document.head.appendChild(style);
    }

    try {
      if (!this.apiService.isAuthenticated()) {
        await Swal.fire({
          icon: "error",
          title: "Oops...",
          text: "Please log in to checkout your custom cake",
          confirmButtonColor: "#2c9045",
        });
        window.location.href = "/customer/login.html";
        return;
      }

      const totalPrice =
        this.pricing.base[this.config.size] +
        this.pricing.fillings[this.config.filling];

      if (!totalPrice || totalPrice <= 0) {
        Swal.fire({
          icon: "error",
          title: "Oops...",
          text: "Invalid price calculation. Please try again.",
          confirmButtonColor: "#2c9045",
        });
        return;
      }

      // Use the global CakeAPIService class directly instead of this.apiService
      const apiService = new CakeAPIService();
      const submitResponse = await apiService.submitCustomOrder(
        this.config,
        this.pricing,
        this.renderer
      );

      if (submitResponse.success) {
        const downpaymentAmount = totalPrice * 0.5;
        const customCakeId = submitResponse.data.customCakeId;
        window.location.href = `/customer/checkout.html?customCakeId=${customCakeId}&isImageOrder=false&amount=${downpaymentAmount}&isDownpayment=true`;
      } else {
        throw new Error(submitResponse.message);
      }
    } catch (error) {
      console.error("Checkout process error:", error);
      ToastNotifications.showToast(
        "Checkout failed: " + error.message,
        "error"
      );
    } finally {
      // Re-enable button regardless of success or failure
      checkoutButton.disabled = false;
      checkoutButton.innerHTML = originalHTML;
      checkoutButton.textContent = originalText;
      checkoutButton.style.opacity = "1";
    }
  }

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

  setupSizeOptions() {
    document.querySelectorAll(".size-option-walmart").forEach((el) =>
      el.addEventListener("click", () => {
        document
          .querySelectorAll(".size-option-walmart")
          .forEach((o) => o.classList.remove("active"));
        el.classList.add("active");
        this.config.size = el.dataset.size;
        this.updateCake();
        this.updateOrderSummary();
      })
    );
  }

  setupFlavorOptions() {
    document.querySelectorAll(".flavor-option-walmart").forEach((el) =>
      el.addEventListener("click", () => {
        document
          .querySelectorAll(".flavor-option-walmart")
          .forEach((o) => o.classList.remove("active"));
        el.classList.add("active");
        this.config.cakeColor = el.dataset.color;
        this.updateCake();
        this.updateOrderSummary();
      })
    );
  }

  setupIcingOptions() {
    document.querySelectorAll(".icing-style-option").forEach((el) =>
      el.addEventListener("click", () => {
        document
          .querySelectorAll(".icing-style-option")
          .forEach((o) => o.classList.remove("active"));
        el.classList.add("active");
        this.config.icingStyle = el.dataset.icing
          .toLowerCase()
          .replace(" ", "");
        this.updateOrderSummary();
      })
    );
  }

  setupColorOptions() {
    document
      .querySelectorAll(".color-options-walmart .color-option-walmart")
      .forEach((c) =>
        c.addEventListener("click", () => {
          const parent = c.closest(".color-options-walmart");
          const borderType = parent.dataset.borderType;
          if (borderType === "bottom") {
            parent
              .querySelectorAll(".color-option-walmart")
              .forEach((o) => o.classList.remove("active"));
            c.classList.add("active");
            this.config.bottomBorderColor = c.dataset.color;
            document.getElementById(
              "selectedBottomBorderColorName"
            ).textContent = c.dataset.name;
            this.updateCake();
          } else if (borderType === "top") {
            parent
              .querySelectorAll(".color-option-walmart")
              .forEach((o) => o.classList.remove("active"));
            c.classList.add("active");
            this.config.topBorderColor = c.dataset.color;
            document.getElementById("selectedTopBorderColorName").textContent =
              c.dataset.name;
            this.updateCake();
          } else {
            parent
              .querySelectorAll(".color-option-walmart")
              .forEach((o) => o.classList.remove("active"));
            c.classList.add("active");
            this.config.icingColor = c.dataset.color;
            document.getElementById("selectedColorName").textContent =
              c.dataset.name;
            this.updateCake();
          }
          this.updateOrderSummary();
        })
      );

    document.querySelectorAll(".toppings-color-option").forEach((c) =>
      c.addEventListener("click", () => {
        document
          .querySelectorAll(".toppings-color-option")
          .forEach((o) => o.classList.remove("active"));
        c.classList.add("active");
        this.config.toppingsColor = c.dataset.color;
        document.getElementById("selectedToppingsColorName").textContent =
          c.dataset.name;
        this.updateCake();
        this.updateOrderSummary();
      })
    );
  }

  setupFillingOptions() {
    document.querySelectorAll(".filling-option-walmart").forEach((el) =>
      el.addEventListener("click", () => {
        document
          .querySelectorAll(".filling-option-walmart")
          .forEach((o) => o.classList.remove("active"));
        el.classList.add("active");
        this.config.filling = el.dataset.filling;
        this.updateCake();
        this.updateOrderSummary();
      })
    );
  }

  setupBorderOptions() {
    document.querySelectorAll("#step-5 .border-option-walmart").forEach((el) =>
      el.addEventListener("click", () => {
        document
          .querySelectorAll("#step-5 .border-option-walmart")
          .forEach((o) => o.classList.remove("active"));
        el.classList.add("active");
        this.config.bottomBorder = el.dataset.border;
        const colorSection = document.getElementById(
          "bottomBorderColorSection"
        );
        colorSection.style.display =
          this.config.bottomBorder !== "none" ? "block" : "none";
        this.updateCake();
        this.updateOrderSummary();
      })
    );

    document.querySelectorAll("#step-6 .border-option-walmart").forEach((el) =>
      el.addEventListener("click", () => {
        document
          .querySelectorAll("#step-6 .border-option-walmart")
          .forEach((o) => o.classList.remove("active"));
        el.classList.add("active");
        this.config.topBorder = el.dataset.border;
        const colorSection = document.getElementById("topBorderColorSection");
        colorSection.style.display =
          this.config.topBorder !== "none" ? "block" : "none";
        this.updateCake();
        this.updateOrderSummary();
      })
    );
  }

  setupMessageOptions() {
    document.querySelectorAll(".message-option-walmart").forEach((option) =>
      option.addEventListener("click", () => {
        document
          .querySelectorAll(".message-option-walmart")
          .forEach((o) => o.classList.remove("active"));
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

  setupDecorationOptions() {
    document.querySelectorAll(".decoration-option-walmart").forEach((el) =>
      el.addEventListener("click", () => {
        document
          .querySelectorAll(".decoration-option-walmart")
          .forEach((o) => o.classList.remove("active"));
        el.classList.add("active");
        this.config.decorations = el.dataset.decoration;
        const flowerSubOptions = document.getElementById("flowerSubOptions");
        const toppingsColorSection = document.getElementById(
          "toppingsColorSection"
        );
        if (this.config.decorations === "flowers") {
          flowerSubOptions.style.display = "flex";
          toppingsColorSection.style.display = "none";
          if (!document.querySelector(".flower-option-walmart.active")) {
            document
              .querySelector(
                '.flower-option-walmart[data-flower-type="daisies"]'
              )
              .classList.add("active");
            this.config.flowerType = "daisies";
          }
        } else if (this.config.decorations === "toppings") {
          flowerSubOptions.style.display = "none";
          toppingsColorSection.style.display = "block";
        } else {
          flowerSubOptions.style.display = "none";
          toppingsColorSection.style.display = "none";
          document
            .querySelectorAll(".flower-option-walmart")
            .forEach((o) => o.classList.remove("active"));
          this.config.flowerType = "none";
        }
        this.updateCake();
        this.updateOrderSummary();
      })
    );

    document.querySelectorAll(".flower-option-walmart").forEach((el) =>
      el.addEventListener("click", () => {
        document
          .querySelectorAll(".flower-option-walmart")
          .forEach((o) => o.classList.remove("active"));
        el.classList.add("active");
        this.config.flowerType = el.dataset.flowerType;
        this.updateCake();
        this.updateOrderSummary();
      })
    );
  }

  setupCustomTextInput() {
    document
      .getElementById("customTextWalmart")
      .addEventListener("input", (e) => {
        document.getElementById("charCountWalmart").textContent =
          e.target.value.length;
        this.config.customText = e.target.value;
        this.updateOrderSummary();
      });
  }

  setupImageUpload() {
    const uploadArea = document.getElementById("uploadArea");
    const imageUpload = document.getElementById("imageUpload");
    const uploadedImageDiv = document.getElementById("uploadedImage");
    const previewImage = document.getElementById("previewImage");

    uploadArea.addEventListener("click", () => imageUpload.click());

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

  handleImageUpload(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      document.getElementById("previewImage").src = e.target.result;
      document.getElementById("uploadedImage").style.display = "block";
      document.getElementById("uploadArea").style.display = "none";
      document.getElementById("imageOrderForm").style.display = "block";
      document.getElementById("uploadedFileName").textContent = file.name;

      // Re-setup the form when it becomes visible to ensure fresh event listeners
      setTimeout(() => this.setupImageOrderForm(), 100);
    };
    reader.readAsDataURL(file);
  }

  setupImageOrderForm() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById("eventDate").min = tomorrow
      .toISOString()
      .split("T")[0];

    document.getElementById("imageNotes").addEventListener("input", (e) => {
      document.getElementById("notesCharCount").textContent =
        e.target.value.length;
    });

    document.getElementById("imageMessage").addEventListener("input", (e) => {
      document.getElementById("messageCharCount").textContent =
        e.target.value.length;
    });

    // Get the form and submit button
    const form = document.getElementById("imageOrderFormContent");
    const submitButton = form.querySelector('button[type="submit"]');

    // Remove any existing event listeners by cloning the form
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);

    // Add single event listener to the new form
    newForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Prevent multiple submissions
      const currentSubmitButton = newForm.querySelector(
        'button[type="submit"]'
      );
      const originalText = currentSubmitButton.textContent;

      // Disable button and show loading state
      currentSubmitButton.disabled = true;
      currentSubmitButton.textContent = "Submitting...";
      currentSubmitButton.style.opacity = "0.7";

      try {
        const result = await this.apiService.submitImageBasedOrder(newForm);

        if (result.success) {
          this.apiService.handleResponse(result, () => {
            this.resetImageOrderForm();
            // Reset button state after successful submission
            currentSubmitButton.disabled = false;
            currentSubmitButton.textContent = originalText;
            currentSubmitButton.style.opacity = "1";
          });
        } else {
          throw new Error(result.message || "Submission failed");
        }
      } catch (error) {
        console.error("Form submission error:", error);
        // Re-enable button on error
        currentSubmitButton.disabled = false;
        currentSubmitButton.textContent = originalText;
        currentSubmitButton.style.opacity = "1";

        ToastNotifications.showToast(
          error.message || "Error submitting order. Please try again.",
          "error"
        );
      }
    });
  }

  resetImageOrderForm() {
    const form = document.getElementById("imageOrderFormContent");
    if (form) {
      form.reset();
    }

    // Reset character counters
    const messageCharCount = document.getElementById("messageCharCount");
    const notesCharCount = document.getElementById("notesCharCount");
    if (messageCharCount) messageCharCount.textContent = "0";
    if (notesCharCount) notesCharCount.textContent = "0";

    // Reset UI elements
    document.getElementById("imageOrderForm").style.display = "none";
    document.getElementById("uploadedImage").style.display = "none";
    document.getElementById("uploadArea").style.display = "block";
    document.getElementById("imageUpload").value = "";

    // Reset the submit button state if it exists
    const submitButton = document.querySelector(
      '#imageOrderFormContent button[type="submit"]'
    );
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Submit Image Order";
      submitButton.style.opacity = "1";
    }
  }

  removeUploadedImage() {
    document.getElementById("imageUpload").value = "";
    document.getElementById("uploadedImage").style.display = "none";
    document.getElementById("imageOrderForm").style.display = "none";
    document.getElementById("uploadArea").style.display = "block";

    // Reset the form and character counters
    const form = document.getElementById("imageOrderFormContent");
    if (form) {
      form.reset();
    }
    const messageCharCount = document.getElementById("messageCharCount");
    const notesCharCount = document.getElementById("notesCharCount");
    if (messageCharCount) messageCharCount.textContent = "0";
    if (notesCharCount) notesCharCount.textContent = "0";
  }

  setupInitialView() {
    document.getElementById("orderSummaryView").style.display = "none";
    document.querySelector(".step-content").style.display = "block";
    document.querySelector(".step-navigation").style.display = "flex";
    this.showStep(1);
  }

  updateCake() {
    if (this.renderer) {
      this.renderer.updateCake(this.config);
    }
  }

  updateOrderSummary() {
    const sizeLabels = {
      small: '6" Round',
      medium: '8" Round',
      large: '10" Round',
    };

    document.getElementById("summarySize").textContent =
      sizeLabels[this.config.size];
    document.getElementById(
      "summarySizePrice"
    ).innerHTML = `<strong>₱${this.pricing.base[this.config.size].toFixed(
      2
    )}</strong>`;
    document.getElementById("summaryFlavor").textContent =
      this.config.cakeColor === "#8B4513" ? "Chocolate" : "White";

    const icingStyle =
      this.config.icingStyle === "buttercream" ? "Buttercream" : "Whipped";
    const icingColorName =
      document.getElementById("selectedColorName").textContent;
    document.getElementById(
      "summaryIcing"
    ).textContent = `${icingStyle} - ${icingColorName}`;

    const fillingNames = {
      none: "None",
      strawberry: "Strawberry",
      bavarian: "Cream",
    };
    document.getElementById("summaryFilling").textContent =
      fillingNames[this.config.filling];

    const fillingPriceElement = document.getElementById("summaryFillingPrice");
    fillingPriceElement.style.display =
      this.config.filling !== "none" ? "block" : "none";
    if (this.config.filling !== "none") {
      fillingPriceElement.innerHTML = `<strong>+₱${this.pricing.fillings[
        this.config.filling
      ].toFixed(2)}</strong>`;
    }

    this.updateBorderSummary();
    this.updateMessageSummary();
    this.updateDecorationsSummary();

    const total =
      this.pricing.base[this.config.size] +
      this.pricing.fillings[this.config.filling];
    document.getElementById(
      "summaryTotal"
    ).innerHTML = `<strong>₱${total.toFixed(2)}</strong>`;
  }

  updateBorderSummary() {
    const bottomBorderItem = document.getElementById("summaryBottomBorderItem");
    bottomBorderItem.style.display =
      this.config.bottomBorder !== "none" ? "flex" : "none";
    if (this.config.bottomBorder !== "none") {
      const borderName =
        this.config.bottomBorder.charAt(0).toUpperCase() +
        this.config.bottomBorder.slice(1);
      const borderColorName = document.getElementById(
        "selectedBottomBorderColorName"
      ).textContent;
      document.getElementById(
        "summaryBottomBorder"
      ).textContent = `${borderName} - ${borderColorName}`;
    }

    const topBorderItem = document.getElementById("summaryTopBorderItem");
    topBorderItem.style.display =
      this.config.topBorder !== "none" ? "flex" : "none";
    if (this.config.topBorder !== "none") {
      const borderName =
        this.config.topBorder.charAt(0).toUpperCase() +
        this.config.topBorder.slice(1);
      const borderColorName = document.getElementById(
        "selectedTopBorderColorName"
      ).textContent;
      document.getElementById(
        "summaryTopBorder"
      ).textContent = `${borderName} - ${borderColorName}`;
    }
  }

  updateMessageSummary() {
    const messageItem = document.getElementById("summaryMessageItem");
    messageItem.style.display =
      this.config.customText && this.config.messageChoice === "custom"
        ? "flex"
        : "none";
    if (this.config.customText && this.config.messageChoice === "custom") {
      document.getElementById(
        "summaryMessage"
      ).textContent = `"${this.config.customText}"`;
    }
  }

  updateDecorationsSummary() {
    const decorationsItem = document.getElementById("summaryDecorationsItem");
    decorationsItem.style.display =
      this.config.decorations !== "none" ? "flex" : "none";
    if (this.config.decorations !== "none") {
      let decorationText = "";
      if (this.config.decorations === "flowers") {
        const flowerNames = {
          daisies: "Daisies",
          buttonRoses: "Button Roses",
        };
        decorationText = `Flowers (${
          flowerNames[this.config.flowerType] || "None"
        })`;
      } else if (this.config.decorations === "toppings") {
        const toppingsColorName = document.getElementById(
          "selectedToppingsColorName"
        ).textContent;
        decorationText = `Toppings (${toppingsColorName})`;
      } else {
        const decorationNames = { balloons: "Balloons" };
        decorationText = decorationNames[this.config.decorations];
      }
      document.getElementById("summaryDecorations").textContent =
        decorationText;
    }
  }

  goToStep(stepNumber) {
    this.currentWizardStep = stepNumber;
    this.showStep(stepNumber);
    document.getElementById("orderSummaryView").style.display = "none";
    document.querySelector(".step-content").style.display = "block";
    document.querySelector(".step-navigation").style.display = "flex";
  }

  showStep(stepNumber) {
    document
      .querySelectorAll(".step-section")
      .forEach((section) => section.classList.remove("active"));
    document.getElementById(`step-${stepNumber}`).classList.add("active");

    const flowerSubOptions = document.getElementById("flowerSubOptions");
    flowerSubOptions.style.display =
      stepNumber === 8 && this.config.decorations === "flowers"
        ? "flex"
        : "none";

    const toppingsColorSection = document.getElementById(
      "toppingsColorSection"
    );
    toppingsColorSection.style.display =
      stepNumber === 8 && this.config.decorations === "toppings"
        ? "block"
        : "none";

    this.updateNavigationButtons(stepNumber);
  }

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

  nextStep() {
    if (this.currentWizardStep < this.totalWizardSteps) {
      this.currentWizardStep++;
      this.showStep(this.currentWizardStep);
    } else {
      this.showOrderSummary();
    }
  }

  prevStep() {
    if (this.currentWizardStep > 1) {
      this.currentWizardStep--;
      this.showStep(this.currentWizardStep);
    }
  }

  showOrderSummary() {
    document.getElementById("orderSummaryView").style.display = "block";
    document.querySelector(".step-content").style.display = "none";
    document.querySelector(".step-navigation").style.display = "none";
    this.updateOrderSummary();
  }

  showFirstStep() {
    document.getElementById("orderSummaryView").style.display = "none";
    document.querySelector(".step-content").style.display = "block";
    document.querySelector(".step-navigation").style.display = "flex";
    this.goToStep(1);
  }

  async submitOrder() {
    if (document.getElementById("imageUpload").files.length > 0) {
      Swal.fire({
        title: "Image based order detected",
        text: "Please use the 'Submit Image Order' button for image-based orders.",
        confirmButtonColor: "#2c9045",
      });
      return;
    }

    const result = await this.apiService.submitCustomOrder(
      this.config,
      this.pricing,
      this.renderer
    );
    this.apiService.handleResponse(result, () => this.resetForm());
  }

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

  saveDesignImage() {
    if (this.renderer) {
      this.renderer.saveDesignImage();
    }
  }

  addToCart() {
    Swal.fire({
      title: "Image based order detected",
      text: "Please submit your custom cake order for admin review. Once approved, you can add it to your cart from the 'My Custom Orders' page.",
      confirmButtonColor: "#2c9045",
    });
  }

  checkout() {
    this.checkoutCustomCake();
  }
}

class GuidedTour {
  constructor(controller) {
    this.controller = controller;
    this.currentStep = 0;
    this.isActive = false;
    this.steps = [
      {
        target: "#cakeViewer",
        title: "Welcome to Cake Customizer!",
        content:
          "This is your 3D cake preview. You can rotate and view your cake design in real-time as you make customizations.",
        position: "right",
      },
      {
        target: "#sizeOptions",
        title: "Choose Your Cake Size",
        content:
          "Start by selecting the perfect size for your occasion. Each size shows servings and pricing to help you decide.",
        position: "left",
      },
      {
        target: "#flavorOptions",
        title: "Select Cake Flavor",
        content:
          "Pick your favorite cake flavor. Choose between rich chocolate or classic white cake base.",
        position: "left",
      },
      {
        target: "#icingStyles",
        title: "Choose Icing Style",
        content:
          "First, select your preferred icing style - Buttercream or Whipped cream.",
        position: "left",
      },
      {
        target: "#icingColors",
        title: "Pick Icing Color",
        content:
          "Now choose from our wide range of colors to match your theme perfectly.",
        position: "left",
      },
      {
        target: "#fillingOptions",
        title: "Add Delicious Filling",
        content:
          "Enhance your cake with premium fillings. Some fillings have additional costs but add amazing flavor.",
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
        content:
          "Make it personal! Add a custom message to your cake. If you choose 'Add custom message', please type your message before the tour continues.",
        position: "left",
        waitForInput: true,
      },
      {
        target: "#decorationOptions",
        title: "Choose Decorations",
        content:
          "Add beautiful decorations to make your cake extra special - flowers, balloons, or toppings.",
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
      if (
        this.isActive &&
        !this.tooltip.contains(e.target) &&
        e.target !== this.startBtn
      ) {
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
    const scrollLeft =
      window.pageXOffset || document.documentElement.scrollLeft;
    this.highlight.style.top = rect.top + scrollTop - 8 + "px";
    this.highlight.style.left = rect.left + scrollLeft - 8 + "px";
    this.highlight.style.width = rect.width + 16 + "px";
    this.highlight.style.height = rect.height + 16 + "px";
    this.highlight.style.display = "block";
  }

  positionTooltip(target, step) {
    const rect = target.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft =
      window.pageXOffset || document.documentElement.scrollLeft;
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
    if (left + tooltipRect.width > viewportWidth - 10)
      left = viewportWidth - tooltipRect.width - 10;
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
    if (
      step.target.includes("bottomBorderColorSection") &&
      this.controller.config.bottomBorder === "none"
    ) {
      this.nextStep();
      return;
    }
    if (
      step.target.includes("topBorderColorSection") &&
      this.controller.config.topBorder === "none"
    ) {
      this.nextStep();
      return;
    }
    if (!target || (target.style && target.style.display === "none")) {
      if (step.target.includes("BorderColorSection")) {
        if (
          step.target.includes("bottom") &&
          this.controller.config.bottomBorder !== "none"
        ) {
          document
            .querySelector(
              '#bottomBorderOptions .border-option-walmart[data-border="beads"]'
            )
            .click();
          target = document.querySelector(
            step.target + " .color-options-walmart"
          );
        } else if (
          step.target.includes("top") &&
          this.controller.config.topBorder !== "none"
        ) {
          document
            .querySelector(
              '#topBorderOptions .border-option-walmart[data-border="beads"]'
            )
            .click();
          target = document.querySelector(
            step.target + " .color-options-walmart"
          );
        }
      }
    }
    if (!target) {
      this.nextStep();
      return;
    }
    if (
      step.target === "#messageOptions" &&
      this.controller.config.messageChoice === "custom"
    ) {
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
      0: 1,
      1: 1,
      2: 2,
      3: 3,
      4: 3,
      5: 4,
      6: 5,
      7: 5,
      8: 6,
      9: 6,
      10: 7,
      11: 8,
    };
    const wizardStep = stepMapping[this.currentStep];
    if (wizardStep && this.controller.currentWizardStep !== wizardStep) {
      this.controller.goToStep(wizardStep);
    }
    this.positionHighlight(target);
    this.positionTooltip(target, step);
    this.tooltipHeader.textContent = step.title;
    this.tooltipContent.textContent = step.content;
    this.stepCounter.textContent = `${this.currentStep + 1} of ${
      this.steps.length
    }`;
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

document.addEventListener("DOMContentLoaded", async () => {
  window.cakeController = new CustomCakeController();
  await window.cakeController.init();
});

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
