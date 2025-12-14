const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const cors = require('cors');
require('dotenv').config();
const { pool, createTables } = require('./database.js');
const captchaStore = {};
const path = require('path');
const app = express();
const { google } = require('googleapis');
const PORT = process.env.PORT || 3000;
const fs = require('fs');

// Настройка сервера
app.use(cors());
app.use(express.json()); // Для чтения JSON из запросов
app.use(express.static(path.join(__dirname, '..', 'public')));
const router = express.Router(); //
// Создаем таблицы при запуске
createTables();

// ========== РЕГИСТРАЦИЯ ==========
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        
        // Проверяем, есть ли уже такой email
        const userCheck = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );
        
        if (userCheck.rows.length > 0) {
            return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
        }
        
        // Хешируем пароль
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        
        // Сохраняем пользователя в БД
        const result = await pool.query(
            `INSERT INTO users (name, email, password_hash) 
             VALUES ($1, $2, $3) 
             RETURNING user_id, name, email, created_at`,
            [name, email, passwordHash]
        );
        
        // Создаем JWT токен
        const token = jwt.sign(
            {
                userId: result.rows[0].user_id,
                email: result.rows[0].email
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        res.json({
            message: 'Регистрация успешна',
            token: token,
            user: {
                id: result.rows[0].user_id,
                name: result.rows[0].name,
                email: result.rows[0].email
            }
        });
        
    } catch (error) {
        console.error('Ошибка регистрации:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ========== ЛОГИН ==========
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Ищем пользователя в БД
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );
        
        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Неверный email' });
        }
        
        const user = result.rows[0];
        
        // Проверяем пароль
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        
        if (!isPasswordValid) {
            return res.status(400).json({ error: 'Неверный email или пароль' });
        }
        
        // Создаем JWT токен
        const token = jwt.sign(
            {
                userId: user.user_id,
                email: user.email
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        
      
         // Стало:
res.json({
  message: 'Вход успешен',
  token: token, // <-- Токен по-прежнему возвращается в JSON
  user: {
      id: user.user_id,
      name: user.name,
      email: user.email
  }
});
        
        
    } catch (error) {
        console.error('Ошибка входа:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ========== ПРОВЕРКА ТОКЕНА ==========
app.get('/api/verify', (req, res) => {
    try {
        // Получаем токен из заголовка
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ error: 'Токен не предоставлен' });
        }
        
        // Проверяем токен
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        res.json({
            valid: true,
            user: decoded
        });
        
    } catch (error) {
        res.status(401).json({ error: 'Неверный токен' });
    }
});

// ========== ЗАЩИЩЕННЫЙ МАРШРУТ ==========
app.get('/api/profile', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ error: 'Токен не предоставлен' });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Получаем данные пользователя из БД
        const result = await pool.query(
            'SELECT user_id, name, avatar_url, email, created_at FROM users WHERE user_id = $1',
            [decoded.userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        
        res.json({
            user: result.rows[0]
        });
        
    } catch (error) {
        res.status(401).json({ error: 'Неверный токен' });
    }
});

// ... (все остальные импорты и настройки в server.js) ...

