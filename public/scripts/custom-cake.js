// Enhanced JavaScript with better functionality
let scene, camera, renderer, cake
const container = document.getElementById("canvas-container")
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
}

const fillingColors = {
  strawberry: "#B70824",
  bavarian: "#F1E7C3",
  none: "#FFFFFF",
}

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
}

let currentWizardStep = 1
const totalWizardSteps = 8
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
]

// =============== GUIDED TOUR SYSTEM ===============
class GuidedTour {
  constructor() {
    this.currentStep = 0
    this.isActive = false
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
        content:
          'Make it personal! Add a custom message to your cake. If you choose "Add custom message", please type your message before the tour continues.',
        position: "left",
        waitForInput: true,
      },
      {
        target: "#decorationOptions",
        title: "Choose Decorations",
        content: "Add beautiful decorations to make your cake extra special - flowers, balloons, or toppings.",
        position: "left",
      },
    ]
    this.overlay = document.getElementById("tourOverlay")
    this.highlight = document.getElementById("tourHighlight")
    this.tooltip = document.getElementById("tourTooltip")
    this.tooltipHeader = document.getElementById("tourTooltipHeader")
    this.tooltipContent = document.getElementById("tourTooltipContent")
    this.stepCounter = document.getElementById("tourStepCounter")
    this.startBtn = document.getElementById("tourStartBtn")
    this.bindEvents()
  }

  bindEvents() {
    this.startBtn.addEventListener("click", () => this.startTour())
    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay) {
        this.nextStep()
      }
    })
    // Modified click handler to not auto-advance on message step with custom input
    document.addEventListener("click", (e) => {
      if (this.isActive && !this.tooltip.contains(e.target) && e.target !== this.startBtn) {
        const currentStep = this.steps[this.currentStep]
        // Don't auto-advance if we're on message step and user selected custom message but hasn't typed
        if (
          currentStep &&
          currentStep.target === "#messageOptions" &&
          config.messageChoice === "custom" &&
          document.getElementById("customTextWalmart").value.trim() === ""
        ) {
          return // Don't advance
        }
        this.nextStep()
      }
    })
  }

  startTour() {
    this.isActive = true
    this.currentStep = 0
    this.startBtn.classList.add("hidden")
    this.overlay.classList.add("active")
    // Ensure we're in step view, not summary view
    if (document.getElementById("orderSummaryView").style.display !== "none") {
      showFirstStep()
    }
    this.showStep()
  }

  positionHighlight(target) {
    const rect = target.getBoundingClientRect()
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft
    this.highlight.style.top = rect.top + scrollTop - 8 + "px"
    this.highlight.style.left = rect.left + scrollLeft - 8 + "px"
    this.highlight.style.width = rect.width + 16 + "px"
    this.highlight.style.height = rect.height + 16 + "px"
    this.highlight.style.display = "block"
  }

  positionTooltip(target, step) {
    const rect = target.getBoundingClientRect()
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft

    // Show tooltip first to get dimensions
    this.tooltip.style.display = "block"
    this.tooltip.style.visibility = "hidden"
    const tooltipRect = this.tooltip.getBoundingClientRect()
    this.tooltip.style.visibility = "visible"
    let top, left
    let arrowClass = ""
    // Reset arrow classes
    this.tooltip.className = "tour-tooltip"
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    switch (step.position) {
      case "right":
        top = rect.top + scrollTop + rect.height / 2 - tooltipRect.height / 2
        left = rect.right + scrollLeft + 20
        arrowClass = "arrow-left"

        // Ensure it doesn't go off screen
        if (left + tooltipRect.width > viewportWidth - 10) {
          left = rect.left + scrollLeft - tooltipRect.width - 20
          arrowClass = "arrow-right"
        }
        break
      case "left":
        top = rect.top + scrollTop + rect.height / 2 - tooltipRect.height / 2
        left = rect.left + scrollLeft - tooltipRect.width - 20
        arrowClass = "arrow-right"

        // Ensure it doesn't go off screen
        if (left < 10) {
          left = rect.right + scrollLeft + 20
          arrowClass = "arrow-left"
        }
        break
      case "bottom":
        top = rect.bottom + scrollTop + 20
        left = rect.left + scrollLeft + rect.width / 2 - tooltipRect.width / 2
        arrowClass = "arrow-top"
        break
      case "top":
        top = rect.top + scrollTop - tooltipRect.height - 20
        left = rect.left + scrollLeft + rect.width / 2 - tooltipRect.width / 2
        arrowClass = "arrow-bottom"
        break
    }
    // Ensure tooltip stays within viewport bounds
    if (left < 10) left = 10
    if (left + tooltipRect.width > viewportWidth - 10) left = viewportWidth - tooltipRect.width - 10
    if (top < 10) top = 10
    if (top + tooltipRect.height > viewportHeight + scrollTop - 10) {
      top = viewportHeight + scrollTop - tooltipRect.height - 10
    }
    this.tooltip.style.top = top + "px"
    this.tooltip.style.left = left + "px"
    this.tooltip.classList.add(arrowClass)
  }

  showStep() {
    const step = this.steps[this.currentStep]
    let target = document.querySelector(step.target)
    // Special handling for border color sections - skip if no border selected
    if (step.target.includes("bottomBorderColorSection") && config.bottomBorder === "none") {
      this.nextStep()
      return
    }

    if (step.target.includes("topBorderColorSection") && config.topBorder === "none") {
      this.nextStep()
      return
    }
    // Special handling for color sections that might be hidden
    if (!target || (target.style && target.style.display === "none")) {
      // For border color sections, show them temporarily during tour
      if (step.target.includes("BorderColorSection")) {
        if (step.target.includes("bottom") && config.bottomBorder !== "none") {
          document.querySelector('#bottomBorderOptions .border-option-walmart[data-border="beads"]').click()
          target = document.querySelector(step.target + " .color-options-walmart")
        } else if (step.target.includes("top") && config.topBorder !== "none") {
          document.querySelector('#topBorderOptions .border-option-walmart[data-border="beads"]').click()
          target = document.querySelector(step.target + " .color-options-walmart")
        }
      }
    }
    if (!target) {
      this.nextStep()
      return
    }
    // For custom message step, check if user selected custom message and wait for input
    if (step.target === "#messageOptions" && config.messageChoice === "custom") {
      const customInput = document.getElementById("customTextWalmart")
      if (customInput && customInput.value.trim() === "") {
        // Wait for user to type something
        const inputHandler = () => {
          if (customInput.value.trim() !== "") {
            customInput.removeEventListener("input", inputHandler)
            setTimeout(() => this.nextStep(), 1000) // Auto advance after 1 second of typing
          }
        }
        customInput.addEventListener("input", inputHandler)
        // Don't proceed automatically, wait for user input
      }
    }
    // Rest of the existing showStep logic...
    // Navigate to the appropriate wizard step if needed - ONLY when step changes
    const stepMapping = {
      0: 1, // Welcome - stay on size
      1: 1, // Size
      2: 2, // Flavor
      3: 3, // Icing styles
      4: 3, // Icing colors - STAY on step 3
      5: 4, // Filling
      6: 5, // Bottom border options
      7: 5, // Bottom border colors - STAY on step 5
      8: 6, // Top border options
      9: 6, // Top border colors - STAY on step 6
      10: 7, // Message
      11: 8, // Decorations
    }
    const wizardStep = stepMapping[this.currentStep]
    if (wizardStep && currentWizardStep !== wizardStep) {
      goToStep(wizardStep)
    }
    // Position highlight
    this.positionHighlight(target)
    // Position tooltip
    this.positionTooltip(target, step)
    // Update content
    this.tooltipHeader.textContent = step.title
    this.tooltipContent.textContent = step.content
    this.stepCounter.textContent = `${this.currentStep + 1} of ${this.steps.length}`

    // Ensure tooltip is visible
    this.tooltip.style.display = "block"
  }

  nextStep() {
    this.currentStep++
    if (this.currentStep >= this.steps.length) {
      this.endTour()
    } else {
      // Add small delay to prevent positioning issues
      setTimeout(() => {
        this.showStep()
      }, 100)
    }
  }

  endTour() {
    this.isActive = false
    this.overlay.classList.remove("active")
    this.highlight.style.display = "none"
    this.tooltip.style.display = "none"
    this.startBtn.classList.remove("hidden")
    this.currentStep = 0
  }
}

