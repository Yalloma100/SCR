// /functions/admin-auth.js
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { username, password } = JSON.parse(event.body);

        if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
            // Якщо логін та пароль правильні, повертаємо успіх
            return {
                statusCode: 200,
                body: JSON.stringify({ success: true, message: 'Авторизація успішна' }),
            };
        } else {
            // Інакше повертаємо помилку
            return {
                statusCode: 401,
                body: JSON.stringify({ success: false, message: 'Неправильний логін або пароль' }),
            };
        }
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, message: 'Внутрішня помилка сервера' }),
        };
    }
};