// ========== НОВЫЙ МАРШРУТ: СОХРАНЕНИЕ РЕЗЮМЕ ==========
app.post('/api/resumes', async (req, res) => {
    try {
        console.log("Получен запрос на сохранение резюме:", req.body); // Логирование запроса

        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            console.error("Токен не предоставлен в заголовке Authorization");
            return res.status(401).json({ error: 'Токен не предоставлен' });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            console.error("Ошибка проверки токена:", err.message);
            return res.status(401).json({ error: 'Неверный или просроченный токен' });
        }
        const userId = decoded.userId;
        console.log("Токен проверен, userId:", userId); // Логирование userId

        const { title, data } = req.body;

        if (!title || !data) {
            console.error("Отсутствует 'title' или 'data' в теле запроса:", req.body);
            return res.status(400).json({ error: 'Отсутствует название резюме (title) или данные (data)' });
        }

        if (typeof data !== 'object' || data === null) {
            console.error("Поле 'data' не является объектом или равно null:", typeof data, data);
            return res.status(400).json({ error: 'Поле "data" должно быть объектом' });
        }

        // Проверим, что пользователь существует (опционально, но надёжнее)
        const userCheck = await pool.query('SELECT user_id FROM users WHERE user_id = $1', [userId]);
        if (userCheck.rows.length === 0) {
            console.error("Пользователь с ID не найден в БД:", userId);
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        const result = await pool.query(
            `INSERT INTO resumes (user_id, title, data)
             VALUES ($1, $2, $3)
             RETURNING resume_id, title, created_at`,
            [userId, title, data]
        );

        console.log("Резюме успешно сохранено:", result.rows[0]); // Логирование успешного сохранения

        res.status(201).json({
            message: 'Резюме успешно сохранено',
            resume: result.rows[0]
        });

    } catch (error) {
        console.error('Полная ошибка в эндпоинте /api/resumes:', error); // Логирование полной ошибки
        // Возвращаем общее сообщение, чтобы не раскрывать внутренние детали сервера
        res.status(500).json({ error: 'Ошибка сервера при сохранении резюме' });
    }
});

