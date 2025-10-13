/**
 * scripts/exchange-code.js
 * Exchange authorization code for refresh token
 */
require('dotenv').config();
const { google } = require('googleapis');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/callback'
);

async function exchangeCode(code) {
  try {
    console.log('🔄 Exchanging code for tokens...');
    
    const { tokens } = await oauth2Client.getToken(code);
    
    console.log('\n🎉 SUCCESS! Here is your new refresh token:\n');
    console.log('==============================================');
    console.log(tokens.refresh_token);
    console.log('==============================================\n');
    
    console.log('📝 INSTRUCTIONS:');
    console.log('1. Update your LOCAL .env file:');
    console.log(`   GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
    
    console.log('2. Update your RENDER environment variables:');
    console.log('   - Go to Render Dashboard → Your Service → Environment');
    console.log('   - Update GOOGLE_REFRESH_TOKEN with the above value\n');
    
    console.log('3. Test the new token:');
    console.log('   node scripts/test-token.js\n');
    
    console.log('✅ Your token should now work for both localhost and Render!');
    
    return tokens;
    
  } catch (error) {
    console.error('❌ Failed to exchange code:', error.message);
    console.log('\n💡 TIPS:');
    console.log('- Make sure the code is fresh (codes expire quickly)');
    console.log('- Check your Google Cloud Console OAuth credentials');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  const code = process.argv[2];
  if (!code) {
    console.error('❌ Please provide an authorization code:');
    console.log('Usage: node scripts/exchange-code.js YOUR_CODE_HERE');
    process.exit(1);
  }
  exchangeCode(code);
}

module.exports = { exchangeCode };