// Шлях до файлу: /functions/update-balance.js

const fetch = require('node-fetch');

const PAYPAL_CLIENT_ID     = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const NETLIFY_API_TOKEN    = process.env.NETLIFY_API_TOKEN; // Отримуємо токен з середовища
const NETLIFY_SITE_URL     = process.env.URL; // URL вашого сайту

// Функція для отримання токена PayPal (без змін)
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
    // 1. Перевіряємо, чи авторизований користувач
    const { user } = context.clientContext;
    if (!user) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Ви не авторизовані.' }) };
    }

    try {
        const { orderID } = JSON.parse(event.body);
        if (!orderID) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Відсутній ID замовлення.' }) };
        }

        // 2. Перевіряємо платіж PayPal (без змін)
        const paypalToken = await getPaypalAccessToken(PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET);
        const orderResponse = await fetch(`https://api.sandbox.paypal.com/v2/checkout/orders/${orderID}`, {
            headers: { 'Authorization': `Bearer ${paypalToken}` }
        });
        const orderData = await orderResponse.json();

        if (orderData.status !== 'COMPLETED' && orderData.status !== 'APPROVED') {
            return { statusCode: 400, body: JSON.stringify({ error: `Статус платежу не є успішним: ${orderData.status}` }) };
        }

        const amountPaid = parseFloat(orderData.purchase_units[0].amount.value);
        
        // 3. Отримуємо повні дані користувача через адмін-API
        const adminUrl = `${NETLIFY_SITE_URL}/.netlify/identity/admin/users/${user.sub}`;
        const userResponse = await fetch(adminUrl, {
            headers: { 'Authorization': `Bearer ${NETLIFY_API_TOKEN}` }
        });
        if (!userResponse.ok) throw new Error("Не вдалося отримати дані користувача.");
        
        const userData = await userResponse.json();

        // 4. Розраховуємо новий баланс, читаючи з app_metadata
        const currentBalance = userData.app_metadata.balance || 0;
        const newBalance = currentBalance + amountPaid;

        // 5. Оновлюємо баланс в app_metadata через адмін-API
        const updateUserResponse = await fetch(adminUrl, {
            method: 'PUT',
            headers: { 
                'Authorization': `Bearer ${NETLIFY_API_TOKEN}`, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({
                app_metadata: { 
                    ...userData.app_metadata, 
                    balance: newBalance 
                } 
            })
        });

        if (!updateUserResponse.ok) {
            const errorText = await updateUserResponse.text();
            throw new Error(`Не вдалося оновити баланс: ${errorText}`);
        }
        
        // 6. Повертаємо новий баланс клієнту для відображення
        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, newBalance: newBalance }),
        };

    } catch (error) {
        console.error('Критична помилка у функції:', error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};