// ========== НОВЫЙ МАРШРУТ: ПОЛУЧЕНИЕ РЕЗЮМЕ ПОЛЬЗОВАТЕЛЯ ==========
app.get('/api/resumes', async (req, res) => {
    try {
        console.log("Получен запрос на получение резюме пользователя");

        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            console.error("Токен не предоставлен в заголовке Authorization для GET /api/resumes");
            return res.status(401).json({ error: 'Токен не предоставлен' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId;

        const result = await pool.query(
            `SELECT resume_id, title, created_at, updated_at
             FROM resumes
             WHERE user_id = $1
             ORDER BY created_at DESC`,
            [userId]
        );

        res.json({
            resumes: result.rows
        });

    } catch (error) {
        console.error('Полная ошибка в эндпоинте GET /api/resumes:', error);
        res.status(500).json({ error: 'Ошибка сервера при получении резюме' });
    }
});

// ========== НОВЫЙ МАРШРУТ: ПОЛУЧЕНИЕ КОНКРЕТНОГО РЕЗЮМЕ ==========
app.get('/api/resumes/:resumeId', async (req, res) => {
    try {
        console.log("Получен запрос на получение конкретного резюме:", req.params.resumeId);

        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            console.error("Токен не предоставлен в заголовке Authorization для GET /api/resumes/:resumeId");
            return res.status(401).json({ error: 'Токен не предоставлен' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId;
        const resumeId = parseInt(req.params.resumeId);

        if (isNaN(resumeId)) {
            console.error("Некорректный ID резюме:", req.params.resumeId);
            return res.status(400).json({ error: 'Некорректный ID резюме' });
        }

        const result = await pool.query(
            `SELECT resume_id, title, data, created_at, updated_at
             FROM resumes
             WHERE user_id = $1 AND resume_id = $2`,
            [userId, resumeId]
        );

        if (result.rows.length === 0) {
            console.error("Резюме не найдено для пользователя", userId, "и ID", resumeId);
            return res.status(404).json({ error: 'Резюме не найдено' });
        }

        res.json({
            resume: result.rows[0]
        });

    } catch (error) {
        console.error('Полная ошибка в эндпоинте GET /api/resumes/:resumeId:', error);
        res.status(500).json({ error: 'Ошибка сервера при получении резюме' });
    }
});

// ========== НОВЫЙ МАРШРУТ: ОБНОВЛЕНИЕ РЕЗЮМЕ ==========
app.put('/api/resumes/:resumeId', async (req, res) => {
    try {
        console.log("Получен запрос на обновление резюме:", req.params.resumeId, "с данными:", req.body);

        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            console.error("Токен не предоставлен в заголовке Authorization для PUT /api/resumes/:resumeId");
            return res.status(401).json({ error: 'Токен не предоставлен' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId;
        const resumeId = parseInt(req.params.resumeId);

        if (isNaN(resumeId)) {
            console.error("Некорректный ID резюме для обновления:", req.params.resumeId);
            return res.status(400).json({ error: 'Некорректный ID резюме' });
        }

        const { title, data } = req.body;

        if (!title || !data) {
            console.error("Отсутствует 'title' или 'data' в теле запроса для обновления:", req.body);
            return res.status(400).json({ error: 'Отсутствует название резюме (title) или данные (data)' });
        }

        if (typeof data !== 'object' || data === null) {
            console.error("Поле 'data' не является объектом или равно null при обновлении:", typeof data, data);
            return res.status(400).json({ error: 'Поле "data" должно быть объектом' });
        }

        const result = await pool.query(
            `UPDATE resumes
             SET title = $1, data = $2, updated_at = CURRENT_TIMESTAMP
             WHERE user_id = $3 AND resume_id = $4
             RETURNING resume_id, title, updated_at`,
            [title, data, userId, resumeId]
        );

        if (result.rows.length === 0) {
            console.error("Резюме не найдено для обновления пользователем", userId, "и ID", resumeId);
            return res.status(404).json({ error: 'Резюме не найдено или не принадлежит пользователю' });
        }

        res.json({
            message: 'Резюме успешно обновлено',
            resume: result.rows[0]
        });

    } catch (error) {
        console.error('Полная ошибка в эндпоинте PUT /api/resumes/:resumeId:', error);
        res.status(500).json({ error: 'Ошибка сервера при обновлении резюме' });
    }
});

// ========== НОВЫЙ МАРШРУТ: УДАЛЕНИЕ РЕЗЮМЕ ==========
app.delete('/api/resumes/:resumeId', async (req, res) => {
    try {
        console.log("Получен запрос на удаление резюме:", req.params.resumeId);

        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            console.error("Токен не предоставлен в заголовке Authorization для DELETE /api/resumes/:resumeId");
            return res.status(401).json({ error: 'Токен не предоставлен' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId;
        const resumeId = parseInt(req.params.resumeId);

        if (isNaN(resumeId)) {
            console.error("Некорректный ID резюме для удаления:", req.params.resumeId);
            return res.status(400).json({ error: 'Некорректный ID резюме' });
        }

        const result = await pool.query(
            `DELETE FROM resumes
             WHERE user_id = $1 AND resume_id = $2
             RETURNING resume_id`,
            [userId, resumeId]
        );

        if (result.rows.length === 0) {
            console.error("Резюме не найдено для удаления пользователем", userId, "и ID", resumeId);
            return res.status(404).json({ error: 'Резюме не найдено или не принадлежит пользователю' });
        }

        res.json({
            message: 'Резюме успешно удалено'
        });

    } catch (error) {
        console.error('Полная ошибка в эндпоинте DELETE /api/resumes/:resumeId:', error);
        res.status(500).json({ error: 'Ошибка сервера при удалении резюме' });
    }
});
app.get('/api/captcha', (req, res) => {
    console.log("Запрос на генерацию CAPTCHA");
    const captcha = require('svg-captcha').create({
        size: 5, // количество символов
        ignoreChars: '0o1i', // исключить похожие символы
        noise: 2, // количество шумовых линий
        color: true, // использовать цвет
        background: '#f0f0f0' // цвет фона
    });

    // Генерируем случайный ключ для хранения CAPTCHA
    const captchaKey = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    // Сохраняем код по ключу
    captchaStore[captchaKey] = captcha.text.toLowerCase(); // Сохраняем в нижнем регистре для проверки

    // Удаляем старые CAPTCHA (например, старше 5 минут) каждые 5 минут
    setTimeout(() => {
        delete captchaStore[captchaKey];
        console.log(`CAPTCHA с ключом ${captchaKey} удалена из памяти.`);
    }, 5 * 60 * 1000); // 5 минут в миллисекундах

    console.log(`Сгенерирована CAPTCHA с ключом ${captchaKey}: ${captcha.text}`);

    // Отправляем SVG и ключ клиенту
    res.json({
        captcha: captcha.data, // SVG-данные
        key: captchaKey       // Ключ для проверки
    });
});

// Маршрут для проверки CAPTCHA
app.post('/api/verify-captcha', (req, res) => {
    console.log("Запрос на проверку CAPTCHA");
    const { key, answer } = req.body;

    if (!key || !answer) {
        console.error("Отсутствует ключ или ответ в запросе проверки CAPTCHA");
        return res.status(400).json({ success: false, message: 'Отсутствует ключ или ответ.' });
    }

    const storedCaptcha = captchaStore[key];

    if (!storedCaptcha) {
        console.error("CAPTCHA с указанным ключом не найдена или истекла");
        return res.status(400).json({ success: false, message: 'Код CAPTCHA истек или недействителен. Пожалуйста, обновите.' });
    }

    // Проверяем ответ (регистронезависимо)
    const isCorrect = storedCaptcha === answer.toLowerCase();

    if (isCorrect) {
        // Удаляем использованный код
        delete captchaStore[key];
        console.log("CAPTCHA успешно проверена.");
        res.json({ success: true, message: 'CAPTCHA пройдена.' });
    } else {
        console.error(`Неверный ответ на CAPTCHA. Ожидалось: ${storedCaptcha}, Получено: ${answer}`);
        res.status(400).json({ success: false, message: 'Неверный код CAPTCHA.' });
    }
});
const session = require('express-session');
// ========== КОНЕЦ МАРШРУТОВ ДЛЯ CAPTCHA ==========
// Настройка сессий (обязательно для OAuth)
app.use(session({
  secret: 'your-super-secret-session-key',
  resave: false,
  saveUninitialized: true,
}));

// OAuth2 клиент (заполните своими данными)
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'http://localhost:3000/auth/google/callback'
);

const drive = google.drive({ version: 'v3', auth: oauth2Client });

// Роут: инициализация Google Auth
app.get('/auth/google', (req, res) => {
  const scopes = ['https://www.googleapis.com/auth/drive.file'];
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent' // чтобы получить refresh_token при первом входе
  });
   console.log('OAuth URL:', url); // ← добавьте это для отладки
  res.redirect(url);
});

// Роут: обратный вызов после авторизации
app.get('/auth/google/callback', async (req, res) => {
  const { code } = req.query;
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    req.session.tokens = tokens; // сохраняем токены в сессию
    res.redirect('/resume-builder.html'); // или куда нужно
  } catch (e) {
    console.error('OAuth callback error:', e);
    res.status(500).send('Ошибка авторизации Google');
  }
});

// Роут: выгрузка PDF в Google Drive
app.post('/api/export-to-drive', async (req, res) => {
  const tokens = req.session?.tokens;
  if (!tokens) {
    return res.status(401).json({ error: 'Не авторизован в Google' });
  }

  // Получаем title и resumeData из тела запроса
  const { title, resumeData } = req.body; // resumeData — это объект с HTML или PDF-буфером
  if (!title || !resumeData) {
    return res.status(400).json({ error: 'title и resumeData обязательны' });
  }

  try {
    oauth2Client.setCredentials(tokens);

    // Вариант 1: загрузка PDF-файла (если у вас уже есть PDF-буфер)
    // Например: resumeData.pdfBuffer — Buffer, полученный через jsPDF + html2canvas на backend

    // Вариант 2 (проще): сохраняем HTML как .html или .pdf на лету через Puppeteer + jsPDF (по желанию)
    // Но для MVP допустимо — сохранить HTML как файл (Google Drive поддерживает preview)

    // Генерируем HTML-строку из resumeData (пример):
    const htmlContent = `
      <!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
        <h1>${title}</h1>
        <div>${resumeData.personalInfo.fullName}</div>
        <!-- ... остальное из resumeData ... -->
      </body></html>
    `;

    // Альтернатива: передайте уже готовый **PDF в base64** из фронтенда

    // Загрузка как HTML-файл (просто для демо)
    const fileMetadata = {
      name: `${title}.html`,
      mimeType: 'text/html',
    };

    const media = {
      mimeType: 'text/html',
      body: htmlContent,
    };

    const response = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, webViewLink, webContentLink',
    });

    res.json({
      success: true,
      fileId: response.data.id,
      viewUrl: response.data.webViewLink,
      downloadUrl: response.data.alternateLink,
    });
  } catch (e) {
    console.error('Google Drive export error:', e);
    res.status(500).json({ error: 'Ошибка загрузки в Google Drive', details: e.message });
  }
});
// ... (остальной код сервера) ...


// --- МАРШРУТЫ ---


// ========== НОВЫЙ МАРШРУТ: ОБНОВЛЕНИЕ АВАТАРА ==========
// Настройка multer для загрузки аватаров (как у вас уже есть)
const avatarStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'public/uploads/avatars/'; // Папка для сохранения аватаров
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    // Извлекаем userId из токена (так же, как в других маршрутах)
    const token = req.headers.authorization?.split(' ')[1];
    let userId = 'unknown'; // Значение по умолчанию на случай ошибки
    try {
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.userId;
      } else {
        // Если токен не передан, multer не вызовет обработчик маршрута, но на всякий случай
        return cb(new Error('Токен не предоставлен для генерации имени файла'), false);
      }
    } catch (err) {
      console.error('Ошибка извлечения userId для имени файла:', err.message);
      // Важно: не возвращайте cb с ошибкой здесь, т.к. это произойдет до проверки токена в маршруте
      // Лучше обработать ошибку в самом маршруте, как это делается ниже
    }
    cb(null, 'avatar_' + userId + '_' + uniqueSuffix + ext);
  }
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Файл должен быть изображением (jpeg, png, gif, etc.)'), false);
    }
  }
});

