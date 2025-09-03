// Configuration object for cake customization
const config = {
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

// Colors for cake filling
const fillingColors = {
  strawberry: "#B70824",
  bavarian: "#F1E7C3",
  none: "#FFFFFF",
};

// Pricing structure for cake sizes and fillings
const pricing = {
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

// Wizard step tracking
let currentWizardStep = 1;
const totalWizardSteps = 8;
const stepNames = [
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

// Three.js global variables
let scene, camera, renderer, cake;
const container = document.getElementById("canvas-container");

// Guided Tour System for user onboarding
class GuidedTour {
  constructor() {
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

  // Bind event listeners for tour interactions
  bindEvents() {
    this.startBtn.addEventListener("click", () => this.startTour());
    this.overlay.addEventListener("click", (e) => {
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
          config.messageChoice === "custom" &&
          document.getElementById("customTextWalmart").value.trim() === ""
        ) {
          return;
        }
        this.nextStep();
      }
    });
  }

  // Start the guided tour
  startTour() {
    this.isActive = true;
    this.currentStep = 0;
    this.startBtn.classList.add("hidden");
    this.overlay.classList.add("active");
    if (document.getElementById("orderSummaryView").style.display !== "none") {
      showFirstStep();
    }
    this.showStep();
  }

  // Position the highlight box around the target element
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

  // Position the tooltip relative to the target element
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

  // Show the current tour step
  showStep() {
    const step = this.steps[this.currentStep];
    let target = document.querySelector(step.target);
    if (step.target.includes("bottomBorderColorSection") && config.bottomBorder === "none") {
      this.nextStep();
      return;
    }
    if (step.target.includes("topBorderColorSection") && config.topBorder === "none") {
      this.nextStep();
      return;
    }
    if (!target || (target.style && target.style.display === "none")) {
      if (step.target.includes("BorderColorSection")) {
        if (step.target.includes("bottom") && config.bottomBorder !== "none") {
          document.querySelector('#bottomBorderOptions .border-option-walmart[data-border="beads"]').click();
          target = document.querySelector(step.target + " .color-options-walmart");
        } else if (step.target.includes("top") && config.topBorder !== "none") {
          document.querySelector('#topBorderOptions .border-option-walmart[data-border="beads"]').click();
          target = document.querySelector(step.target + " .color-options-walmart");
        }
      }
    }
    if (!target) {
      this.nextStep();
      return;
    }
    if (step.target === "#messageOptions" && config.messageChoice === "custom") {
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
    if (wizardStep && currentWizardStep !== wizardStep) {
      goToStep(wizardStep);
    }
    this.positionHighlight(target);
    this.positionTooltip(target, step);
    this.tooltipHeader.textContent = step.title;
    this.tooltipContent.textContent = step.content;
    this.stepCounter.textContent = `${this.currentStep + 1} of ${this.steps.length}`;
    this.tooltip.style.display = "block";
  }

  // Move to the next tour step
  nextStep() {
    this.currentStep++;
    if (this.currentStep >= this.steps.length) {
      this.endTour();
    } else {
      setTimeout(() => this.showStep(), 100);
    }
  }

  // End the guided tour
  endTour() {
    this.isActive = false;
    this.overlay.classList.remove("active");
    this.highlight.style.display = "none";
    this.tooltip.style.display = "none";
    this.startBtn.classList.remove("hidden");
    this.currentStep = 0;
  }
}

// Initialize guided tour
let guidedTour;

// Show the order summary view
function showOrderSummary() {
  document.getElementById("orderSummaryView").style.display = "block";
  document.querySelector(".step-content").style.display = "none";
  document.querySelector(".step-navigation").style.display = "none";
  updateOrderSummary();
}

// Show the first wizard step
function showFirstStep() {
  document.getElementById("orderSummaryView").style.display = "none";
  document.querySelector(".step-content").style.display = "block";
  document.querySelector(".step-navigation").style.display = "flex";
  goToStep(1);
}

// Navigate to a specific wizard step
function goToStep(stepNumber) {
  currentWizardStep = stepNumber;
  showStep(stepNumber);
  document.getElementById("orderSummaryView").style.display = "none";
  document.querySelector(".step-content").style.display = "block";
  document.querySelector(".step-navigation").style.display = "flex";
}

// Show the specified wizard step
function showStep(stepNumber) {
  document.querySelectorAll(".step-section").forEach((section) => {
    section.classList.remove("active");
  });
  document.getElementById(`step-${stepNumber}`).classList.add("active");
  const flowerSubOptions = document.getElementById("flowerSubOptions");
  if (stepNumber === 8 && config.decorations === "flowers") {
    flowerSubOptions.style.display = "flex";
  } else {
    flowerSubOptions.style.display = "none";
  }
  const toppingsColorSection = document.getElementById("toppingsColorSection");
  if (stepNumber === 8 && config.decorations === "toppings") {
    toppingsColorSection.style.display = "block";
  } else {
    toppingsColorSection.style.display = "none";
  }
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const nextStepName = document.getElementById("nextStepName");
  prevBtn.style.display = stepNumber === 1 ? "none" : "block";
  if (stepNumber === totalWizardSteps) {
    nextBtn.textContent = "Done";
    nextBtn.className = "nav-btn";
    nextBtn.onclick = showOrderSummary;
    nextStepName.textContent = "";
  } else {
    nextBtn.innerHTML = "→";
    nextBtn.className = "nav-btn";
    nextBtn.onclick = nextStep;
    nextStepName.textContent = stepNames[stepNumber + 1];
  }
}

// Move to the next wizard step
function nextStep() {
  if (currentWizardStep < totalWizardSteps) {
    currentWizardStep++;
    showStep(currentWizardStep);
  } else {
    showOrderSummary();
  }
}

// Move to the previous wizard step
function prevStep() {
  if (currentWizardStep > 1) {
    currentWizardStep--;
    showStep(currentWizardStep);
  }
}

// Update the order summary display
function updateOrderSummary() {
  const sizeLabels = {
    small: '6" Round',
    medium: '8" Round',
    large: '10" Round',
  };
  document.getElementById("summarySize").textContent = sizeLabels[config.size];
  document.getElementById("summarySizePrice").innerHTML = `<strong>₱${pricing.base[config.size].toFixed(2)}</strong>`;
  document.getElementById("summaryFlavor").textContent = config.cakeColor === "#8B4513" ? "Chocolate" : "White";
  const icingStyle = config.icingStyle === "buttercream" ? "Buttercream" : "Whipped";
  const icingColorName = document.getElementById("selectedColorName").textContent;
  document.getElementById("summaryIcing").textContent = `${icingStyle} - ${icingColorName}`;
  const fillingNames = {
    none: "None",
    strawberry: "Strawberry",
    bavarian: "Bavarian Creme",
  };
  document.getElementById("summaryFilling").textContent = fillingNames[config.filling];
  const fillingPriceElement = document.getElementById("summaryFillingPrice");
  if (config.filling !== "none") {
    fillingPriceElement.innerHTML = `<strong>+₱${pricing.fillings[config.filling].toFixed(2)}</strong>`;
    fillingPriceElement.style.display = "block";
  } else {
    fillingPriceElement.style.display = "none";
  }
  const bottomBorderItem = document.getElementById("summaryBottomBorderItem");
  if (config.bottomBorder !== "none") {
    bottomBorderItem.style.display = "flex";
    const borderName = config.bottomBorder.charAt(0).toUpperCase() + config.bottomBorder.slice(1);
    const borderColorName = document.getElementById("selectedBottomBorderColorName").textContent;
    document.getElementById("summaryBottomBorder").textContent = `${borderName} - ${borderColorName}`;
  } else {
    bottomBorderItem.style.display = "none";
  }
  const topBorderItem = document.getElementById("summaryTopBorderItem");
  if (config.topBorder !== "none") {
    topBorderItem.style.display = "flex";
    const borderName = config.topBorder.charAt(0).toUpperCase() + config.topBorder.slice(1);
    const borderColorName = document.getElementById("selectedTopBorderColorName").textContent;
    document.getElementById("summaryTopBorder").textContent = `${borderName} - ${borderColorName}`;
  } else {
    topBorderItem.style.display = "none";
  }
  const messageItem = document.getElementById("summaryMessageItem");
  if (config.customText && config.messageChoice === "custom") {
    messageItem.style.display = "flex";
    document.getElementById("summaryMessage").textContent = `"${config.customText}"`;
  } else {
    messageItem.style.display = "none";
  }
  const decorationsItem = document.getElementById("summaryDecorationsItem");
  if (config.decorations !== "none") {
    decorationsItem.style.display = "flex";
    let decorationText = "";
    if (config.decorations === "flowers") {
      const flowerNames = {
        daisies: "Daisies",
        buttonRoses: "Button Roses",
      };
      decorationText = `Flowers (${flowerNames[config.flowerType] || "None"})`;
    } else if (config.decorations === "toppings") {
      const toppingsColorName = document.getElementById("selectedToppingsColorName").textContent;
      decorationText = `Toppings (${toppingsColorName})`;
    } else {
      const decorationNames = {
        balloons: "Balloons",
      };
      decorationText = decorationNames[config.decorations];
    }
    document.getElementById("summaryDecorations").textContent = decorationText;
  } else {
    decorationsItem.style.display = "none";
  }
  const total = pricing.base[config.size] + pricing.fillings[config.filling];
  document.getElementById("summaryTotal").innerHTML = `<strong>₱${total.toFixed(2)}</strong>`;
}

// Save the 3D cake design as an image
function saveDesignImage() {
  if (!renderer || !scene || !camera) {
    alert("3D model not ready. Please wait a moment and try again.");
    return;
  }
  try {
    renderer.render(scene, camera);
    const canvas = renderer.domElement;
    const dataURL = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `cake-design-${Date.now()}.png`;
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    alert("Design image saved successfully!");
  } catch (error) {
    console.error("Error saving design:", error);
    alert("Sorry, there was an error saving your design. Please try again.");
  }
}

// Submit the custom cake order to the backend
async function submitOrder() {
  const imageUpload = document.getElementById("imageUpload");
  const formData = new FormData();

  const token = localStorage.getItem('token');

   if (!token) {
    alert('Please log in to submit a custom cake order');
    window.location.href = '/public/customer/login.html';
    return;
  }

  // Capture 3D design as image
  let designImageDataUrl = null;
  try {
    renderer.render(scene, camera);
    const canvas = renderer.domElement;
    designImageDataUrl = canvas.toDataURL("image/png");
    
    // Convert data URL to blob for file upload
    const response = await fetch(designImageDataUrl);
    const blob = await response.blob();
    formData.append("designImage", blob, "cake-design.png");
  } catch (error) {
    console.error("Error capturing 3D design:", error);
    // Continue without design image if capture fails
    alert("Could not capture 3D design image, but order will still be submitted");
  }

  formData.append("size", config.size);
  formData.append("cakeColor", config.cakeColor);
  formData.append("icingStyle", config.icingStyle);
  formData.append("icingColor", config.icingColor);
  formData.append("filling", config.filling);
  formData.append("bottomBorder", config.bottomBorder);
  formData.append("topBorder", config.topBorder);
  formData.append("bottomBorderColor", config.bottomBorderColor);
  formData.append("topBorderColor", config.topBorderColor);
  formData.append("decorations", config.decorations);
  formData.append("flowerType", config.flowerType);
  formData.append("customText", config.customText);
  formData.append("messageChoice", config.messageChoice);
  formData.append("toppingsColor", config.toppingsColor);
  formData.append("price", pricing.base[config.size] + pricing.fillings[config.filling]);

  if (imageUpload.files[0]) {
    formData.append("referenceImage", imageUpload.files[0]);
  }

  try {
    // Send token as query parameter for FormData requests
    const response = await fetch(`/api/custom-cake/create?token=${encodeURIComponent(token)}`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const result = await response.json();
    alert("Custom cake order submitted successfully! Awaiting admin review.");
    // Reset the form
    config.size = "small";
    config.cakeColor = "#8B4513";
    config.icingStyle = "buttercream";
    config.icingColor = "#FFFFFF";
    config.filling = "none";
    config.bottomBorder = "none";
    config.topBorder = "none";
    config.bottomBorderColor = "#FFFFFF";
    config.topBorderColor = "#FFFFFF";
    config.decorations = "none";
    config.flowerType = "none";
    config.customText = "";
    config.messageChoice = "none";
    config.toppingsColor = "#FFFFFF";
    document.getElementById("imageUpload").value = "";
    document.getElementById("uploadedImage").style.display = "none";
    document.getElementById("uploadArea").style.display = "block";
    updateCake();
    updateOrderSummary();
    showFirstStep();
  } catch (error) {
    console.error("Error submitting order:", error);
    alert("Sorry, there was an error submitting your order. Please try again.");
  }
}

// Add the custom cake to the cart (after admin approval)
async function addToCart() {
  alert("Please submit your custom cake order for admin review. Once approved, you can add it to your cart from the 'My Custom Orders' page.");
}

// Redirect to checkout page
function checkout() {
  alert("Please submit your custom cake order for admin review. Once approved, you can add it to your cart and proceed to checkout from the 'My Custom Orders' page.");
}

// Update the 3D cake model based on configuration
function updateCake() {
  if (!cake) return;
  if (config.bottomBorder === "beads" && cake.bottomBeadsMesh) {
    cake.bottomBeadsMesh.visible = true;
    cake.bottomBeadsMesh.traverse((child) => {
      if (child.isMesh && child.material) {
        const hexColor = Number.parseInt(config.bottomBorderColor.replace("#", "0x"));
        child.material.color.setHex(hexColor);
      }
    });
  } else if (cake.bottomBeadsMesh) {
    cake.bottomBeadsMesh.visible = false;
  }
  if (config.bottomBorder === "shells" && cake.bottomShellsMesh) {
    cake.bottomShellsMesh.visible = true;
    cake.bottomShellsMesh.traverse((child) => {
      if (child.isMesh && child.material) {
        const hexColor = Number.parseInt(config.bottomBorderColor.replace("#", "0x"));
        child.material.color.setHex(hexColor);
      }
    });
  } else if (cake.bottomShellsMesh) {
    cake.bottomShellsMesh.visible = false;
  }
  if (config.topBorder === "beads" && cake.topBeadsMesh) {
    cake.topBeadsMesh.visible = true;
    cake.topBeadsMesh.traverse((child) => {
      if (child.isMesh && child.material) {
        const hexColor = Number.parseInt(config.topBorderColor.replace("#", "0x"));
        child.material.color.setHex(hexColor);
      }
    });
  } else if (cake.topBeadsMesh) {
    cake.topBeadsMesh.visible = false;
  }
  if (config.topBorder === "shells" && cake.topShellsMesh) {
    cake.topShellsMesh.visible = true;
    cake.topShellsMesh.traverse((child) => {
      if (child.isMesh && child.material) {
        const hexColor = Number.parseInt(config.topBorderColor.replace("#", "0x"));
        child.material.color.setHex(hexColor);
      }
    });
  } else if (cake.topShellsMesh) {
    cake.topShellsMesh.visible = false;
  }
  const hexCake = Number.parseInt(config.cakeColor.replace("#", "0x"));
  if (cake.bottomSpongeMesh) cake.bottomSpongeMesh.material.color.setHex(hexCake);
  if (cake.topSpongeMesh) cake.topSpongeMesh.material.color.setHex(hexCake);
  const hexIce = Number.parseInt(config.icingColor.replace("#", "0x"));
  if (cake.mainCakeMesh) cake.mainCakeMesh.material.color.setHex(hexIce);
  const fillColor = fillingColors[config.filling] || "#FFFFFF";
  const hexFills = Number.parseInt(fillColor.replace("#", "0x"));
  if (cake.fillingMesh) cake.fillingMesh.material.color.setHex(hexFills);
  if (cake.balloonsMesh) cake.balloonsMesh.visible = false;
  if (cake.toppingsMesh) cake.toppingsMesh.visible = false;
  if (cake.daisiesMesh) cake.daisiesMesh.visible = false;
  if (cake.buttonRosesMesh) cake.buttonRosesMesh.visible = false;
  if (config.decorations === "balloons" && cake.balloonsMesh) {
    cake.balloonsMesh.visible = true;
  } else if (config.decorations === "toppings" && cake.toppingsMesh) {
    cake.toppingsMesh.visible = true;
    cake.toppingsMesh.traverse((child) => {
      if (child.isMesh && child.material) {
        const hexColor = Number.parseInt(config.toppingsColor.replace("#", "0x"));
        child.material.color.setHex(hexColor);
      }
    });
  } else if (config.decorations === "flowers") {
    if (config.flowerType === "daisies" && cake.daisiesMesh) {
      cake.daisiesMesh.visible = true;
    } else if (config.flowerType === "buttonRoses" && cake.buttonRosesMesh) {
      cake.buttonRosesMesh.visible = true;
    }
  }
}

// Initialize Three.js scene and load models
function init() {
  const THREE = window.THREE;
  scene = new THREE.Scene();
  scene.background = new THREE.Color("#f5f1e9");
  THREE.RectAreaLightUniformsLib.init();
  camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
  camera.position.set(0, 0.2, 1.0);
  camera.lookAt(0, 0, 0);
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);
  window.addEventListener("resize", () => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  });
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
  scene.add(ambientLight);
  const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.7);
  scene.add(hemisphereLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(1.5, 2, 1);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 1024;
  dirLight.shadow.mapSize.height = 1024;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 500;
  dirLight.shadow.camera.left = -1;
  dirLight.shadow.camera.right = 1;
  dirLight.shadow.camera.top = 1;
  dirLight.shadow.camera.bottom = -1;
  scene.add(dirLight);
  createCake();
  addMouseControls();
  animate();
  setTimeout(() => {
    document.getElementById("loadingScreen").classList.add("hidden");
  }, 800);
}

// Load and configure the 3D cake model
const dracoLoader = new window.THREE.DRACOLoader()
dracoLoader.setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/draco/")

const loader = new window.THREE.GLTFLoader()
loader.setDRACOLoader(dracoLoader)

function createCake() {
  if (cake) scene.remove(cake)

  loader.load(
    "/models/compressed_mainCake.glb",
    (gltf) => {
      cake = gltf.scene

      cake.traverse((obj) => {
        if (obj.isMesh) {
          if (obj.name === "BottomSponge") cake.bottomSpongeMesh = obj
          if (obj.name === "TopSponge") cake.topSpongeMesh = obj
          if (obj.name === "Filling") cake.fillingMesh = obj
          if (obj.name === "mainCake") cake.mainCakeMesh = obj

          if (obj.name === "bottomBeadsBorder") cake.bottomBeadsBorderMesh = obj
          if (obj.name === "topBeadsBorder") cake.topBeadsBorderMesh = obj
          if (obj.name === "bottomShellsBorder") cake.bottomShellsBorderMesh = obj
          if (obj.name === "topShellsBorder") cake.topShellsBorderMesh = obj

          obj.material.envMapIntensity = 1.5
          obj.material.roughness = 0.6
          obj.material.metalness = 0.1
          obj.material.needsUpdate = true
        }
      })

      cake.scale.set(0.27, 0.27, 0.27)
      cake.position.set(0, 0.05, 0.2)
      scene.add(cake)

      const loadMesh = (file, propName, visible = false) =>
        loader.load(`/models/compressed_${file}.glb`, (g) => {
          const m = g.scene
          m.visible = visible
          cake.add(m)
          cake[propName] = m
        })

      // borders
      loadMesh("bottomBeadsBorder", "bottomBeadsMesh")
      loadMesh("bottomShellsBorder", "bottomShellsMesh")
      loadMesh("topBeadsBorder", "topBeadsMesh")
      loadMesh("topShellsBorder", "topShellsMesh")

      // decorations
      loadMesh("Balloons", "balloonsMesh")
      loadMesh("Toppings", "toppingsMesh")
      loadMesh("Daisies", "daisiesMesh")
      loadMesh("buttonRoses", "buttonRosesMesh")

      updateCake()
    },
    undefined,
    (err) => console.error("Draco/GLB load error:", err),
  )
}

// Add mouse controls for rotating the cake
function addMouseControls() {
  let down = false, x0 = 0, y0 = 0, tx = 0, ty = 0, cx = 0, cy = 0;
  container.addEventListener("mousedown", (e) => {
    down = true;
    x0 = e.clientX;
    y0 = e.clientY;
  });
  container.addEventListener("mouseup", () => (down = false));
  container.addEventListener("mousemove", (e) => {
    if (!down) return;
    const dx = e.clientX - x0, dy = e.clientY - y0;
    tx += dx * 0.01;
    ty += dy * 0.01;
    x0 = e.clientX;
    y0 = e.clientY;
  });
  container.addEventListener("contextmenu", (e) => e.preventDefault());
  container.addEventListener("wheel", (e) => e.preventDefault());
  (function loop() {
    cx += (tx - cx) * 0.1;
    cy += (ty - cy) * 0.1;
    if (cake) {
      cake.rotation.y = cx;
      cake.rotation.x = cy;
    }
    requestAnimationFrame(loop);
  })();
}

// Animate the 3D scene
function animate() {
  requestAnimationFrame(animate);
  camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);
}

// Event listeners for DOM interactions
document.addEventListener("DOMContentLoaded", () => {
  guidedTour = new GuidedTour();
  document.getElementById("tourHighlight").style.display = "none";
  document.querySelectorAll(".size-option-walmart").forEach((el) =>
    el.addEventListener("click", () => {
      document.querySelectorAll(".size-option-walmart").forEach((o) => o.classList.remove("active"));
      el.classList.add("active");
      config.size = el.dataset.size;
      updateCake();
      updateOrderSummary();
    })
  );
  document.querySelectorAll(".flavor-option-walmart").forEach((el) =>
    el.addEventListener("click", () => {
      document.querySelectorAll(".flavor-option-walmart").forEach((o) => o.classList.remove("active"));
      el.classList.add("active");
      config.cakeColor = el.dataset.color;
      updateCake();
      updateOrderSummary();
    })
  );
  document.querySelectorAll(".icing-style-option").forEach((el) =>
    el.addEventListener("click", () => {
      document.querySelectorAll(".icing-style-option").forEach((o) => o.classList.remove("active"));
      el.classList.add("active");
      config.icingStyle = el.dataset.icing.toLowerCase().replace(" ", "");
      updateOrderSummary();
    })
  );
  document.querySelectorAll(".color-options-walmart .color-option-walmart").forEach((c) =>
    c.addEventListener("click", () => {
      const parent = c.closest(".color-options-walmart");
      const borderType = parent.dataset.borderType;
      if (borderType === "bottom") {
        parent.querySelectorAll(".color-option-walmart").forEach((o) => o.classList.remove("active"));
        c.classList.add("active");
        config.bottomBorderColor = c.dataset.color;
        document.getElementById("selectedBottomBorderColorName").textContent = c.dataset.name;
        updateCake();
      } else if (borderType === "top") {
        parent.querySelectorAll(".color-option-walmart").forEach((o) => o.classList.remove("active"));
        c.classList.add("active");
        config.topBorderColor = c.dataset.color;
        document.getElementById("selectedTopBorderColorName").textContent = c.dataset.name;
        updateCake();
      } else {
        parent.querySelectorAll(".color-option-walmart").forEach((o) => o.classList.remove("active"));
        c.classList.add("active");
        config.icingColor = c.dataset.color;
        document.getElementById("selectedColorName").textContent = c.dataset.name;
        updateCake();
      }
      updateOrderSummary();
    })
  );
  document.querySelectorAll(".toppings-color-option").forEach((c) =>
    c.addEventListener("click", () => {
      document.querySelectorAll(".toppings-color-option").forEach((o) => o.classList.remove("active"));
      c.classList.add("active");
      config.toppingsColor = c.dataset.color;
      document.getElementById("selectedToppingsColorName").textContent = c.dataset.name;
      updateCake();
      updateOrderSummary();
    })
  );
  document.querySelectorAll(".filling-option-walmart").forEach((el) =>
    el.addEventListener("click", () => {
      document.querySelectorAll(".filling-option-walmart").forEach((o) => o.classList.remove("active"));
      el.classList.add("active");
      config.filling = el.dataset.filling;
      updateCake();
      updateOrderSummary();
    })
  );
  document.querySelectorAll("#step-5 .border-option-walmart").forEach((el) =>
    el.addEventListener("click", () => {
      document.querySelectorAll("#step-5 .border-option-walmart").forEach((o) => o.classList.remove("active"));
      el.classList.add("active");
      config.bottomBorder = el.dataset.border;
      const colorSection = document.getElementById("bottomBorderColorSection");
      if (config.bottomBorder !== "none") {
        colorSection.style.display = "block";
      } else {
        colorSection.style.display = "none";
      }
      updateCake();
      updateOrderSummary();
    })
  );
  document.querySelectorAll("#step-6 .border-option-walmart").forEach((el) =>
    el.addEventListener("click", () => {
      document.querySelectorAll("#step-6 .border-option-walmart").forEach((o) => o.classList.remove("active"));
      el.classList.add("active");
      config.topBorder = el.dataset.border;
      const colorSection = document.getElementById("topBorderColorSection");
      if (config.topBorder !== "none") {
        colorSection.style.display = "block";
      } else {
        colorSection.style.display = "none";
      }
      updateCake();
      updateOrderSummary();
    })
  );
  document.querySelectorAll(".message-option-walmart").forEach((option) =>
    option.addEventListener("click", function () {
      document.querySelectorAll(".message-option-walmart").forEach((o) => o.classList.remove("active"));
      this.classList.add("active");
      config.messageChoice = this.dataset.message;
      if (this.dataset.message === "none") {
        config.customText = "";
        document.getElementById("customTextWalmart").value = "";
        document.getElementById("charCountWalmart").textContent = "0";
      }
      updateOrderSummary();
    })
  );
  document.querySelectorAll(".decoration-option-walmart").forEach((el) =>
    el.addEventListener("click", () => {
      document.querySelectorAll(".decoration-option-walmart").forEach((o) => o.classList.remove("active"));
      el.classList.add("active");
      config.decorations = el.dataset.decoration;
      const flowerSubOptions = document.getElementById("flowerSubOptions");
      const toppingsColorSection = document.getElementById("toppingsColorSection");
      if (config.decorations === "flowers") {
        flowerSubOptions.style.display = "flex";
        toppingsColorSection.style.display = "none";
        if (!document.querySelector(".flower-option-walmart.active")) {
          document.querySelector('.flower-option-walmart[data-flower-type="daisies"]').classList.add("active");
          config.flowerType = "daisies";
        }
      } else if (config.decorations === "toppings") {
        flowerSubOptions.style.display = "none";
        toppingsColorSection.style.display = "block";
      } else {
        flowerSubOptions.style.display = "none";
        toppingsColorSection.style.display = "none";
        document.querySelectorAll(".flower-option-walmart").forEach((o) => o.classList.remove("active"));
        config.flowerType = "none";
      }
      updateCake();
      updateOrderSummary();
    })
  );
  document.querySelectorAll(".flower-option-walmart").forEach((el) =>
    el.addEventListener("click", () => {
      document.querySelectorAll(".flower-option-walmart").forEach((o) => o.classList.remove("active"));
      el.classList.add("active");
      config.flowerType = el.dataset.flowerType;
      updateCake();
      updateOrderSummary();
    })
  );
  document.getElementById("customTextWalmart").addEventListener("input", (e) => {
    const charCount = document.getElementById("charCountWalmart");
    charCount.textContent = e.target.value.length;
    config.customText = e.target.value;
    updateOrderSummary();
  });
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
      handleImageUpload(files[0]);
    }
  });
  imageUpload.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      handleImageUpload(e.target.files[0]);
    }
  });
  function handleImageUpload(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImage.src = e.target.result;
      uploadedImageDiv.style.display = "block";
      uploadArea.style.display = "none";
    };
    reader.readAsDataURL(file);
  }
  window.removeUploadedImage = function () {
    uploadedImageDiv.style.display = "none";
    uploadArea.style.display = "block";
    imageUpload.value = "";
  };
  document.getElementById("orderSummaryView").style.display = "none";
  document.querySelector(".step-content").style.display = "block";
  document.querySelector(".step-navigation").style.display = "flex";
  showStep(1);
  init();
});

// Expose functions globally
window.nextStep = nextStep;
window.prevStep = prevStep;
window.goToStep = goToStep;
window.showFirstStep = showFirstStep;
window.addToCart = addToCart;
window.saveDesignImage = saveDesignImage;
window.checkout = checkout;
window.submitOrder = submitOrder;