function checkStaffAdminAccess() {
  const token = sessionStorage.getItem("token");
  const userLevel = sessionStorage.getItem("userLevel");

  // Check if user is logged in
  if (!token) {
    Swal.fire({
      icon: "warning",
      title: "Login Required",
      text: "Please log in to access this page.",
      confirmButtonColor: "#2c9045",
    }).then(() => {
      window.location.href = "/customer/login.html";
    });
    return false;
  }

  // Check if user is staff or admin
  if (userLevel !== "Staff" && userLevel !== "Admin") {
    Swal.fire({
      icon: "error",
      title: "Access Denied",
      text: "This page is for staff or administrator accounts only.",
      confirmButtonColor: "#2c9045",
    }).then(() => {
      window.location.href = "/customer/index.html";
    });
    return false;
  }

  return true;
}

// Auto-check on page load
document.addEventListener("DOMContentLoaded", function () {
  checkStaffAdminAccess();
});