// server.js (замените ваш существующий маршрут PUT /api/profile/avatar на этот)

app.put('/api/profile/avatar', async (req, res) => {
  try {
    console.log("Получен запрос на обновление аватара");

    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      console.error("Токен не предоставлен в заголовке Authorization для PUT /api/profile/avatar");
      return res.status(401).json({ error: 'Токен не предоставлен' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      console.error("Ошибка проверки токена при обновлении аватара:", err.message);
      return res.status(401).json({ error: 'Неверный или просроченный токен' });
    }
    const userId = decoded.userId;
    console.log("Токен проверен, userId:", userId); // Лог: проверка userId

    // Проверяем, что файл был загружен
    await new Promise((resolve, reject) => {
      avatarUpload.single('avatar')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return reject(new Error('Файл слишком большой. Максимальный размер 5MB.'));
          }
          // Добавьте другие ошибки multer по необходимости
        } else if (err) {
          return reject(err);
        }
        resolve();
      });
    });

    if (!req.file) {
      console.error("Файл не был загружен или тип файла недопустим.");
      return res.status(400).json({ error: 'Файл не был загружен или тип файла недопустим.' });
    }

    const newAvatarFilename = req.file.filename;
    const newAvatarPath = `/uploads/avatars/${newAvatarFilename}`;
    console.log("Новый путь к аватару:", newAvatarPath); // Лог: проверка пути

    // Получить текущий аватар из БД для последующего удаления старого файла (опционально)
    // Извлекаем также имя пользователя для ответа
    const currentUserQuery = await pool.query('SELECT avatar_url, name FROM users WHERE user_id = $1', [userId]);
    console.log("Результат запроса к БД (получение текущего аватара):", currentUserQuery); // Лог: проверка результата запроса
    console.log("Количество строк результата:", currentUserQuery.rows.length); // Лог: количество строк

    if (currentUserQuery.rows.length === 0) {
      // Пользователь не найден, хотя токен валидный - странная ситуация
      console.error("Пользователь не найден в БД при попытке обновить аватар для userId:", userId);
      // Удаляем загруженный файл
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    const currentAvatarPath = currentUserQuery.rows[0]?.avatar_url;
    const userName = currentUserQuery.rows[0]?.name; // Для ответа клиенту
    console.log("Старый путь к аватару (если был):", currentAvatarPath); // Лог: старый путь

    // --- КЛЮЧЕВОЙ ЛОГ ---
    console.log("SQL UPDATE запрос: UPDATE users SET avatar_url = $1 WHERE user_id = $2");
    console.log("Параметры запроса: [$1: ", newAvatarPath, ", $2: ", userId, "]"); // Лог: параметры запроса

    // Обновить запись в БД
    const updateResult = await pool.query(
      'UPDATE users SET avatar_url = $1 WHERE user_id = $2',
      [newAvatarPath, userId]
    );

    console.log("Результат выполнения UPDATE запроса:", updateResult); // Лог: результат UPDATE

    // Проверяем, был ли обновлен хотя бы один ряд
    if (updateResult.rowCount === 0) {
      console.error("UPDATE запрос не обновил ни одной строки для userId:", userId);
      // Удаляем загруженный файл, так как БД не изменилась
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Пользователь не найден или не был обновлен' });
    }

    // Удалить старый файл с диска (опционально, но рекомендуется)
   if (currentAvatarPath && currentAvatarPath.startsWith('/uploads/avatars/')) {
        const fullPath = path.join(__dirname, 'public', currentAvatarPath);
         if (fs.existsSync(fullPath)) {
           fs.unlinkSync(fullPath);
           console.log(`Старый аватар удален: ${fullPath}`);
         }
    }

    // Отправляем клиенту новый URL аватара и имя пользователя (для заглушки)
    res.json({
        message: 'Аватар успешно обновлен',
        avatarUrl: newAvatarPath,
        userName: userName
    });

  } catch (error) {
    console.error('Ошибка обновления аватара:', error);
    // Удаляем загруженный файл, если произошла ошибка при обновлении БД
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
        console.log(`Файл ${req.file.path} удален из-за ошибки.`);
    }
    if (error.message && error.message.includes('Файл слишком большой')) {
        return res.status(400).json({ error: error.message });
    }
    if (error.message && error.message.includes('Файл должен быть изображением')) {
        return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Ошибка сервера при обновлении аватара' });
  }
});