// Initialize tour system
let guidedTour
// =============== END GUIDED TOUR SYSTEM ===============

function showOrderSummary() {
  document.getElementById("orderSummaryView").style.display = "block"
  document.querySelector(".step-content").style.display = "none"
  document.querySelector(".step-navigation").style.display = "none"
  updateOrderSummary()
}

function showFirstStep() {
  document.getElementById("orderSummaryView").style.display = "none"
  document.querySelector(".step-content").style.display = "block"
  document.querySelector(".step-navigation").style.display = "flex"
  goToStep(1)
}

function goToStep(stepNumber) {
  currentWizardStep = stepNumber
  showStep(stepNumber)
  document.getElementById("orderSummaryView").style.display = "none"
  document.querySelector(".step-content").style.display = "block"
  document.querySelector(".step-navigation").style.display = "flex"
}

function showStep(stepNumber) {
  // Hide all steps
  document.querySelectorAll(".step-section").forEach((section) => {
    section.classList.remove("active")
  })
  // Show current step
  document.getElementById(`step-${stepNumber}`).classList.add("active")
  // Handle flower sub-options visibility
  const flowerSubOptions = document.getElementById("flowerSubOptions")
  if (stepNumber === 8 && config.decorations === "flowers") {
    flowerSubOptions.style.display = "flex"
  } else {
    flowerSubOptions.style.display = "none"
  }
  // Handle toppings color section visibility
  const toppingsColorSection = document.getElementById("toppingsColorSection")
  if (stepNumber === 8 && config.decorations === "toppings") {
    toppingsColorSection.style.display = "block"
  } else {
    toppingsColorSection.style.display = "none"
  }
  // Update navigation
  const prevBtn = document.getElementById("prevBtn")
  const nextBtn = document.getElementById("nextBtn")
  const nextStepName = document.getElementById("nextStepName")
  prevBtn.style.display = stepNumber === 1 ? "none" : "block"
  if (stepNumber === totalWizardSteps) {
    nextBtn.textContent = "Done"
    nextBtn.className = "nav-btn"
    nextBtn.onclick = showOrderSummary
    nextStepName.textContent = ""
  } else {
    nextBtn.innerHTML = "→"
    nextBtn.className = "nav-btn"
    nextBtn.onclick = nextStep
    nextStepName.textContent = stepNames[stepNumber + 1]
  }
}

