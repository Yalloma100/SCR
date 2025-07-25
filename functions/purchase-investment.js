// /functions/purchase-investment.js
const fetch = require('node-fetch');
const { performTransactionalUpdate } = require('./db-manager');

const { NETLIFY_API_TOKEN } = process.env;

exports.handler = async (event, context) => {
    const { user } = context.clientContext;
    if (!user) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Ви не авторизовані.' }) };
    }

    const { investmentId, price } = JSON.parse(event.body);
    const userId = user.sub;
    const userEmail = user.email; // Нам потрібен email для оновлення метаданих

    try {
        let finalBalance;

        // Транзакційно оновлюємо users.json
        await performTransactionalUpdate('users.json', (usersData) => {
            if (!usersData[userId]) {
                usersData[userId] = { balance: 0, purchases: [] };
            }

            const currentBalance = usersData[userId].balance;
            if (currentBalance < price) {
                throw { name: 'InsufficientFunds', required: price, balance: currentBalance };
            }

            usersData[userId].balance -= price;
            usersData[userId].purchases.push(investmentId);
            finalBalance = usersData[userId].balance; // Зберігаємо фінальний баланс

            return usersData;
        });

        // Оновлюємо баланс в Netlify Identity
        const url = `https://api.netlify.com/api/v1/users/${userId}`;
        await fetch(url, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${NETLIFY_API_TOKEN}` },
            body: JSON.stringify({
                user_metadata: {
                    ...user.user_metadata, // Копіюємо існуючі метадані
                    balance: finalBalance
                }
            })
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
                    shortfall: error.required - error.balance
                }),
            };
        }
        
        console.error("Помилка покупки:", error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
