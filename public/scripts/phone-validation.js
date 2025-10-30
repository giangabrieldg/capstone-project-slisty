// Phone number input validation
const phoneInput = document.getElementById("contactNumber");
const phoneError = document.getElementById("phoneError");

phoneInput.addEventListener("input", function () {
  // Allow only digits
  this.value = this.value.replace(/\D/g, "");

  if (this.value.length > 11) {
    this.value = this.value.slice(0, 11);
  }

  // Hide error while typing
  phoneError.style.display = "none";
});

phoneInput.addEventListener("blur", function () {
  const isValid = /^09\d{9}$/.test(this.value);
  if (!isValid && this.value.length > 0) {
    phoneError.style.display = "block";
  } else {
    phoneError.style.display = "none";
  }
});