// ========== ОБНОВЛЕНИЕ МАРШРУТА: ПОЛУЧЕНИЕ ПРОФИЛЯ ==========
// Обновляем существующий маршрут /api/profile, чтобы он возвращал avatar_url
app.get('/api/profile', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
  try {
    console.log("Получен запрос на получение профиля");
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      console.error("Токен не предоставлен в заголовке Authorization для GET /api/profile");
      return res.status(401).json({ error: 'Токен не предоставлен' });
    }

    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
        console.error("Ошибка проверки токена при получении профиля:", err.message);
        return res.status(401).json({ error: 'Неверный или просроченный токен' });
    }
    const userId = decoded.userId;

    // Обновляем запрос, чтобы выбрать avatar_url
    const result = await pool.query(
      'SELECT user_id, name, email, avatar_url, created_at FROM users WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      console.error("Пользователь не найден в БД при попытке получить профиль для userId:", userId);
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.json({
        user: result.rows[0] // Включает avatar_url
    });

  } catch (error) {
    console.error('Ошибка получения профиля:', error);
    res.status(500).json({ error: 'Ошибка сервера при получении профиля' });
  }
});

// ... (остальные маршруты и запуск сервера) ...
// В основном файле вашего приложения (например, app.js или index.js)
// подключите этот router:
// const profileRoutes = require('./routes/profile'); // путь к этому файлу
// app.use('/api', profileRoutes); // или app.use('/api/profile', profileRoutes); в зависимости от структуры
// Запуск сервера
app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
    console.log(`Страница входа: http://localhost:${PORT}/login.html`);
    console.log(`Страница регистрации: http://localhost:${PORT}/registration.html`);
});