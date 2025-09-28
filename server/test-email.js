// test-email-real.js
const { sendVerificationEmail, verifyConnection } = require('./utils/sendEmail');

async function testRealEmail() {
  console.log('Testing real email sending...');
  
  const connected = await verifyConnection();
  console.log('Connected:', connected);
  
  if (connected) {
    // Send to a real email you can check
    await sendVerificationEmail('your-real-email@gmail.com', 'test-token-123', 'Test Email from Localhost');
  }
}

testRealEmail();