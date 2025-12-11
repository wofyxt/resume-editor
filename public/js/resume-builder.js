// resume-builder.js

// Глобальные переменные для отслеживания режима редактирования
let isEditing = false;
let currentResumeId = null;

// Функция для сбора данных формы
function collectFormData() {
    // console.log("Сбор данных формы..."); // Логирование
    // Убираем title из formData, он будет передаваться отдельно
    const title = document.getElementById('resume-title').value || 'Мое Резюме';
    const personalInfo = {
        fullName: document.getElementById('fullName').value,
        jobTitle: document.getElementById('jobTitle').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        location: document.getElementById('location').value,
        summary: document.getElementById('summary').value,
    };
    const experience = [];
    document.querySelectorAll('#experienceContainer .dynamic-item').forEach(item => {
        const exp = {
            position: item.querySelector('.exp-position').value,
            company: item.querySelector('.exp-company').value,
            period: item.querySelector('.exp-period').value,
            description: item.querySelector('.exp-description').value
        };
        if (exp.position || exp.company || exp.period || exp.description) {
            experience.push(exp);
        }
    });
    const education = [];
    document.querySelectorAll('#educationContainer .dynamic-item').forEach(item => {
        const edu = {
            institution: item.querySelector('.edu-institution').value,
            degree: item.querySelector('.edu-degree').value,
            startYear: item.querySelector('.edu-start-year').value,
            endYear: item.querySelector('.edu-end-year').value,
        };
        if (edu.institution || edu.degree) { // Проверка на институт или степень
            education.push(edu);
        }
    });
    const skills = [];
    document.querySelectorAll('#skillsContainer .skill-tag').forEach(tag => {
        const skillText = tag.textContent.replace('×', '').trim();
        if (skillText) {
            skills.push(skillText);
        }
    });
    const template = document.querySelector('.template-option.active')?.getAttribute('data-template') || 'classic';

    const resumeData = {
        personalInfo,
        experience,
        education,
        skills,
        template
    };

    // console.log("Собранные данные для сохранения (resumeData):", resumeData); // Логирование
    return { title, data: resumeData }; // Возвращаем объект с title и data
}

// Функция для сохранения резюме на сервер
async function saveResume() {
    console.log("Вызов функции saveResume (режим:", isEditing ? "обновление" : "создание", ")");

    if (!validateAllFields()) {
        alert('Пожалуйста, исправьте ошибки в форме перед сохранением.');
        return;
    }

   const { title, data } = collectFormData(); // Новый способ
   

    const token = localStorage.getItem('token');
    if (!token) {
        console.error("Токен не найден в localStorage");
        alert('Пользователь не авторизован. Пожалуйста, войдите в систему.');
        window.location.href = 'login.html';
        return;
    }

    let endpoint = '/api/resumes';
    let method = 'POST';

    if (isEditing && currentResumeId) {
        endpoint = `/api/resumes/${currentResumeId}`;
        method = 'PUT'; // Используем PUT для обновления
    }

    try {
        console.log("Отправка запроса на сервер... Endpoint:", endpoint, "Method:", method);
        const response = await fetch(endpoint, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                title: title,
                data: data
            })
        });

        console.log("Ответ от сервера получен, статус:", response.status);

        const result = await response.json();
        console.log("Тело ответа от сервера:", result);

        if (response.ok) {
            if (method === 'POST') {
                alert('Резюме успешно создано и сохранено!');
                // Сбрасываем режим редактирования
                isEditing = false;
                currentResumeId = null;
                document.getElementById('saveBtn').textContent = 'Сохранить';
            } else { // PUT
                alert('Резюме успешно обновлено!');
            }
            console.log('Сохраненное/обновленное резюме:', result.resume);
        } else {
            alert(`Ошибка ${method === 'PUT' ? 'обновления' : 'сохранения'}: ${result.error || 'Неизвестная ошибка'}`);
            console.error('Ошибка сервера:', result.error);
        }
    } catch (error) {
        console.error('Ошибка сети или обработки запроса:', error);
        alert('Произошла ошибка сети или обработки запроса. Пожалуйста, проверьте консоль браузера и сервера.');
    }
}