function nextStep() {
  if (currentWizardStep < totalWizardSteps) {
    currentWizardStep++
    showStep(currentWizardStep)
  } else {
    showOrderSummary()
  }
}

function prevStep() {
  if (currentWizardStep > 1) {
    currentWizardStep--
    showStep(currentWizardStep)
  }
}

function updateOrderSummary() {
  const sizeLabels = {
    small: '6" Round',
    medium: '8" Round',
    large: '10" Round',
  }
  document.getElementById("summarySize").textContent = sizeLabels[config.size]
  document.getElementById("summarySizePrice").innerHTML = `<strong>₱${pricing.base[config.size].toFixed(2)}</strong>`
  document.getElementById("summaryFlavor").textContent = config.cakeColor === "#8B4513" ? "Chocolate" : "White"
  const icingStyle = config.icingStyle === "buttercream" ? "Buttercreme" : "Whipped"
  const icingColorName = document.getElementById("selectedColorName").textContent
  document.getElementById("summaryIcing").textContent = `${icingStyle} - ${icingColorName}`
  // Handle filling
  const fillingNames = {
    none: "None",
    strawberry: "Strawberry",
    bavarian: "Bavarian Creme",
  }
  document.getElementById("summaryFilling").textContent = fillingNames[config.filling]
  const fillingPriceElement = document.getElementById("summaryFillingPrice")
  if (config.filling !== "none") {
    fillingPriceElement.innerHTML = `<strong>+₱${pricing.fillings[config.filling].toFixed(2)}</strong>`
    fillingPriceElement.style.display = "block"
  } else {
    fillingPriceElement.style.display = "none"
  }
  // Handle borders
  const bottomBorderItem = document.getElementById("summaryBottomBorderItem")
  if (config.bottomBorder !== "none") {
    bottomBorderItem.style.display = "flex"
    const borderName = config.bottomBorder.charAt(0).toUpperCase() + config.bottomBorder.slice(1)
    const borderColorName = document.getElementById("selectedBottomBorderColorName").textContent
    document.getElementById("summaryBottomBorder").textContent = `${borderName} - ${borderColorName}`
  } else {
    bottomBorderItem.style.display = "none"
  }
  const topBorderItem = document.getElementById("summaryTopBorderItem")
  if (config.topBorder !== "none") {
    topBorderItem.style.display = "flex"
    const borderName = config.topBorder.charAt(0).toUpperCase() + config.topBorder.slice(1)
    const borderColorName = document.getElementById("selectedTopBorderColorName").textContent
    document.getElementById("summaryTopBorder").textContent = `${borderName} - ${borderColorName}`
  } else {
    topBorderItem.style.display = "none"
  }
  // Handle message
  const messageItem = document.getElementById("summaryMessageItem")
  if (config.customText && config.messageChoice === "custom") {
    messageItem.style.display = "flex"
    document.getElementById("summaryMessage").textContent = `"${config.customText}"`
  } else {
    messageItem.style.display = "none"
  }
  // Handle decorations
  const decorationsItem = document.getElementById("summaryDecorationsItem")
  if (config.decorations !== "none") {
    decorationsItem.style.display = "flex"
    let decorationText = ""
    if (config.decorations === "flowers") {
      const flowerNames = {
        daisies: "Daisies",
        buttonRoses: "Button Roses",
      }
      decorationText = `Flowers (${flowerNames[config.flowerType] || "None"})`
    } else if (config.decorations === "toppings") {
      const toppingsColorName = document.getElementById("selectedToppingsColorName").textContent
      decorationText = `Toppings (${toppingsColorName})`
    } else {
      const decorationNames = {
        balloons: "Balloons",
      }
      decorationText = decorationNames[config.decorations]
    }
    document.getElementById("summaryDecorations").textContent = decorationText
  } else {
    decorationsItem.style.display = "none"
  }
  // Update total
  const total = pricing.base[config.size] + pricing.fillings[config.filling]
  document.getElementById("summaryTotal").innerHTML = `<strong>₱${total.toFixed(2)}</strong>`
}

