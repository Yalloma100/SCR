// /functions/purchase-investment.js
const fetch = require('node-fetch');
const { performTransactionalUpdate } = require('./db-manager');

// Беремо токен з змінних оточення
const { NETLIFY_API_TOKEN } = process.env;

exports.handler = async (event, context) => {
    // Отримуємо користувача з контексту - це правильний серверний спосіб
    const { user } = context.clientContext;
    if (!user) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Ви не авторизовані.' }) };
    }

    const { investmentId, price } = JSON.parse(event.body);
    const userId = user.sub; // ID користувача Netlify

    try {
        let finalBalance;

        // Крок 1: Транзакційно оновлюємо наш users.json на GitHub
        await performTransactionalUpdate('users.json', (usersData) => {
            if (!usersData[userId]) {
                // Якщо користувача немає в нашій БД, створюємо запис з його поточним балансом з Netlify
                usersData[userId] = { 
                    balance: user.user_metadata.balance || 0, 
                    purchases: [] 
                };
            }

            const currentBalance = usersData[userId].balance;
            if (currentBalance < price) {
                // Сигнал фронтенду, що коштів недостатньо
                throw { name: 'InsufficientFunds', required: price, balance: currentBalance };
            }

            // Списуємо гроші та додаємо покупку
            usersData[userId].balance -= price;
            usersData[userId].purchases.push(investmentId);
            finalBalance = usersData[userId].balance; // Зберігаємо новий баланс

            return usersData;
        });

        // Крок 2: Оновлюємо баланс безпосередньо в Netlify Identity через API
        // Це правильний серверний спосіб оновлення метаданих
        const url = `https://api.netlify.com/api/v1/users/${userId}`;
        const response = await fetch(url, {
            method: 'PUT',
            headers: { 
                'Authorization': `Bearer ${NETLIFY_API_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_metadata: {
                    ...user.user_metadata, // Копіюємо існуючі метадані, щоб не затерти їх
                    balance: finalBalance // Оновлюємо тільки баланс
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Не вдалося оновити баланс в Netlify: ${errorText}`);
        }

        // Повертаємо успішну відповідь
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