// --- Функции для загрузки резюме ---
// Функция для загрузки резюме по ID
async function loadResume(resumeId) {
    console.log("Загрузка резюме с ID:", resumeId);

    const token = localStorage.getItem('token');
    if (!token) {
        console.error("Токен не найден при загрузке резюме");
        alert('Пользователь не авторизован. Пожалуйста, войдите в систему.');
        window.location.href = 'login.html';
        return;
    }

    try {
        const response = await fetch(`/api/resumes/${resumeId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`Ошибка загрузки: ${response.status}`);
        }

        const result = await response.json();
        const resumeData = result.resume.data; // Данные резюме находятся в поле 'data'

        console.log("Данные загруженного резюме:", resumeData);

        // Заполняем общую информацию
        document.getElementById('resume-title').value = result.resume.title; // Заголовок резюме
        document.getElementById('fullName').value = resumeData.personalInfo.fullName || '';
        document.getElementById('jobTitle').value = resumeData.personalInfo.jobTitle || '';
        document.getElementById('email').value = resumeData.personalInfo.email || '';
        document.getElementById('phone').value = resumeData.personalInfo.phone || '';
        document.getElementById('location').value = resumeData.personalInfo.location || '';
        document.getElementById('summary').value = resumeData.personalInfo.summary || '';

        // --- Заполняем опыт работы ---
        const experienceContainer = document.getElementById('experienceContainer');
        experienceContainer.innerHTML = ''; // Очищаем контейнер

        if (resumeData.experience && resumeData.experience.length > 0) {
            resumeData.experience.forEach((exp, index) => {
                // Добавляем новый блок, если это не первый элемент
                if (index > 0) {
                    addExperienceItem();
                }
                // Находим только что созданный (или первый) блок
                const items = experienceContainer.querySelectorAll('.dynamic-item');
                const item = items[index]; // item - это div.dynamic-item
                if (item) {
                    item.querySelector('.exp-position').value = exp.position || '';
                    item.querySelector('.exp-company').value = exp.company || '';
                    item.querySelector('.exp-period').value = exp.period || '';
                    item.querySelector('.exp-description').value = exp.description || '';
                } else {
                    console.error("Ошибка: не удалось найти элемент опыта работы для индекса", index);
                }
            });
        } else {
            // Если в загруженных данных нет опыта, оставляем один пустой блок
            // (он уже есть в начальной разметке, просто не заполняем)
        }
        // Обновляем предпросмотр опыта
        updateExperiencePreview();

        // --- Заполняем образование ---
        const educationContainer = document.getElementById('educationContainer');
        educationContainer.innerHTML = ''; // Очищаем контейнер

        if (resumeData.education && resumeData.education.length > 0) {
            resumeData.education.forEach((edu, index) => {
                if (index > 0) {
                    addEducationItem();
                }
                const items = educationContainer.querySelectorAll('.dynamic-item');
                const item = items[index]; // item - это div.dynamic-item
                if (item) {
                    item.querySelector('.edu-institution').value = edu.institution || '';
                    item.querySelector('.edu-degree').value = edu.degree || '';
                    item.querySelector('.edu-start-year').value = edu.startYear || '';
                    item.querySelector('.edu-end-year').value = edu.endYear || '';
                    // Валидируем заполненные поля
                    validateEducationFields(item);
                } else {
                    console.error("Ошибка: не удалось найти элемент образования для индекса", index);
                }
            });
        } else {
             // Если в загруженных данных нет образования, оставляем один пустой блок
        }
        // Обновляем предпросмотр образования
        updateEducationPreview();

        // --- Заполняем навыки ---
        const skillsContainer = document.getElementById('skillsContainer');
        skillsContainer.innerHTML = ''; // Очищаем контейнер

        if (resumeData.skills && resumeData.skills.length > 0) {
            resumeData.skills.forEach(skill => {
                addSkillToUI(skill); // Добавляем каждый навык в UI
            });
        } else {
             // Если в загруженных данных нет навыков, оставляем начальные
             // (они уже есть в начальной разметке, но мы их очистили, так что нужно добавить снова, если нужно)
             // В данном случае, если массив пустой, контейнер останется пустым, что логично.
        }
        // Обновляем предпросмотр навыков
        updateSkillsPreview();

        // --- Выбираем шаблон ---
        document.querySelectorAll('.template-option').forEach(opt => opt.classList.remove('active'));
        const templateOption = document.querySelector(`.template-option[data-template="${resumeData.template}"]`);
        if (templateOption) {
            templateOption.classList.add('active');
            document.getElementById('resumePreview').className = `resume-preview template-${resumeData.template}`;
        } else {
            // Если шаблон не найден, оставляем первый активным или используем дефолтный
            document.querySelector('.template-option').classList.add('active');
            document.getElementById('resumePreview').className = 'resume-preview template-classic';
        }

        // Обновляем общий предпросмотр
        updatePreview();

        console.log("Резюме успешно загружено в форму.");
        // Переключаем функцию сохранения на обновление
        isEditing = true;
        currentResumeId = resumeId;
        document.getElementById('saveBtn').textContent = 'Обновить'; // Изменяем текст кнопки

    } catch (error) {
        console.error('Ошибка загрузки резюме:', error);
        alert(`Ошибка загрузки резюме: ${error.message}`);
    }
}

// Вспомогательная функция для добавления нового поля опыта
function addExperienceItem() {
    const experienceContainer = document.getElementById('experienceContainer');
    const newExperience = document.createElement('div');
    newExperience.className = 'dynamic-item';
    newExperience.innerHTML = `
        <button class="remove-btn">×</button>
        <div class="form-group">
            <label>Должность</label>
            <input type="text" class="exp-position" placeholder="Frontend разработчик">
        </div>
        <div class="form-group">
            <label>Компания</label>
            <input type="text" class="exp-company" placeholder="ООО Технологии">
        </div>
        <div class="form-group">
            <label>Период работы</label>
            <input type="text" class="exp-period" placeholder="Январь 2020 - настоящее время">
        </div>
        <div class="form-group">
            <label>Описание</label>
            <textarea class="exp-description" placeholder="Описание ваших обязанностей и достижений"></textarea>
        </div>
    `;
    experienceContainer.appendChild(newExperience);

    // Добавляем обработчики событий к новым полям
    const inputs = newExperience.querySelectorAll('input, textarea');
    inputs.forEach(input => {
        input.addEventListener('input', updateExperiencePreview);
    });

    // Добавляем функциональность удаления
    const removeBtn = newExperience.querySelector('.remove-btn');
    removeBtn.addEventListener('click', () => {
        newExperience.remove();
        updateExperiencePreview();
    });

    updateExperiencePreview();
}

// Вспомогательная функция для добавления нового поля образования
function addEducationItem() {
    const educationContainer = document.getElementById('educationContainer');
    const newEducation = document.createElement('div');
    newEducation.className = 'dynamic-item';
    newEducation.innerHTML = `
        <button class="remove-btn">×</button>
        <div class="form-group">
            <label>Учебное заведение</label>
            <input type="text" class="edu-institution" placeholder="Московский государственный университет">
        </div>
        <div class="form-group">
            <label>Специальность</label>
            <input type="text" class="edu-degree" placeholder="Бакалавр информатики">
        </div>
        <div class="form-group">
            <label>Период обучения *</label>
            <div class="education-period">
                <select class="edu-start-year" required>
                    <option value="">Год начала</option>
                </select>
                <span class="separator">-</span>
                <select class="edu-end-year" required>
                    <option value="">Год окончания</option>
                </select>
            </div>
            <div class="validation-message edu-period-validation"></div>
        </div>
    `;
    educationContainer.appendChild(newEducation);

    // Заполняем годами (функция populateYearSelects должна быть определена ранее)
    populateYearSelects(); // Предполагается, что эта функция уже определена в начальном JS

    // Добавляем обработчики событий к новым полям
    const inputs = newEducation.querySelectorAll('input, select');
    inputs.forEach(input => {
        if (input.classList.contains('edu-start-year') || input.classList.contains('edu-end-year')) {
            input.addEventListener('change', function() {
                validateEducationFields(newEducation); // передаем новый элемент
                updateEducationPreview();
            });
        } else {
            input.addEventListener('input', updateEducationPreview);
        }
    });

}

// Вспомогательная функция для добавления навыка в UI
function addSkillToUI(skillText) {
    if (!skillText) return;
    const skillsContainer = document.getElementById('skillsContainer');
    const skillTag = document.createElement('div');
    skillTag.className = 'skill-tag';
    skillTag.innerHTML = `
        ${skillText} <span class="remove-skill">×</span>
    `;
    skillsContainer.appendChild(skillTag);

    // Добавляем обработчик удаления
    const removeSkill = skillTag.querySelector('.remove-skill');
    removeSkill.addEventListener('click', () => {
        skillTag.remove();
        updateSkillsPreview();
    });
    updateSkillsPreview(); // Обновляем предпросмотр после добавления
}

// --- Существующие функции из оригинального файла (с минимальными изменениями) ---

// ... (ВСЕ остальные функции из оригинального файла, начиная от populateYearSelects и до initializeForm) ...

function populateYearSelects() {
    const currentYear = new Date().getFullYear();
    const startYears = generateYearOptions(1970, currentYear);
    const endYears = generateYearOptions(1970, currentYear + 5);
    const startSelects = document.querySelectorAll('.edu-start-year');
    const endSelects = document.querySelectorAll('.edu-end-year');
    startSelects.forEach(select => {
        while (select.options.length > 1) {
            select.remove(1);
        }
        startYears.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            select.appendChild(option);
        });
    });
    endSelects.forEach(select => {
        while (select.options.length > 1) {
            select.remove(1);
        }
        endYears.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            select.appendChild(option);
        });
    });
}

function generateYearOptions(startYear, endYear) {
    const years = [];
    for (let year = startYear; year <= endYear; year++) {
        years.push(year);
    }
    return years;
}

function validateName(name) {
    const nameRegex = /^[А-ЯЁ][а-яё]+\s[А-ЯЁ][а-яё]+\s[А-ЯЁ][а-яё]+$/;
    return nameRegex.test(name.trim());
}

function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
}

function validatePhone(phone) {
    const phoneRegex = /^\+7\s\(\d{3}\)\s\d{3}-\d{2}-\d{2}$/;
    return phoneRegex.test(phone.trim());
}

function validateEducationPeriod(startYear, endYear) {
    if (!startYear || !endYear) {
        return { isValid: false, message: 'Выберите год начала и год окончания' };
    }
    if (parseInt(startYear) > parseInt(endYear)) {
        return { isValid: false, message: 'Год начала не может быть больше года окончания' };
    }
    return { isValid: true, message: '✓ Корректный период обучения' };
}

function formatPhone(value) {
    let numbers = value.replace(/\D/g, '');
    if (numbers.startsWith('7') || numbers.startsWith('8')) {
        numbers = '7' + numbers.substring(1);
    }
    if (numbers.length === 0) return '';
    if (numbers.length <= 3) return '+7 (' + numbers;
    if (numbers.length <= 6) return '+7 (' + numbers.substring(0, 3) + ') ' + numbers.substring(3);
    if (numbers.length <= 8) return '+7 (' + numbers.substring(0, 3) + ') ' + numbers.substring(3, 6) + '-' + numbers.substring(6);
    return '+7 (' + numbers.substring(0, 3) + ') ' + numbers.substring(3, 6) + '-' + numbers.substring(6, 8) + '-' + numbers.substring(8, 10);
}

function validateField(field) {
    const value = field.value.trim();
    let isValid = true;
    let message = '';
    switch(field.id) {
        case 'fullName':
            if (value === '') {
                isValid = false;
                message = 'Поле обязательно для заполнения';
            } else if (!validateName(value)) {
                isValid = false;
                message = 'Введите ФИО в формате: Иванов Иван Иванович';
            } else {
                message = '✓ Корректное ФИО';
            }
            break;
        case 'jobTitle':
            if (value === '') {
                isValid = false;
                message = 'Поле обязательно для заполнения';
            } else if (value.length < 2) {
                isValid = false;
                message = 'Название должности слишком короткое';
            } else {
                message = '✓ Корректная должность';
            }
            break;
        case 'email':
            if (value === '') {
                isValid = false;
                message = 'Поле обязательно для заполнения';
            } else if (!validateEmail(value)) {
                isValid = false;
                message = 'Введите корректный email адрес';
            } else {
                message = '✓ Корректный email';
            }
            break;
        case 'phone':
            if (value === '') {
                isValid = false;
                message = 'Поле обязательно для заполнения';
            } else if (!validatePhone(value)) {
                isValid = false;
                message = 'Введите телефон в формате: +7 (999) 123-45-67';
            } else {
                message = '✓ Корректный телефон';
            }
            break;
    }
    const validationElement = document.getElementById(field.id + 'Validation');
    if (validationElement) {
        validationElement.textContent = message;
        validationElement.className = 'validation-message ' + (isValid && value !== '' ? 'success' : 'error');
        if (value === '') {
            validationElement.textContent = '';
        }
    }
    field.className = '';
    if (value !== '') {
        field.className = isValid ? 'success' : 'error';
    }
    return isValid;
}

function validateEducationFields(educationItem) {
    const startYear = educationItem.querySelector('.edu-start-year').value;
    const endYear = educationItem.querySelector('.edu-end-year').value;
    const validation = validateEducationPeriod(startYear, endYear);
    const validationElement = educationItem.querySelector('.edu-period-validation');
    if (validationElement) {
        validationElement.textContent = validation.message;
        validationElement.className = 'validation-message ' + (validation.isValid ? 'success' : 'error');
        if (!startYear && !endYear) {
            validationElement.textContent = '';
        }
    }
    const startSelect = educationItem.querySelector('.edu-start-year');
    const endSelect = educationItem.querySelector('.edu-end-year');
    startSelect.className = 'edu-start-year';
    endSelect.className = 'edu-end-year';
    if (startYear || endYear) {
        const className = validation.isValid ? 'success' : 'error';
        startSelect.classList.add(className);
        endSelect.classList.add(className);
    }
    return validation.isValid;
}

function validateAllFields() {
    let isValid = true;
    const requiredFields = ['fullName', 'jobTitle', 'email', 'phone'];
    requiredFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (!validateField(field)) {
            isValid = false;
        }
    });
    const educationItems = document.querySelectorAll('#educationContainer .dynamic-item');
    educationItems.forEach(item => {
        if (!validateEducationFields(item)) {
            isValid = false;
        }
    });
    return isValid;
}

function updatePreview() {
    document.getElementById('previewName').textContent = document.getElementById('fullName').value || 'Иванов Иван Иванович';
    document.getElementById('previewTitle').textContent = document.getElementById('jobTitle').value || 'Frontend разработчик';
    document.getElementById('previewEmail').textContent = document.getElementById('email').value || 'example@email.com';
    document.getElementById('previewPhone').textContent = document.getElementById('phone').value || '+7 (999) 123-45-67';
    document.getElementById('previewLocation').textContent = document.getElementById('location').value || 'Москва, Россия';
    document.getElementById('previewSummary').textContent = document.getElementById('summary').value || 'Опытный frontend разработчик с 5-летним опытом работы над веб-приложениями. Специализируюсь на JavaScript, React и современных фреймворках.';
}

function updateExperiencePreview() {
    const previewContainer = document.getElementById('previewExperience');
    previewContainer.innerHTML = '';
    const experienceItems = document.querySelectorAll('#experienceContainer .dynamic-item');
    experienceItems.forEach(item => {
        const position = item.querySelector('.exp-position').value || 'Frontend разработчик';
        const company = item.querySelector('.exp-company').value || 'ООО Технологии';
        const period = item.querySelector('.exp-period').value || 'Январь 2020 - настоящее время';
        const description = item.querySelector('.exp-description').value || 'Разработка и поддержка пользовательских интерфейсов для веб-приложений. Оптимизация производительности и доступности.';
        const experienceHTML = `
            <div class="resume-item">
                <div class="resume-item-header">
                    <div class="resume-item-title">${position}</div>
                    <div class="resume-item-date">${period}</div>
                </div>
                <div class="resume-item-subtitle">${company}</div>
                <div class="resume-item-description">
                    ${description}
                </div>
            </div>
        `;
        previewContainer.innerHTML += experienceHTML;
    });
    if (experienceItems.length === 0) {
        previewContainer.innerHTML = `
            <div class="resume-item">
                <div class="resume-item-header">
                    <div class="resume-item-title">Frontend разработчик</div>
                    <div class="resume-item-date">Январь 2020 - настоящее время</div>
                </div>
                <div class="resume-item-subtitle">ООО Технологии</div>
                <div class="resume-item-description">
                    Разработка и поддержка пользовательских интерфейсов для веб-приложений. Оптимизация производительности и доступности.
                </div>
            </div>
        `;
    }
}

function updateEducationPreview() {
    const previewContainer = document.getElementById('previewEducation');
    previewContainer.innerHTML = '';
    const educationItems = document.querySelectorAll('#educationContainer .dynamic-item');
    educationItems.forEach(item => {
        const institution = item.querySelector('.edu-institution').value || 'Московский государственный университет';
        const degree = item.querySelector('.edu-degree').value || 'Бакалавр информатики';
        const startYear = item.querySelector('.edu-start-year').value;
        const endYear = item.querySelector('.edu-end-year').value;
        const period = startYear && endYear ? `${startYear} - ${endYear}` : '2016 - 2020';
        const educationHTML = `
            <div class="resume-item">
                <div class="resume-item-header">
                    <div class="resume-item-title">${degree}</div>
                    <div class="resume-item-date">${period}</div>
                </div>
                <div class="resume-item-subtitle">${institution}</div>
            </div>
        `;
        previewContainer.innerHTML += educationHTML;
    });
    if (educationItems.length === 0) {
        previewContainer.innerHTML = `
            <div class="resume-item">
                <div class="resume-item-header">
                    <div class="resume-item-title">Бакалавр информатики</div>
                    <div class="resume-item-date">2016 - 2020</div>
                </div>
                <div class="resume-item-subtitle">Московский государственный университет</div>
            </div>
        `;
    }
}

function updateSkillsPreview() {
    const previewContainer = document.getElementById('previewSkills');
    previewContainer.innerHTML = '';
    const skillTags = document.querySelectorAll('#skillsContainer .skill-tag');
    skillTags.forEach(tag => {
        const skillText = tag.textContent.replace('×', '').trim();
        const skillHTML = `<div class="resume-skill">${skillText}</div>`;
        previewContainer.innerHTML += skillHTML;
    });
    if (skillTags.length === 0) {
        previewContainer.innerHTML = `
            <div class="resume-skill">HTML/CSS</div>
            <div class="resume-skill">JavaScript</div>
            <div class="resume-skill">React</div>
        `;
    }
}

function initializeForm() {
    populateYearSelects();
    updatePreview();
    updateExperiencePreview();
    updateEducationPreview();
    updateSkillsPreview();
}

// --- ИНИЦИАЛИЗАЦИЯ ---
document.addEventListener('DOMContentLoaded', function() {
    // Инициализация формы (все старые обработчики событий)
    initializeForm();

    // Привязываем обработчик к кнопке сохранить
    document.getElementById('saveBtn').addEventListener('click', saveResume);

    // --- Добавляем обработчики для кнопок добавления ---
    // Опыт работы
    document.getElementById('addExperience').addEventListener('click', addExperienceItem);
    // Обработчики для существующего блока опыта (первый)
    document.querySelectorAll('#experienceContainer input, #experienceContainer textarea').forEach(input => {
        input.addEventListener('input', updateExperiencePreview);
    });

    // Образование
    document.getElementById('addEducation').addEventListener('click', addEducationItem);
    // Обработчики для существующего блока образования (первый)
    document.querySelectorAll('#educationContainer input, #educationContainer select').forEach(input => {
        if (input.classList.contains('edu-start-year') || input.classList.contains('edu-end-year')) {
            input.addEventListener('change', function() {
                const educationItem = this.closest('.dynamic-item');
                validateEducationFields(educationItem);
                updateEducationPreview();
            });
        } else {
            input.addEventListener('input', updateEducationPreview);
        }
    });

    // Навыки
    document.getElementById('addSkillBtn').addEventListener('click', () => {
        const newSkillInput = document.getElementById('newSkill');
        const skillText = newSkillInput.value.trim();
        if (skillText) {
            const skills = skillText.split(',').map(skill => skill.trim()).filter(skill => skill);
            skills.forEach(skill => {
                addSkillToUI(skill);
            });
            newSkillInput.value = '';
        }
    });
    // Обработчики для существующих тегов навыков (удаление)
    document.querySelectorAll('#skillsContainer .remove-skill').forEach(btn => {
        btn.addEventListener('click', function() {
            this.parentElement.remove();
            updateSkillsPreview();
        });
    });

    // Шаблоны
    document.querySelectorAll('.template-option').forEach(option => {
        option.addEventListener('click', function() {
            document.querySelectorAll('.template-option').forEach(opt => opt.classList.remove('active'));
            this.classList.add('active');
            const template = this.getAttribute('data-template');
            document.getElementById('resumePreview').classList.remove('template-classic', 'template-modern', 'template-creative');
            document.getElementById('resumePreview').classList.add(`template-${template}`);
        });
    });

    // Форматирование телефона
    const phoneInput = document.getElementById('phone');
    phoneInput.addEventListener('input', function(e) {
        const cursorPosition = e.target.selectionStart;
        const originalLength = e.target.value.length;
        e.target.value = formatPhone(e.target.value);
        const newLength = e.target.value.length;
        const lengthDiff = newLength - originalLength;
        e.target.setSelectionRange(cursorPosition + lengthDiff, cursorPosition + lengthDiff);
        validateField(e.target);
        updatePreview();
    });

    // Валидация полей
    document.querySelectorAll('#fullName, #jobTitle, #email, #phone, #location, #summary').forEach(input => {
        input.addEventListener('input', function() {
            updatePreview();
            validateField(this);
        });
    });

    // Проверяем URL на наличие resumeId
    const urlParams = new URLSearchParams(window.location.search);
    const resumeId = urlParams.get('resumeId');

    if (resumeId) {
        // Если ID есть, загружаем резюме
        loadResume(resumeId);
    } else {
        // Если ID нет, инициализируем как новое резюме
        console.log("Режим создания нового резюме.");
    }
});


async function exportToPDF() {
    console.log("Начинается экспорт в PDF...");
    const resumePreviewElement = document.getElementById('resumePreview');

    if (!resumePreviewElement) {
        console.error("Элемент предварительного просмотра резюме не найден.");
        alert("Не удалось найти элемент для экспорта.");
        return;
    }

    try {
        // Используем html2canvas для создания изображения элемента
        const canvas = await html2canvas(resumePreviewElement, {
            scale: 2, // Увеличиваем масштаб для лучшего качества
            useCORS: true, // Позволяет загружать изображения с других доменов (если есть)
            logging: false // Отключаем логирование html2canvas
        });

        const imgData = canvas.toDataURL('image/png'); // Получаем данные изображения
        const imgWidth = 210; // Ширина в мм (A4)
        const pageHeight = 295; // Высота в мм (A4)
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;

        // Создаем новый документ jsPDF (A4, портретная ориентация)
        const { jsPDF } = window.jspdf; // Получаем объект jsPDF из глобальной области видимости
        const pdf = new jsPDF('p', 'mm', 'a4');
        let position = 0;

        // Добавляем изображение на первую страницу
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        // Если содержимое не помещается на одну страницу, добавляем новые страницы
        while (heightLeft >= 0) {
            position = heightLeft - imgHeight;
            pdf.addPage(); // Добавляем новую страницу
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }

        // Генерируем имя файла, например, "Resume_Иванов_Иван_Иванович.pdf"
        const fullName = document.getElementById('fullName').value || 'Мое_Резюме';
        const fileName = `Resume_${fullName.replace(/\s+/g, '_')}.pdf`;

        // Сохраняем PDF
        pdf.save(fileName);
        console.log("PDF успешно сгенерирован и сохранен.");
    } catch (error) {
        console.error('Ошибка при экспорте в PDF:', error);
        alert('Произошла ошибка при попытке экспорта в PDF. Пожалуйста, проверьте консоль браузера.');
    }
}

// --- Существующие функции из оригинального файла (с минимальными изменениями) ---
// ... (ваш существующий код populateYearSelects и т.д.) ...

// --- ИНИЦИАЛИЗАЦИЯ ---
document.addEventListener('DOMContentLoaded', function() {
    // Инициализация формы (все старые обработчики событий)
    initializeForm();

    // Привязываем обработчики к кнопкам
    document.getElementById('saveBtn').addEventListener('click', saveResume);
    document.getElementById('exportBtn').addEventListener('click', exportToPDF); // Привязываем новую функцию
});

async function exportToGoogleDrive() {
  // 1. Проверяем, есть ли сессия (по простому — делаем запрос к /api/me или проверяем наличие токена в localStorage)
  // Но проще: просто попытаться экспортировать, и если 401 — редиректить на /auth/google

  const { title, data } = collectFormData(); // ← вы уже это делаете в saveResume

  try {
    const response = await fetch('/api/export-to-drive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, resumeData: data }),
    });

    const result = await response.json();

    if (response.ok) {
      alert(`✅ Резюме "${title}" сохранено в Google Drive! Открыть: ${result.viewUrl}`);
      // Опционально: открыть в новой вкладке
      window.open(result.viewUrl, '_blank');
    } else if (response.status === 401) {
      // Нет сессии Google → редирект на авторизацию
      if (confirm('Нужно войти через Google. Перейти?')) {
        window.location.href = '/auth/google';
      }
    } else {
      throw new Error(result.error || 'Неизвестная ошибка');
    }
  } catch (error) {
    console.error('Ошибка экспорта в Google Drive:', error);
    alert(`❌ Ошибка: ${error.message}`);
  }
}

// Привязка кнопки
document.addEventListener('DOMContentLoaded', () => {
  const driveBtn = document.getElementById('exportToDriveBtn');
  if (driveBtn) {
    driveBtn.addEventListener('click', exportToGoogleDrive);
  }
});

