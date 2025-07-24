// Шлях до файлу: /functions/update-balance.js

const fetch = require('node-fetch');

// !! КРОК 2: ВСТАВТЕ СЮДИ ВАШ НОВИЙ ТОКЕН, ЗГЕНЕРОВАНИЙ НА КРОЦІ 1 !!
const NETLIFY_API_TOKEN    = "nfp_AMftYBRVkTJa7BzWuCuLEnY97ys9ezqAf941"; 
// ---------------------------------------------------

// Ваші ключі PayPal залишаються без змін
const PAYPAL_CLIENT_ID     = "ASJIOL6y24xuwQiCC-a8RBkVypAp5VuYLf7cXEIzc4aLV5yYEXDVvellq-OGQQfZjkqJBZh1h0JqS9mU";
const PAYPAL_CLIENT_SECRET = "EJ4fJwwhV6PIVwQBJkvXSPRf8OWm6sVLYPXgQpqr4_GuMN_PIaaDpevPGg4AR-VlRu2Uly7x4NmsdGeY";

async function getPaypalAccessToken(clientId, clientSecret) {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await fetch('https://api.sandbox.paypal.com/v1/oauth2/token', {
        method: 'POST',
        headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=client_credentials'
    });
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Помилка отримання токену PayPal: ${response.status} ${errorBody}`);
    }
    const data = await response.json();
    return data.access_token;
}

exports.handler = async (event, context) => {
    const { user } = context.clientContext;
    if (!user) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Ви не авторизовані для виконання цієї дії.' }) };
    }

    try {
        const { orderID, userId } = JSON.parse(event.body);
        if (!orderID || !userId) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Відсутній ID замовлення або ID користувача.' }) };
        }
        
        console.log(`Функція викликана для користувача: ${user.email} (ID: ${userId})`);

        const paypalToken = await getPaypalAccessToken(PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET);
        const orderResponse = await fetch(`https://api.sandbox.paypal.com/v2/checkout/orders/${orderID}`, {
            headers: { 'Authorization': `Bearer ${paypalToken}` }
        });
        
        const orderData = await orderResponse.json();
        if (orderData.status !== 'COMPLETED' && orderData.status !== 'APPROVED') {
            return { statusCode: 400, body: JSON.stringify({ error: `Статус платежу не є успішним: ${orderData.status}` }) };
        }

        const amountPaid = parseFloat(orderData.purchase_units[0].amount.value);
        console.log(`Платіж успішний. Сума: ${amountPaid} USD`);

        const currentBalance = user.app_metadata.balance || 0;
        const newBalance = currentBalance + amountPaid;
        console.log(`Оновлення балансу: з ${currentBalance} на ${newBalance}`);

        // ВИКОРИСТОВУЄМО ПРАВИЛЬНИЙ ENDPOINT БЕЗ /identity
        const netlifyAPIUrl = `https://api.netlify.com/api/v1/users/${userId}`;
        
        const updateUserResponse = await fetch(netlifyAPIUrl, {
            method: 'PUT',
            headers: { 
                'Authorization': `Bearer ${NETLIFY_API_TOKEN}`, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({
                // ВИКОРИСТОВУЄМО БЕЗПЕЧНЕ СХОВИЩЕ
                app_metadata: { 
                    ...user.app_metadata, 
                    balance: newBalance 
                } 
            })
        });

        if (!updateUserResponse.ok) {
            const errorBody = await updateUserResponse.json();
            console.error("Помилка оновлення користувача в Netlify:", errorBody);
            throw new Error(`Не вдалося оновити баланс. Відповідь Netlify: ${JSON.stringify(errorBody)}`);
        }
        
        console.log("Баланс користувача в Netlify успішно оновлено.");

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, newBalance: newBalance }),
        };

    } catch (error) {
        console.error('КРАХ ФУНКЦІЇ:', error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};
