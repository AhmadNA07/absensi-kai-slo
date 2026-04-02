// Cek autentikasi
function checkAuth() {
    const isLoggedIn = sessionStorage.getItem('isLoggedIn');
    const currentPage = window.location.pathname.split('/').pop();
    
    if (!isLoggedIn && currentPage !== 'index.html') {
        window.location.href = 'index.html';
    }
}

// Login
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const password = document.getElementById('password').value;
            
            // Gunakan APP_PASSWORD dari config
            if (typeof APP_PASSWORD !== 'undefined' && password === APP_PASSWORD) {
                sessionStorage.setItem('isLoggedIn', 'true');
                // Redirect ke admin (bisa diubah sesuai kebutuhan)
                window.location.href = 'siswa.html';
            } else {
                alert('Password salah!');
            }
        });
    }
    
    checkAuth();
});

// Logout
function logout() {
    sessionStorage.removeItem('isLoggedIn');
    window.location.href = 'index.html';
}