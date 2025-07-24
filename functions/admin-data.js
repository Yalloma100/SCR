// /functions/admin-data.js
const fetch = require('node-fetch');

// ВАЖЛИВО: Ці значення потрібно буде встановити в змінних оточення Netlify
// (Налаштування сайту -> Build & deploy -> Environment -> Environment variables)
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const NETLIFY_API_TOKEN = process.env.NETLIFY_API_TOKEN; // Персональний токен доступу до Netlify API
const NETLIFY_SITE_ID = process.env.NETLIFY_SITE_ID;     // ID вашого сайту

exports.handler = async (event) => {
    // 1. Перевіряємо, чи це POST-запит
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { username, password } = JSON.parse(event.body);

        // 2. Перевіряємо логін та пароль
        if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
            return {
                statusCode: 401,
                body: JSON.stringify({ error: 'Неправильний логін або пароль' }),
            };
        }

        // 3. Якщо пароль правильний, отримуємо користувачів з Netlify API
        const apiUrl = `https://api.netlify.com/api/v1/sites/${NETLIFY_SITE_ID}/users`;
        const response = await fetch(apiUrl, {
            headers: { 'Authorization': `Bearer ${NETLIFY_API_TOKEN}` },
        });

        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`Помилка API Netlify: ${response.status} ${errorData}`);
        }

        const users = await response.json();

        // Форматуємо дані для зручного відображення
        const formattedUsers = users.map(user => ({
            id: user.id,
            full_name: user.user_metadata.full_name || 'Ім\'я не вказано',
            email: user.email,
            balance: user.user_metadata.balance || 0,
        }));

        // 4. Повертаємо дані
        return {
            statusCode: 200,
            body: JSON.stringify({
                totalUsers: formattedUsers.length,
                users: formattedUsers,
            }),
        };

    } catch (error) {
        console.error('Помилка у функції admin-data:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};
