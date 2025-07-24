// Шлях до файлу: /functions/update-balance.js

const fetch = require('node-fetch');

const PAYPAL_CLIENT_ID     = "ASJIOL6y24xuwQiCC-a8RBkVypAp5VuYLf7cXEIzc4aLV5yYEXDVvellq-OGQQfZjkqJBZh1h0JqS9mU";
const PAYPAL_CLIENT_SECRET = "EJ4fJwwhV6PIVwQBJkvXSPRf8OWm6sVLYPXgQpqr4_GuMN_PIaaDpevPGg4AR-VlRu2Uly7x4NmsdGeY";

// Функція для отримання токена PayPal залишається без змін
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
    // Перевіряємо, чи авторизований користувач
    if (!context.clientContext.user) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Ви не авторизовані.' }) };
    }

    try {
        const { orderID } = JSON.parse(event.body);
        if (!orderID) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Відсутній ID замовлення.' }) };
        }
        
        // Перевіряємо платіж PayPal
        const paypalToken = await getPaypalAccessToken(PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET);
        const orderResponse = await fetch(`https://api.sandbox.paypal.com/v2/checkout/orders/${orderID}`, {
            headers: { 'Authorization': `Bearer ${paypalToken}` }
        });
        
        const orderData = await orderResponse.json();
        if (orderData.status !== 'COMPLETED' && orderData.status !== 'APPROVED') {
            return { statusCode: 400, body: JSON.stringify({ error: `Статус платежу не є успішним: ${orderData.status}` }) };
        }

        // Отримуємо сплачену суму
        const amountPaid = parseFloat(orderData.purchase_units[0].amount.value);
        console.log(`Платіж успішний. Сума: ${amountPaid} USD`);

        // Повертаємо тільки суму платежу
        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, amountPaid: amountPaid }),
        };

    } catch (error) {
        console.error('Помилка у функції верифікації платежу:', error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};
