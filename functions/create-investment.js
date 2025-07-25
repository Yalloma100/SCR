// /functions/create-investment.js
const { performTransactionalUpdate } = require('./db-manager');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const newInvestmentData = JSON.parse(event.body);

        newInvestmentData.id = `inv_${Date.now()}`;
        newInvestmentData.createdAt = new Date().toISOString(); // Додаємо час створення

        await performTransactionalUpdate('investments.json', (investments) => {
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
