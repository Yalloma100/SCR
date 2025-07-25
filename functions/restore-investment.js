// /functions/restore-investment.js
const { performTransactionalUpdate } = require('./db-manager');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { id } = JSON.parse(event.body);
        if (!id) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Відсутній ID для відновлення' }) };
        }

        let restoredItem = null;

        // Крок 1: Видаляємо елемент з кошика
        await performTransactionalUpdate('trash.json', (trash) => {
            const index = trash.findIndex(item => item.id === id);
            if (index > -1) {
                // Вирізаємо елемент з масиву та зберігаємо його
                [restoredItem] = trash.splice(index, 1);
            }
            return trash;
        });

        // Крок 2: Якщо елемент було знайдено та видалено з кошика, додаємо його назад до активних
        if (restoredItem) {
            await performTransactionalUpdate('investments.json', (investments) => {
                investments.push(restoredItem);
                // Опціонально: сортуємо, щоб нові були в кінці
                investments.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                return investments;
            });
        } else {
            return { statusCode: 404, body: JSON.stringify({ error: 'Елемент у кошику не знайдено' }) };
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, restoredItem: restoredItem }),
        };

    } catch (error) {
        console.error("Помилка відновлення вкладення:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};
