// /functions/admin-data.js
const fetch = require('node-fetch');

// ВАЖЛИВО: Ці значення потрібно буде встановити в змінних оточення Netlify
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const NETLIFY_API_TOKEN = process.env.NETLIFY_API_TOKEN;
const NETLIFY_SITE_ID = process.env.NETLIFY_SITE_ID;

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { username, password } = JSON.parse(event.body);

        if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
            return {
                statusCode: 401,
                body: JSON.stringify({ error: 'Неправильний логін або пароль' }),
            };
        }

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
            // ВИПРАВЛЕНО: Додано `?.` для безпечного доступу до властивостей
            full_name: user.user_metadata?.full_name || 'Ім\'я не вказано',
            email: user.email,
            // ВИПРАВЛЕНО: Додано `?.` для безпечного доступу до властивостей
            balance: user.user_metadata?.balance || 0,
        }));

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
