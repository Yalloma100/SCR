// /functions/purchase-investment.js
const { performTransactionalUpdate } = require('./db-manager');

exports.handler = async (event, context) => {
    const { user } = context.clientContext;
    if (!user) { return { statusCode: 401, body: JSON.stringify({ error: 'Ви не авторизовані.' }) }; }

    const { investmentId, price } = JSON.parse(event.body);
    const userId = user.sub;

    try {
        let finalBalance;
        await performTransactionalUpdate('users.json', (usersData) => {
            if (!usersData[userId]) { throw { name: 'InsufficientFunds', required: price, balance: 0 }; }
            
            const currentBalance = usersData[userId].balance;
            if (currentBalance < price) { throw { name: 'InsufficientFunds', required: price, balance: currentBalance }; }

            // Створюємо новий об'єкт покупки
            const newPurchase = {
                investmentId: investmentId,
                purchaseTimestamp: new Date().toISOString(),
                balanceAtPurchase: currentBalance
            };
            
            usersData[userId].balance -= price;
            usersData[userId].purchases.push(newPurchase);
            finalBalance = usersData[userId].balance;
            
            return usersData;
        });

        return { statusCode: 200, body: JSON.stringify({ success: true, newBalance: finalBalance }) };
    } catch (error) {
        if (error.name === 'InsufficientFunds') {
            return { statusCode: 402, body: JSON.stringify({ error: 'Недостатньо коштів', shortfall: (error.required - error.balance).toFixed(2) }) };
        }
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