function saveDesignImage() {
  if (!renderer || !scene || !camera) {
    alert("3D model not ready. Please wait a moment and try again.")
    return
  }
  try {
    renderer.render(scene, camera)
    const canvas = renderer.domElement
    const dataURL = canvas.toDataURL("image/png")
    const link = document.createElement("a")
    link.download = `cake-design-${Date.now()}.png`
    link.href = dataURL
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    alert("🎨 Design image saved successfully!")
  } catch (error) {
    console.error("Error saving design:", error)
    alert("Sorry, there was an error saving your design. Please try again.")
  }
}

function checkout() {
  const sizeLabels = {
    small: { label: '6"', servings: 12 },
    medium: { label: '8"', servings: 16 },
    large: { label: '10"', servings: 24 },
  }
  const sizeInfo = sizeLabels[config.size]
  const total = pricing.base[config.size] + pricing.fillings[config.filling]
  alert(
    `🛒 Proceeding to checkout...\n\n` +
      `Your custom cake:\n` +
      `Size: ${sizeInfo.label} (${sizeInfo.servings} servings)\n` +
      `Flavor: ${config.cakeColor === "#8B4513" ? "Chocolate" : "White"}\n` +
      `Total: ₱${total.toFixed(2)}\n\n` +
      `Redirecting to payment page...`,
  )
}

function addToCart() {
  const sizeLabels = {
    small: { label: '6"', servings: 12 },
    medium: { label: '8"', servings: 16 },
    large: { label: '10"', servings: 24 },
  }
  const sizeInfo = sizeLabels[config.size]
  const total = pricing.base[config.size] + pricing.fillings[config.filling]
  alert(
    `🛒 Added to cart!\n\n` +
      `Size: ${sizeInfo.label} (${sizeInfo.servings} servings)\n` +
      `Flavor: ${config.cakeColor === "#8B4513" ? "Chocolate" : "White"}\n` +
      `Icing: ${config.icingStyle === "buttercream" ? "Buttercream" : "Whipped Cream"}\n` +
      `Filling: ${config.filling === "strawberry" ? "Strawberry" : config.filling === "bavarian" ? "Bavarian Crème" : "None"}\n` +
      `${config.customText ? `Message: "${config.customText}"\n` : ""}` +
      `${config.decorations !== "none" ? `Decorations: ${config.decorations === "flowers" ? `Flowers (${config.flowerType === "daisies" ? "Daisies" : "Button Roses"})` : config.decorations === "toppings" ? `Toppings (${document.getElementById("selectedToppingsColorName").textContent})` : config.decorations}\n` : ""}` +
      `\nTotal: ₱${total.toFixed(2)}`,
  )
}

