// /functions/update-investment.js
const { performTransactionalUpdate } = require('./db-manager');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const updatedData = JSON.parse(event.body);
        if (!updatedData.id) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Відсутній ID для оновлення' }) };
        }

        await performTransactionalUpdate('investments.json', (investments) => {
            const index = investments.findIndex(inv => inv.id === updatedData.id);
            if (index === -1) {
                throw new Error('Вкладення для оновлення не знайдено.');
            }
            // Оновлюємо, зберігаючи createdAt
            investments[index] = { ...updatedData, createdAt: investments[index].createdAt };
            return investments;
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true }),
        };
    } catch (error) {
        console.error("Помилка оновлення вкладення:", error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
