// /functions/purchase-investment.js
const { performTransactionalUpdate } = require('./db-manager');

exports.handler = async (event, context) => {
    const { user } = context.clientContext;
    if (!user) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Ви не авторизовані.' }) };
    }

    const { investmentId, price } = JSON.parse(event.body);
    const userId = user.sub;

    try {
        let finalBalance;
        await performTransactionalUpdate('users.json', (usersData) => {
            if (!usersData[userId]) {
                // Якщо користувача немає, він не може нічого купити
                throw { name: 'InsufficientFunds', required: price, balance: 0 };
            }

            if (usersData[userId].balance < price) {
                // Якщо не вистачає грошей
                throw { name: 'InsufficientFunds', required: price, balance: usersData[userId].balance };
            }

            usersData[userId].balance -= price;
            usersData[userId].purchases.push(investmentId);
            finalBalance = usersData[userId].balance;
            return usersData;
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, newBalance: finalBalance }),
        };
    } catch (error) {
        if (error.name === 'InsufficientFunds') {
            return {
                statusCode: 402, // Payment Required
                body: JSON.stringify({
                    error: 'Недостатньо коштів',
                    shortfall: (error.required - error.balance).toFixed(2)
                }),
            };
        }
        console.error("Помилка покупки:", error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