// Add event listeners for the new Walmart-style options
document.addEventListener("DOMContentLoaded", () => {
  // Initialize guided tour
  guidedTour = new GuidedTour()

  // Ensure tour highlight is hidden on page load to prevent unwanted rectangle display
  const tourHighlight = document.getElementById("tourHighlight")
  if (tourHighlight) {
    tourHighlight.style.display = "none"
  }

  // Size options
  document.querySelectorAll(".size-option-walmart").forEach((el) =>
    el.addEventListener("click", () => {
      document.querySelectorAll(".size-option-walmart").forEach((o) => o.classList.remove("active"))
      el.classList.add("active")
      config.size = el.dataset.size
      updateCake()
      updateOrderSummary()
    }),
  )
  // Flavor options
  document.querySelectorAll(".flavor-option-walmart").forEach((el) =>
    el.addEventListener("click", () => {
      document.querySelectorAll(".flavor-option-walmart").forEach((o) => o.classList.remove("active"))
      el.classList.add("active")
      config.cakeColor = el.dataset.color
      updateCake()
      updateOrderSummary()
    }),
  )
  // Icing options
  document.querySelectorAll(".icing-style-option").forEach((el) =>
    el.addEventListener("click", () => {
      document.querySelectorAll(".icing-style-option").forEach((o) => o.classList.remove("active"))
      el.classList.add("active")
      config.icingStyle = el.dataset.icing.toLowerCase().replace(" ", "")
      updateOrderSummary()
    }),
  )
  // Color options
  document.querySelectorAll(".color-options-walmart .color-option-walmart").forEach((c) =>
    c.addEventListener("click", () => {
      const parent = c.closest(".color-options-walmart")
      const borderType = parent.dataset.borderType
      if (borderType === "bottom") {
        parent.querySelectorAll(".color-option-walmart").forEach((o) => o.classList.remove("active"))
        c.classList.add("active")
        config.bottomBorderColor = c.dataset.color
        document.getElementById("selectedBottomBorderColorName").textContent = c.dataset.name
        updateCake()
      } else if (borderType === "top") {
        parent.querySelectorAll(".color-option-walmart").forEach((o) => o.classList.remove("active"))
        c.classList.add("active")
        config.topBorderColor = c.dataset.color
        document.getElementById("selectedTopBorderColorName").textContent = c.dataset.name
        updateCake()
      } else {
        parent.querySelectorAll(".color-option-walmart").forEach((o) => o.classList.remove("active"))
        c.classList.add("active")
        config.icingColor = c.dataset.color
        updateCake()
        document.getElementById("selectedColorName").textContent = c.dataset.name
      }
      updateOrderSummary()
    }),
  )
  // Toppings color options
  document.querySelectorAll(".toppings-color-option").forEach((c) =>
    c.addEventListener("click", () => {
      document.querySelectorAll(".toppings-color-option").forEach((o) => o.classList.remove("active"))
      c.classList.add("active")
      config.toppingsColor = c.dataset.color
      document.getElementById("selectedToppingsColorName").textContent = c.dataset.name
      updateCake()
      updateOrderSummary()
    }),
  )
  // Filling options
  document.querySelectorAll(".filling-option-walmart").forEach((el) =>
    el.addEventListener("click", () => {
      document.querySelectorAll(".filling-option-walmart").forEach((o) => o.classList.remove("active"))
      el.classList.add("active")
      config.filling = el.dataset.filling
      updateCake()
      updateOrderSummary()
    }),
  )
  // Bottom border options
  document.querySelectorAll("#step-5 .border-option-walmart").forEach((el) =>
    el.addEventListener("click", () => {
      document.querySelectorAll("#step-5 .border-option-walmart").forEach((o) => o.classList.remove("active"))
      el.classList.add("active")
      config.bottomBorder = el.dataset.border
      const colorSection = document.getElementById("bottomBorderColorSection")
      if (config.bottomBorder !== "none") {
        colorSection.style.display = "block"
      } else {
        colorSection.style.display = "none"
      }
      updateCake()
      updateOrderSummary()
    }),
  )
  // Top border options
  document.querySelectorAll("#step-6 .border-option-walmart").forEach((el) =>
    el.addEventListener("click", () => {
      document.querySelectorAll("#step-6 .border-option-walmart").forEach((o) => o.classList.remove("active"))
      el.classList.add("active")
      config.topBorder = el.dataset.border
      const colorSection = document.getElementById("topBorderColorSection")
      if (config.topBorder !== "none") {
        colorSection.style.display = "block"
      } else {
        colorSection.style.display = "none"
      }
      updateCake()
      updateOrderSummary()
    }),
  )
  // Message options
  document.querySelectorAll(".message-option-walmart").forEach((option) => {
    option.addEventListener("click", function () {
      document.querySelectorAll(".message-option-walmart").forEach((o) => o.classList.remove("active"))
      this.classList.add("active")
      config.messageChoice = this.dataset.message
      if (this.dataset.message === "none") {
        config.customText = ""
        document.getElementById("customTextWalmart").value = ""
        document.getElementById("charCountWalmart").textContent = "0"
      }
      updateOrderSummary()
    })
  })
  // Decoration options
  document.querySelectorAll(".decoration-option-walmart").forEach((el) =>
    el.addEventListener("click", () => {
      document.querySelectorAll(".decoration-option-walmart").forEach((o) => o.classList.remove("active"))
      el.classList.add("active")
      config.decorations = el.dataset.decoration
      const flowerSubOptions = document.getElementById("flowerSubOptions")
      const toppingsColorSection = document.getElementById("toppingsColorSection")

      if (config.decorations === "flowers") {
        flowerSubOptions.style.display = "flex"
        toppingsColorSection.style.display = "none"
        if (!document.querySelector(".flower-option-walmart.active")) {
          document.querySelector('.flower-option-walmart[data-flower-type="daisies"]').classList.add("active")
          config.flowerType = "daisies"
        }
      } else if (config.decorations === "toppings") {
        flowerSubOptions.style.display = "none"
        toppingsColorSection.style.display = "block"
      } else {
        flowerSubOptions.style.display = "none"
        toppingsColorSection.style.display = "none"
        document.querySelectorAll(".flower-option-walmart").forEach((o) => o.classList.remove("active"))
        config.flowerType = "none"
      }
      updateCake()
      updateOrderSummary()
    }),
  )
  // Flower sub-options
  document.querySelectorAll(".flower-option-walmart").forEach((el) =>
    el.addEventListener("click", () => {
      document.querySelectorAll(".flower-option-walmart").forEach((o) => o.classList.remove("active"))
      el.classList.add("active")
      config.flowerType = el.dataset.flowerType
      updateCake()
      updateOrderSummary()
    }),
  )
  // Custom text
  document.getElementById("customTextWalmart").addEventListener("input", (e) => {
    const charCount = document.getElementById("charCountWalmart")
    charCount.textContent = e.target.value.length
    config.customText = e.target.value
    updateOrderSummary()
  })
  // Initialize - start with step content visible, order summary hidden
  document.getElementById("orderSummaryView").style.display = "none"
  document.querySelector(".step-content").style.display = "block"
  document.querySelector(".step-navigation").style.display = "flex"
  showStep(1)
  init()
  // Upload functionality
  const uploadArea = document.getElementById("uploadArea")
  const imageUpload = document.getElementById("imageUpload")
  const uploadedImageDiv = document.getElementById("uploadedImage")
  const previewImage = document.getElementById("previewImage")
  uploadArea.addEventListener("click", () => {
    imageUpload.click()
  })
  uploadArea.addEventListener("dragover", (e) => {
    e.preventDefault()
    uploadArea.style.borderColor = "var(--primary-color)"
    uploadArea.style.backgroundColor = "rgba(44, 144, 69, 0.05)"
  })
  uploadArea.addEventListener("dragleave", () => {
    uploadArea.style.borderColor = "#d0d0d0"
    uploadArea.style.backgroundColor = "#fafafa"
  })
  uploadArea.addEventListener("drop", (e) => {
    e.preventDefault()
    uploadArea.style.borderColor = "#d0d0d0"
    uploadArea.style.backgroundColor = "#fafafa"
    const files = e.dataTransfer.files
    if (files.length > 0 && files[0].type.startsWith("image/")) {
      handleImageUpload(files[0])
    }
  })
  imageUpload.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      handleImageUpload(e.target.files[0])
    }
  })
  function handleImageUpload(file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      previewImage.src = e.target.result
      uploadedImageDiv.style.display = "block"
      uploadArea.style.display = "none"
    }
    reader.readAsDataURL(file)
  }
  function removeUploadedImage() {
    uploadedImageDiv.style.display = "none"
    uploadArea.style.display = "block"
    imageUpload.value = ""
  }
  window.removeUploadedImage = removeUploadedImage
})

