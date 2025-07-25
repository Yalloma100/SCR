// /functions/purchase-investment.js
const { performTransactionalUpdate } = require('./db-manager');
const netlifyIdentity = require('netlify-identity-widget'); // Це умовно, на сервері доступ до юзера інший

exports.handler = async (event, context) => {
    // Перевірка авторизації користувача
    const { user } = context.clientContext;
    if (!user) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Ви не авторизовані.' }) };
    }

    const { investmentId, price } = JSON.parse(event.body);
    const userId = user.sub; // Netlify User ID

    // Оновлюємо дані користувача транзакційно
    try {
        const newUserData = await performTransactionalUpdate('users.json', (usersData) => {
            // Перевіряємо, чи існує користувач, якщо ні - створюємо
            if (!usersData[userId]) {
                usersData[userId] = { balance: 0, purchases: [] };
            }

            // Логіка перевірки балансу
            const userBalance = usersData[userId].balance;
            if (userBalance < price) {
                // Це не помилка, а сигнал фронтенду, що треба ініціювати оплату
                throw { 
                    name: 'InsufficientFunds', 
                    required: price, 
                    balance: userBalance 
                };
            }

            // Списуємо гроші та додаємо покупку
            usersData[userId].balance -= price;
            usersData[userId].purchases.push(investmentId);

            return usersData;
        });
        
        // Оновлюємо баланс в Netlify Identity теж!
        const adminUser = netlifyIdentity.admin();
        await adminUser.updateUserById(userId, { 
            user_metadata: { balance: newUserData[userId].balance }
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, newBalance: newUserData[userId].balance }),
        };

    } catch (error) {
        // Обробка нашого кастомного "винятку"
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
