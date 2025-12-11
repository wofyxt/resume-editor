// Функция для регистрации
async function registerUser(event) {
    event.preventDefault();
    
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    // Простая валидация
    if (password !== confirmPassword) {
        alert('Пароли не совпадают!');
        return;
    }
    
    if (password.length < 8) {
        alert('Пароль должен быть минимум 8 символов!');
        return;
    }
    
    try {
        const response = await fetch('http://localhost:3000/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Сохраняем токен в localStorage
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            alert('Регистрация успешна!');
            window.location.href = 'dashboard.html'; // Перенаправляем на защищенную страницу
        } else {
            alert(data.error || 'Ошибка регистрации');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка подключения к серверу');
    }
}

// Функция для входа
async function loginUser(event) {
    event.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    try {
        const response = await fetch('http://localhost:3000/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Сохраняем токен в localStorage
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            alert('Вход успешен!');
            window.location.href = 'dashboard.html';
        } else {
            alert(data.error || 'Ошибка входа');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка подключения к серверу');
    }
}

// Функция проверки авторизации
async function checkAuth() {
    const token = localStorage.getItem('token');
    
    if (!token) {
        // Если нет токена, перенаправляем на страницу входа
        if (!window.location.href.includes('login.html') && 
            !window.location.href.includes('registration.html')) {
            window.location.href = 'login.html';
        }
        return null;
    }
    
    try {
        const response = await fetch('http://localhost:3000/api/verify', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'login.html';
            return null;
        }
        
        return token;
    } catch (error) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
        return null;
    }
}

// Выход из системы
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}