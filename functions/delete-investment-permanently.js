// /functions/delete-investment-permanently.js
const { performTransactionalUpdate } = require('./db-manager');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { id } = JSON.parse(event.body);
        if (!id) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Відсутній ID для остаточного видалення' }) };
        }

        // Просто видаляємо елемент з файлу trash.json
        await performTransactionalUpdate('trash.json', (trash) => {
            // Фільтруємо масив, залишаючи всі елементи, крім того, що треба видалити
            return trash.filter(item => item.id !== id);
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true }),
        };

    } catch (error) {
        console.error("Помилка остаточного видалення вкладення:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};
