// scripts/customer-faq.js
document.addEventListener("DOMContentLoaded", () => {
  const faqList = document.getElementById("faqList");
  const faqSearch = document.getElementById("faqSearch");

  // Function to display FAQs in the accordion
  function displayFaqs(faqs) {
    if (!faqs || faqs.length === 0) {
      faqList.innerHTML = `
                <div class="no-faqs">
                    <i class="fas fa-question-circle"></i>
                    <h4>No FAQs Available</h4>
                    <p>Check back later for frequently asked questions.</p>
                </div>
            `;
      return;
    }

    let accordionHTML = "";

    faqs.forEach((faq, index) => {
      accordionHTML += `
                <div class="accordion-item">
                    <h2 class="accordion-header" id="heading${index}">
                        <button class="accordion-button ${
                          index === 0 ? "" : "collapsed"
                        }" type="button" 
                                data-bs-toggle="collapse" data-bs-target="#collapse${index}" 
                                aria-expanded="${
                                  index === 0 ? "true" : "false"
                                }" 
                                aria-controls="collapse${index}">
                            <i class="fas fa-question-circle faq-icon"></i>
                            ${escapeHtml(faq.question)}
                        </button>
                    </h2>
                    <div id="collapse${index}" class="accordion-collapse collapse ${
        index === 0 ? "show" : ""
      }" 
                         aria-labelledby="heading${index}" data-bs-parent="#faqList">
                        <div class="accordion-body">
                            ${escapeHtml(faq.answer)}
                        </div>
                    </div>
                </div>
            `;
    });

    faqList.innerHTML = accordionHTML;

    // Reinitialize AOS for dynamically added content
    if (typeof AOS !== "undefined") {
      AOS.refresh();
    }
  }

  // Helper function to prevent XSS
  function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // Function to filter FAQs based on search input
  function filterFaqs(faqs, searchTerm) {
    if (!searchTerm) return faqs;

    return faqs.filter(
      (faq) =>
        faq.question.toLowerCase().includes(searchTerm) ||
        faq.answer.toLowerCase().includes(searchTerm)
    );
  }

  // Function to show loading state
  function showLoading() {
    faqList.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <p class="mt-3">Loading FAQs...</p>
            </div>
        `;
  }

  // Function to show error state
  function showError(message) {
    faqList.innerHTML = `
            <div class="no-faqs">
                <i class="fas fa-exclamation-triangle"></i>
                <h4>Unable to Load FAQs</h4>
                <p>${message || "Please try again later."}</p>
            </div>
        `;
  }

  // Fetch FAQs from your backend API
  async function loadFaqs() {
    showLoading();

    try {
      const response = await fetch(`${window.API_BASE_URL}/api/faqs`);

      if (!response.ok) {
        throw new Error(
          `Server returned ${response.status}: ${response.statusText}`
        );
      }

      const faqs = await response.json();
      displayFaqs(faqs);

      // Add event listener for search input if it exists
      if (faqSearch) {
        faqSearch.addEventListener("input", () => {
          const filteredFaqs = filterFaqs(faqs, faqSearch.value.toLowerCase());
          displayFaqs(filteredFaqs);
        });
      }
    } catch (error) {
      console.error("Error loading FAQs:", error);
      showError(
        "Failed to load FAQs. Please check your connection and try again."
      );
    }
  }

  // Initialize the FAQ section
  loadFaqs();
});
