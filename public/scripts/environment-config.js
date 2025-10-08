(function() {
    // Define API_BASE_URL once globally
    window.API_BASE_URL = window.location.origin === 'http://localhost:3000'
        ? 'http://localhost:3000'
        : 'https://capstone-project-slisty.onrender.com';
    
    console.log('API Base URL configured:', window.API_BASE_URL);
})();