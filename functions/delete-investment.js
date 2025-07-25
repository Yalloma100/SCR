// /functions/delete-investment.js
const { performTransactionalUpdate } = require('./db-manager');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { id } = JSON.parse(event.body);
        if (!id) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Відсутній ID для видалення' }) };
        }

        await performTransactionalUpdate('investments.json', (investments) => {
            // Фільтруємо масив, залишаючи всі елементи, крім того, що треба видалити
            return investments.filter(inv => inv.id !== id);
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true }),
        };
    } catch (error) {
        console.error("Помилка видалення вкладення:", error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