function updateCake() {
  if (!cake) return
  // Bottom border logic with immediate color update
  if (config.bottomBorder === "beads" && cake.bottomBeadsMesh) {
    cake.bottomBeadsMesh.visible = true
    cake.bottomBeadsMesh.traverse((child) => {
      if (child.isMesh && child.material) {
        const hexColor = Number.parseInt(config.bottomBorderColor.replace("#", "0x"))
        child.material.color.setHex(hexColor)
      }
    })
  } else if (cake.bottomBeadsMesh) {
    cake.bottomBeadsMesh.visible = false
  }
  if (config.bottomBorder === "shells" && cake.bottomShellsMesh) {
    cake.bottomShellsMesh.visible = true
    cake.bottomShellsMesh.traverse((child) => {
      if (child.isMesh && child.material) {
        const hexColor = Number.parseInt(config.bottomBorderColor.replace("#", "0x"))
        child.material.color.setHex(hexColor)
      }
    })
  } else if (cake.bottomShellsMesh) {
    cake.bottomShellsMesh.visible = false
  }
  // Top border logic with immediate color update
  if (config.topBorder === "beads" && cake.topBeadsMesh) {
    cake.topBeadsMesh.visible = true
    cake.topBeadsMesh.traverse((child) => {
      if (child.isMesh && child.material) {
        const hexColor = Number.parseInt(config.topBorderColor.replace("#", "0x"))
        child.material.color.setHex(hexColor)
      }
    })
  } else if (cake.topBeadsMesh) {
    cake.topBeadsMesh.visible = false
  }
  if (config.topBorder === "shells" && cake.topShellsMesh) {
    cake.topShellsMesh.visible = true
    cake.topShellsMesh.traverse((child) => {
      if (child.isMesh && child.material) {
        const hexColor = Number.parseInt(config.topBorderColor.replace("#", "0x"))
        child.material.color.setHex(hexColor)
      }
    })
  } else if (cake.topShellsMesh) {
    cake.topShellsMesh.visible = false
  }
  const hexCake = Number.parseInt(config.cakeColor.replace("#", "0x"))
  if (cake.bottomSpongeMesh) cake.bottomSpongeMesh.material.color.setHex(hexCake)
  if (cake.topSpongeMesh) cake.topSpongeMesh.material.color.setHex(hexCake)
  const hexIce = Number.parseInt(config.icingColor.replace("#", "0x"))
  if (cake.mainCakeMesh) cake.mainCakeMesh.material.color.setHex(hexIce)
  const fillColor = fillingColors[config.filling] || "#FFFFFF"
  const hexFills = Number.parseInt(fillColor.replace("#", "0x"))
  if (cake.fillingMesh) cake.fillingMesh.material.color.setHex(hexFills)
  // Hide all decoration meshes first
  if (cake.balloonsMesh) cake.balloonsMesh.visible = false
  if (cake.toppingsMesh) cake.toppingsMesh.visible = false
  if (cake.daisiesMesh) cake.daisiesMesh.visible = false
  if (cake.buttonRosesMesh) cake.buttonRosesMesh.visible = false
  // Show selected decoration
  if (config.decorations === "balloons" && cake.balloonsMesh) {
    cake.balloonsMesh.visible = true
  } else if (config.decorations === "toppings" && cake.toppingsMesh) {
    cake.toppingsMesh.visible = true
    // Apply toppings color
    cake.toppingsMesh.traverse((child) => {
      if (child.isMesh && child.material) {
        const hexColor = Number.parseInt(config.toppingsColor.replace("#", "0x"))
        child.material.color.setHex(hexColor)
      }
    })
  } else if (config.decorations === "flowers") {
    if (config.flowerType === "daisies" && cake.daisiesMesh) {
      cake.daisiesMesh.visible = true
    } else if (config.flowerType === "buttonRoses" && cake.buttonRosesMesh) {
      cake.buttonRosesMesh.visible = true
    }
  }
}

