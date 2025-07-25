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

    try {
        let finalBalance;

        // Крок 1: Транзакційно оновлюємо наш users.json на GitHub
        await performTransactionalUpdate('users.json', (usersData) => {
            if (!usersData[userId]) {
                // ВИПРАВЛЕНО: Якщо користувача немає в нашій БД, беремо його баланс з Netlify
                const initialBalance = user.user_metadata?.balance || 0;
                usersData[userId] = { 
                    balance: initialBalance, 
                    purchases: [] 
                };
            }

            const currentBalance = usersData[userId].balance;
            if (currentBalance < price) {
                throw { name: 'InsufficientFunds', required: price, balance: currentBalance };
            }

            usersData[userId].balance -= price;
            usersData[userId].purchases.push(investmentId);
            finalBalance = usersData[userId].balance;

            return usersData;
        });

        // Крок 2: Оновлюємо баланс в Netlify Identity через API
        const url = `https://api.netlify.com/api/v1/users/${userId}`;
        
        // ВИПРАВЛЕНО: Створюємо метадані безпечно, навіть якщо їх не було
        const newMetaData = {
            ...(user.user_metadata || {}), // Якщо user_metadata не існує, використовуємо порожній об'єкт
            balance: finalBalance
        };

        const response = await fetch(url, {
            method: 'PUT',
            headers: { 
                'Authorization': `Bearer ${NETLIFY_API_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ user_metadata: newMetaData }) // Відправляємо безпечно створений об'єкт
        });

        if (!response.ok) {
            const errorText = await response.text();
            // Надаємо більш детальну помилку для діагностики
            throw new Error(`Не вдалося оновити баланс в Netlify. Статус: ${response.status}. Повідомлення: ${errorText}`);
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, newBalance: finalBalance }),
        };

    } catch (error) {
        if (error.name === 'InsufficientFunds') {
            return {
                statusCode: 402,
                body: JSON.stringify({
                    error: 'Недостатньо коштів',
                    shortfall: (error.required - error.balance).toFixed(2)
                }),
            };
        }
        
        console.error("Критична помилка покупки:", error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
