// functions/update-balance.js

// Потрібно встановити node-fetch: npm install node-fetch@2
const fetch = require('node-fetch');

// Функція для отримання PayPal Access Token
async function getPaypalAccessToken(clientId, clientSecret) {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await fetch('https://api.sandbox.paypal.com/v1/oauth2/token', { // Використовуйте api.paypal.com для реальних платежів
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
    });
    const data = await response.json();
    return data.access_token;
}

exports.handler = async (event, context) => {
    // 1. Перевірка, чи користувач авторизований
    const { user } = context.clientContext;
    if (!user) {
        return {
            statusCode: 401,
            body: JSON.stringify({ error: 'Ви не авторизовані.' }),
        };
    }

    try {
        const { orderID } = JSON.parse(event.body);
        if (!orderID) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Відсутній ID замовлення.' }) };
        }

        // 2. Безпечно отримуємо змінні середовища
        const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, NETLIFY_API_TOKEN } = process.env;
        
        // 3. Звертаємось до PayPal API, щоб отримати деталі замовлення
        const paypalToken = await getPaypalAccessToken(PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET);
        const orderResponse = await fetch(`https://api.sandbox.paypal.com/v2/checkout/orders/${orderID}`, { // Використовуйте api.paypal.com для реальних платежів
            headers: {
                'Authorization': `Bearer ${paypalToken}`,
            },
        });
        
        const orderData = await orderResponse.json();
        
        // 4. Перевіряємо, чи статус замовлення 'COMPLETED' або 'APPROVED'
        if (orderData.status !== 'COMPLETED' && orderData.status !== 'APPROVED') {
            return { statusCode: 400, body: JSON.stringify({ error: `Статус платежу: ${orderData.status}` }) };
        }

        // 5. Отримуємо суму з надійного джерела - відповіді від PayPal
        const amountPaid = parseFloat(orderData.purchase_units[0].amount.value);
        const currency = orderData.purchase_units[0].amount.currency_code;
        
        if (currency !== 'USD') {
            return { statusCode: 400, body: JSON.stringify({ error: 'Підтримується тільки валюта USD.' }) };
        }

        // 6. Отримуємо поточний баланс користувача з Netlify Identity
        const currentBalance = user.user_metadata.balance || 0;
        const newBalance = currentBalance + amountPaid; // 1 USD = 1 SCR

        // 7. Оновлюємо дані користувача через Netlify Admin API
        const netlifyAPI = `https://api.netlify.com/api/v1/users/${user.sub}`;
        const updateUserResponse = await fetch(netlifyAPI, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${NETLIFY_API_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user_metadata: {
                    ...user.user_metadata,
                    balance: newBalance,
                },
            }),
        });

        if (!updateUserResponse.ok) {
            throw new Error('Не вдалося оновити баланс користувача.');
        }

        // 8. Повертаємо успішну відповідь на фронтенд
        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, newBalance: newBalance }),
        };

    } catch (error) {
        console.error('Server Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};