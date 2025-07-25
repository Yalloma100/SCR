// /functions/archive-investment.js
const { performTransactionalUpdate } = require('./db-manager');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405 };

    try {
        const { id } = JSON.parse(event.body);
        let archivedItem = null;

        // Видаляємо з основного файлу
        await performTransactionalUpdate('investments.json', (investments) => {
            const index = investments.findIndex(inv => inv.id === id);
            if (index > -1) {
                [archivedItem] = investments.splice(index, 1);
            }
            return investments;
        });

        // Додаємо в кошик
        if (archivedItem) {
            await performTransactionalUpdate('trash.json', (trash) => {
                trash.push(archivedItem);
                return trash;
            });
        }

        return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
