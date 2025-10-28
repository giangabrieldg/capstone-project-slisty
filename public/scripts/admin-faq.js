document.addEventListener("DOMContentLoaded", () => {
  const faqsTableBody = document.getElementById("faqsTableBody");
  const faqForm = document.getElementById("faqForm");
  const faqModal = new bootstrap.Modal(document.getElementById("faqModal"));
  const modalTitle = document.getElementById("faqModalLabel");
  const questionInput = document.getElementById("question");
  const answerInput = document.getElementById("answer");
  const editQuestionInput = document.getElementById("editQuestion");

  // Load FAQs from backend
  async function loadFaqs() {
    try {
      // Show loading state
      faqsTableBody.innerHTML =
        '<tr><td colspan="3" class="text-center">Loading FAQs...</td></tr>';

      const response = await fetch(`${window.API_BASE_URL}/api/faqs`);
      if (!response.ok) throw new Error("Failed to fetch FAQs");

      const faqs = await response.json();

      if (faqs.length === 0) {
        faqsTableBody.innerHTML =
          '<tr><td colspan="3" class="text-center">No FAQs found.</td></tr>';
        return;
      }

      faqsTableBody.innerHTML = faqs
        .map(
          (faq) => `
        <tr>
          <td>${escapeHtml(faq.question)}</td>
          <td>${escapeHtml(faq.answer)}</td>
          <td>
            <button class="edit-faq" data-question="${escapeHtml(
              faq.question
            )}" data-answer="${escapeHtml(faq.answer)}" title="Edit">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="remove-faq" data-question="${escapeHtml(
              faq.question
            )}" title="Remove">
              <i class="bi bi-trash"></i>
            </button>
          </td>
        </tr>
      `
        )
        .join("");
    } catch (error) {
      console.error("Error loading FAQs:", error);
      faqsTableBody.innerHTML =
        '<tr><td colspan="3" class="text-center text-danger">Unable to load FAQs.</td></tr>';
    }
  }

  // Helper function to prevent XSS
  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // Event delegation for edit/remove buttons
  faqsTableBody.addEventListener("click", (e) => {
    if (e.target.classList.contains("edit-faq")) {
      modalTitle.textContent = "Edit FAQ";
      const question = e.target.dataset.question;
      const answer = e.target.dataset.answer;
      questionInput.value = question;
      answerInput.value = answer;
      editQuestionInput.value = question;
      faqModal.show();
    }

    if (e.target.classList.contains("remove-faq")) {
      if (
        confirm(
          `Are you sure you want to delete the FAQ: "${e.target.dataset.question}"?`
        )
      ) {
        deleteFaq(e.target.dataset.question);
      }
    }
  });

  // Delete FAQ
  async function deleteFaq(question) {
    try {
      const response = await fetch(
        `${window.API_BASE_URL}/api/faqs/${encodeURIComponent(question)}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) throw new Error("Failed to delete FAQ");

      loadFaqs();
    } catch (error) {
      console.error("Error deleting FAQ:", error);
      Swal.fire({
        icon: "error",
        title: "Oops...",
        text: "Failed to delete FAQ.",
        confirmButtonColor: "#2c9045",
      });
    }
  }

  // Add new FAQ button
  document.querySelector(".add-faq-btn").addEventListener("click", () => {
    modalTitle.textContent = "Add New FAQ";
    faqForm.reset();
    editQuestionInput.value = "";
    faqModal.show();
  });

  // Handle form submission
  faqForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const question = questionInput.value;
    const answer = answerInput.value;
    const editQuestion = editQuestionInput.value;

    try {
      const method = editQuestion ? "PUT" : "POST";
      const url = editQuestion
        ? `${window.API_BASE_URL}/api/faqs/${encodeURIComponent(editQuestion)}`
        : `${window.API_BASE_URL}/api/faqs`;

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, answer }),
      });

      if (!response.ok) throw new Error("Failed to save FAQ");

      faqModal.hide();
      faqForm.reset();
      loadFaqs();
    } catch (error) {
      console.error("Error saving FAQ:", error);
      Swal.fire({
        icon: "error",
        title: "Oops...",
        text: "Failed to save FAQ.",
        confirmButtonColor: "#2c9045",
      });
    }
  });

  // Initial load
  loadFaqs();
});
