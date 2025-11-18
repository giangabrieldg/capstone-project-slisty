const verifyToken = require("./verifyToken");

const allowCustomerOnly = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user.userLevel !== "Customer") {
      return res.status(403).json({
        message: "Access denied: This page is for customer accounts only.",
      });
    }
    next();
  });
};

module.exports = allowCustomerOnly;
