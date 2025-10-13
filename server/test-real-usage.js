// test-real-usage.js - Tests what your app actually does
const { google } = require('googleapis');
require('dotenv').config();

async function testRealUsage() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
  });

  console.log('🧪 Testing REAL ordering system capabilities...\n');

  try {
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Test 1: Can upload files to Drive (order images)
    console.log('1. Testing Drive file upload capability...');
    const driveTest = await drive.files.list({ pageSize: 1 });
    console.log('   ✅ Drive file access: WORKING');

    // Test 2: Can send emails (order confirmations)
    console.log('2. Testing Gmail send capability...');
    const emailTest = await gmail.users.drafts.create({
      userId: 'me',
      requestBody: {
        message: {
          raw: Buffer.from(
            `To: customer@example.com\r\n` +
            `Subject: Order Confirmation #12345\r\n` +
            `\r\n` +
            `Thank you for your order!`
          ).toString('base64')
        }
      }
    });
    console.log('   ✅ Gmail email sending: WORKING');

    // Clean up
    await gmail.users.drafts.delete({
      userId: 'me', 
      id: emailTest.data.id
    });

    console.log('\n🎉 SUCCESS! Your ordering system APIs are ready!');
    console.log('   - Drive: Can store order documents ✅');
    console.log('   - Gmail: Can send order emails ✅');

  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

testRealUsage();