function checkCustomerAccess() {
  const token = sessionStorage.getItem("token");
  const userLevel = sessionStorage.getItem("userLevel");

  // Only check userLevel if user is logged in (has token)
  if (token && (userLevel === "Staff" || userLevel === "Admin")) {
    Swal.fire({
      icon: "warning",
      title: "Access Denied",
      text: "This page is for customer accounts only.",
      confirmButtonColor: "#2c9045",
    }).then(() => {
      // Redirect to appropriate dashboard
      if (userLevel === "Staff") {
        window.location.href = "/staff/staff-dashboard.html";
      } else if (userLevel === "Admin") {
        window.location.href = "/admin/admin-dashboard.html";
      }
    });
    return false;
  }

  return true;
}

// Auto-check on page load
document.addEventListener("DOMContentLoaded", function () {
  checkCustomerAccess();
});
