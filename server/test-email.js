const gmailService = require('./utils/gmailService');

async function test() {
  console.log('Testing Gmail API...');
  const result = await gmailService.testConnection();
  console.log('Result:', result);
}

test();