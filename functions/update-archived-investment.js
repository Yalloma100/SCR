// /functions/update-archived-investment.js
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

        await performTransactionalUpdate('trash.json', (trash) => {
            const index = trash.findIndex(inv => inv.id === updatedData.id);
            if (index === -1) {
                // Якщо елемента немає, нічого не робимо
                return trash;
            }
            // Оновлюємо дані елемента в кошику
            trash[index] = { 
                ...trash[index], // Зберігаємо старі дані, які не редагуються
                ...updatedData   // Перезаписуємо новими
            };
            return trash;
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true }),
        };
    } catch (error) {
        console.error("Помилка оновлення вкладення в кошику:", error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
