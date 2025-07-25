const { performTransactionalUpdate } = require('./db-manager');

exports.handler = async (event) => {
    // Тут можна додати перевірку паролю адміна, якщо потрібен додатковий захист
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const newInvestmentData = JSON.parse(event.body);

        // Генеруємо унікальний ID
        newInvestmentData.id = `inv_${Date.now()}`;

        await performTransactionalUpdate('investments.json', (investments) => {
            // Просто додаємо новий елемент до масиву
            investments.push(newInvestmentData);
            return investments;
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, newInvestment: newInvestmentData }),
        };
    } catch (error) {
        console.error("Помилка створення вкладення:", error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
