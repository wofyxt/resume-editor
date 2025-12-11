  // Mobile Menu Toggle
        const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
        const mobileMenu = document.querySelector('.mobile-menu');
        const closeMenu = document.querySelector('.close-menu');
        const overlay = document.querySelector('.overlay');
        
        mobileMenuBtn.addEventListener('click', () => {
            mobileMenu.classList.add('active');
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
        
        closeMenu.addEventListener('click', () => {
            mobileMenu.classList.remove('active');
            overlay.classList.remove('active');
            document.body.style.overflow = 'auto';
        });
        
        overlay.addEventListener('click', () => {
            mobileMenu.classList.remove('active');
            overlay.classList.remove('active');
            document.body.style.overflow = 'auto';
        });
        
     // --- КОД ДЛЯ РАБОТЫ С CAPTCHA ---
    let currentCaptchaKey = '';

    // Функция для загрузки новой CAPTCHA
    async function loadCaptcha() {
        console.log("Загрузка новой CAPTCHA...");
        try {
            const response = await fetch('http://localhost:3000/api/captcha');
            const data = await response.json();

            if (response.ok) {
                // Обновляем изображение CAPTCHA
                document.getElementById('captcha-image').src = `data:image/svg+xml;utf8,${encodeURIComponent(data.captcha)}`;
                // Сохраняем ключ
                currentCaptchaKey = data.key;
                document.getElementById('captcha-key').value = currentCaptchaKey;
                // Очищаем поле ввода и ошибку
                document.getElementById('captcha-input').value = '';
                document.getElementById('captcha-error').style.display = 'none';
                console.log("CAPTCHA загружена, ключ:", currentCaptchaKey);
            } else {
                console.error("Ошибка при загрузке CAPTCHA:", data.message);
                document.getElementById('captcha-error').textContent = 'Ошибка загрузки CAPTCHA. Пожалуйста, обновите страницу.';
                document.getElementById('captcha-error').style.display = 'block';
            }
        } catch (error) {
            console.error('Ошибка сети при загрузке CAPTCHA:', error);
            document.getElementById('captcha-error').textContent = 'Ошибка подключения к серверу при загрузке CAPTCHA.';
            document.getElementById('captcha-error').style.display = 'block';
        }
    }

    // Функция для проверки CAPTCHA на сервере
    async function verifyCaptcha(answer, key) {
        console.log("Проверка CAPTCHA на сервере...");
        try {
            const response = await fetch('http://localhost:3000/api/verify-captcha', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ answer, key })
            });

            const data = await response.json();

            if (response.ok) {
                console.log("CAPTCHA успешно пройдена.");
                document.getElementById('captcha-error').style.display = 'none';
                return true;
            } else {
                console.error("Ошибка проверки CAPTCHA:", data.message);
                document.getElementById('captcha-error').textContent = data.message;
                document.getElementById('captcha-error').style.display = 'block';
                // Загружаем новую CAPTCHA при ошибке
                loadCaptcha();
                return false;
            }
        } catch (error) {
            console.error('Ошибка сети при проверке CAPTCHA:', error);
            document.getElementById('captcha-error').textContent = 'Ошибка подключения к серверу при проверке CAPTCHA.';
            document.getElementById('captcha-error').style.display = 'block';
            return false;
        }
    }

    // --- ОБНОВЛЁННЫЙ ОБРАБОТЧИК ОТПРАВКИ ФОРМЫ ---
    document.getElementById('login-form').addEventListener('submit', async function(event) {
        event.preventDefault(); // Предотвращаем стандартную отправку формы

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const captchaInput = document.getElementById('captcha-input').value;
        const captchaKey = document.getElementById('captcha-key').value;

        // Проверяем, введена ли CAPTCHA
        if (!captchaInput) {
            document.getElementById('captcha-error').textContent = 'Пожалуйста, введите код с картинки.';
            document.getElementById('captcha-error').style.display = 'block';
            return;
        }

        // Сначала проверяем CAPTCHA на сервере
        const isCaptchaValid = await verifyCaptcha(captchaInput, captchaKey);
        if (!isCaptchaValid) {
            console.log("Проверка CAPTCHA не пройдена.");
            return; // Выходим из функции, если CAPTCHA неправильная
        }

        console.log("Проверка CAPTCHA пройдена. Отправляем данные на сервер.");

        // Если CAPTCHA правильная, отправляем данные входа
        try {
            const response = await fetch('http://localhost:3000/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                alert('Вход успешен!');
                window.location.href = 'dashboard.html';
            } else {
                // Сбросим CAPTCHA при ошибке входа
                loadCaptcha();
                alert(data.error || 'Ошибка входа');
            }
        } catch (error) {
            // Сбросим CAPTCHA при ошибке сети
            loadCaptcha();
            alert('Ошибка подключения к серверу');
        }
    });

    // Обработчик для кнопки "Обновить CAPTCHA"
    document.getElementById('refresh-captcha').addEventListener('click', loadCaptcha);

    // Загружаем первую CAPTCHA при загрузке страницы
    document.addEventListener('DOMContentLoaded', function() {
        loadCaptcha();
    });
    // --- /КОНЕЦ ОБНОВЛЁННОГО ОБРАБОТЧИКА ---