// Make functions global
window.nextStep = nextStep
window.prevStep = prevStep
window.goToStep = goToStep
window.showFirstStep = showFirstStep
window.addToCart = addToCart
window.saveDesignImage = saveDesignImage
window.checkout = checkout

function init() {
  const THREE = window.THREE // Declare THREE variable
  scene = new THREE.Scene()
  scene.background = new THREE.Color("#f5f1e9")
  THREE.RectAreaLightUniformsLib.init()
  camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000)
  camera.position.set(0, 0.2, 1.0)
  camera.lookAt(0, 0, 0)
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.setSize(container.clientWidth, container.clientHeight)
  container.appendChild(renderer.domElement)
  window.addEventListener("resize", () => {
    const width = container.clientWidth
    const height = container.clientHeight
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.setSize(width, height)
  })
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.1)
  scene.add(ambientLight)
  const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.7)
  scene.add(hemisphereLight)
  const dirLight = new THREE.DirectionalLight(0xffffff, 1)
  dirLight.position.set(1.5, 2, 1)
  dirLight.castShadow = true
  dirLight.shadow.mapSize.width = 1024
  dirLight.shadow.mapSize.height = 1024
  dirLight.shadow.camera.near = 0.5
  dirLight.shadow.camera.far = 500
  dirLight.shadow.camera.left = -1
  dirLight.shadow.camera.right = 1
  dirLight.shadow.camera.top = 1
  dirLight.shadow.camera.bottom = -1
  scene.add(dirLight)
  createCake()
  addMouseControls()
  animate()
  setTimeout(() => {
    document.getElementById("loadingScreen").classList.add("hidden")
  }, 800)
}

