// Шлях до файлу: /functions/update-balance.js

const fetch = require('node-fetch');
// Імпортуємо getStore з SDK для Netlify Blobs
const { getStore } = require('@netlify/blobs');

const PAYPAL_CLIENT_ID     = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;

// Функція для отримання токена PayPal (без змін)
async function getPaypalAccessToken(clientId, clientSecret) {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await fetch('https://api.sandbox.paypal.com/v1/oauth2/token', {
        method: 'POST',
        headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=client_credentials'
    });
    if (!response.ok) throw new Error(`Помилка отримання токену PayPal: ${await response.text()}`);
    const data = await response.json();
    return data.access_token;
}

exports.handler = async (event, context) => {
    // 1. Отримуємо дані користувача та його токен з контексту
    const { user, token } = context.clientContext;
    if (!user) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Ви не авторизовані.' }) };
    }

    try {
        const { orderID } = JSON.parse(event.body);
        if (!orderID) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Відсутній ID замовлення.' }) };
        }

        // 2. ЗАХИСТ: Перевіряємо, чи не використовувався цей платіж раніше
        const ordersStore = getStore('processed_orders');
        const existingOrder = await ordersStore.get(orderID);
        if (existingOrder) {
            return { statusCode: 409, body: JSON.stringify({ error: 'Цей платіж вже було зараховано.' }) }; // 409 Conflict
        }

        // 3. Перевірка платежу PayPal (логіка без змін)
        const paypalToken = await getPaypalAccessToken(PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET);
        const orderResponse = await fetch(`https://api.sandbox.paypal.com/v2/checkout/orders/${orderID}`, {
            headers: { 'Authorization': `Bearer ${paypalToken}` }
        });
        const orderData = await orderResponse.json();
        if (orderData.status !== 'COMPLETED' && orderData.status !== 'APPROVED') {
            return { statusCode: 400, body: JSON.stringify({ error: `Статус платежу не є успішним: ${orderData.status}` }) };
        }
        const amountPaid = parseFloat(orderData.purchase_units[0].amount.value);

        // 4. Отримуємо актуальний баланс користувача (використовуючи його власний токен)
        // Це потрібно, щоб уникнути стану гонки, якщо користувач відкрив дві вкладки
        const userApiUrl = `${user.url}/user`;
        const currentUserResponse = await fetch(userApiUrl, {
            headers: { 'Authorization': `Bearer ${token.access_token}` }
        });
        if (!currentUserResponse.ok) throw new Error("Не вдалося отримати актуальні дані користувача.");
        const currentUserData = await currentUserResponse.json();
        const currentBalance = currentUserData.user_metadata.balance || 0;
        
        // 5. Розраховуємо новий баланс
        const newBalance = currentBalance + amountPaid;

        // 6. Оновлюємо баланс в user_metadata від імені самого користувача
        const updateUserResponse = await fetch(userApiUrl, {
            method: 'PUT',
            headers: { 
                'Authorization': `Bearer ${token.access_token}`, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({
                data: { // Важливо! Дані для user_metadata йдуть в полі 'data'
                    ...currentUserData.user_metadata, // Зберігаємо інші метадані, якщо вони є
                    balance: newBalance 
                } 
            })
        });

        if (!updateUserResponse.ok) {
            throw new Error(`Не вдалося оновити баланс користувача: ${await updateUserResponse.text()}`);
        }

        // 7. ЗАХИСТ: Позначаємо платіж як використаний, щоб запобігти повторному використанню
        await ordersStore.set(orderID, { userId: user.sub, timestamp: new Date().toISOString() });
        
        // 8. Повертаємо успішну відповідь
        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, newBalance: newBalance }),
        };

    } catch (error) {
        console.error('Критична помилка у функції оновлення балансу:', error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};