function createCake() {
  if (cake) scene.remove(cake)
  const THREE = window.THREE // Declare THREE variable
  new THREE.GLTFLoader().load(
    "/models/mainCake.glb",
    (gltf) => {
      cake = gltf.scene
      cake.traverse((obj) => {
        if (obj.isMesh && !cake.mainCakeMesh) {
          cake.mainCakeMesh = obj
        }
        if (obj.name === "bottomBeadsBorder") {
          cake.bottomBeadsBorderMesh = obj
          obj.visible = false
        }
        if (obj.name === "topBeadsBorder") {
          cake.topBeadsBorderMesh = obj
          obj.visible = false
        }
        if (obj.name === "bottomShellsBorder") {
          cake.bottomShellsBorderMesh = obj
          obj.visible = false
        }
        if (obj.name === "topShellsBorder") {
          cake.topShellsBorderMesh = obj
          obj.visible = false
        }
        if (obj.isMesh) {
          obj.material.envMapIntensity = 0.5
          obj.material.needsUpdate = true
          if (obj.isMesh && obj.material) {
            obj.material.envMapIntensity = 1.5
            obj.material.roughness = 0.6
            obj.material.metalness = 0.1
            obj.material.needsUpdate = true
          }
          if (obj.name === "BottomSponge") cake.bottomSpongeMesh = obj
          if (obj.name === "TopSponge") cake.topSpongeMesh = obj
          if (obj.name === "Filling") cake.fillingMesh = obj
        }
      })
      cake.position.y = 0
      scene.add(cake)
      cake.scale.set(0.27, 0.27, 0.27)
      cake.position.set(0, 0.05, 0.2)
      new THREE.GLTFLoader().load("/models/bottomBeadsBorder.glb", (bottomBeadsGltf) => {
        const bottomBeads = bottomBeadsGltf.scene
        bottomBeads.visible = false
        cake.add(bottomBeads)
        cake.bottomBeadsMesh = bottomBeads
      })
      new THREE.GLTFLoader().load("/models/bottomShellsBorder.glb", (bottomShellsGltf) => {
        const bottomShells = bottomShellsGltf.scene
        bottomShells.visible = false
        cake.add(bottomShells)
        cake.bottomShellsMesh = bottomShells
      })
      new THREE.GLTFLoader().load("/models/topBeadsBorder.glb", (topBeadsGltf) => {
        const topBeads = topBeadsGltf.scene
        topBeads.visible = false
        cake.add(topBeads)
        cake.topBeadsMesh = topBeads
      })
      new THREE.GLTFLoader().load("/models/topShellsBorder.glb", (topShellsGltf) => {
        const topShells = topShellsGltf.scene
        topShells.visible = false
        cake.add(topShells)
        cake.topShellsMesh = topShells
      })
      // Load new decoration models
      new THREE.GLTFLoader().load("/models/Balloons.glb", (gltf) => {
        cake.balloonsMesh = gltf.scene
        cake.balloonsMesh.visible = false
        cake.add(cake.balloonsMesh)
      })
      new THREE.GLTFLoader().load("/models/Toppings.glb", (gltf) => {
        cake.toppingsMesh = gltf.scene
        cake.toppingsMesh.visible = false
        cake.add(cake.toppingsMesh)
      })
      new THREE.GLTFLoader().load("/models/Daisies.glb", (gltf) => {
        cake.daisiesMesh = gltf.scene
        cake.daisiesMesh.visible = false
        cake.add(cake.daisiesMesh)
      })
      new THREE.GLTFLoader().load("/models/buttonRoses.glb", (gltf) => {
        cake.buttonRosesMesh = gltf.scene
        cake.buttonRosesMesh.visible = false
        cake.add(cake.buttonRosesMesh)
      })
      updateCake()
    },
    undefined,
    (err) => console.error(err),
  )
}

function addMouseControls() {
  let down = false,
    x0 = 0,
    y0 = 0,
    tx = 0,
    ty = 0,
    cx = 0,
    cy = 0
  container.addEventListener("mousedown", (e) => {
    down = true
    x0 = e.clientX
    y0 = e.clientY
  })
  container.addEventListener("mouseup", () => (down = false))
  container.addEventListener("mousemove", (e) => {
    if (!down) return
    const dx = e.clientX - x0,
      dy = e.clientY - y0
    tx += dx * 0.01
    ty += dy * 0.01
    x0 = e.clientX
    y0 = e.clientY
  })
  container.addEventListener("contextmenu", (e) => e.preventDefault())
  container.addEventListener("wheel", (e) => e.preventDefault())
  ;(function loop() {
    cx += (tx - cx) * 0.1
    cy += (ty - cy) * 0.1
    if (cake) {
      cake.rotation.y = cx
      cake.rotation.x = cy
    }
    requestAnimationFrame(loop)
  })()
}

function animate() {
  requestAnimationFrame(animate)
  camera.lookAt(0, 0, 0)
  renderer.render(scene, camera)
}
