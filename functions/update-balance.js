// /functions/update-balance.js
const fetch = require('node-fetch');
const { performTransactionalUpdate } = require('./db-manager');

const PAYPAL_CLIENT_ID     = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;

// Функція для отримання токена PayPal
async function getPaypalAccessToken() {
    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
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
    const userId = context.clientContext.user.sub;
    const user = context.clientContext.user;

    try {
        const { orderID } = JSON.parse(event.body);
        if (!orderID) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Відсутній ID замовлення.' }) };
        }
        
        // Перевіряємо платіж PayPal
        const paypalToken = await getPaypalAccessToken();
        const orderResponse = await fetch(`https://api.sandbox.paypal.com/v2/checkout/orders/${orderID}`, {
            headers: { 'Authorization': `Bearer ${paypalToken}` }
        });
        
        const orderData = await orderResponse.json();
        if (orderData.status !== 'COMPLETED' && orderData.status !== 'APPROVED') {
            return { statusCode: 400, body: JSON.stringify({ error: `Статус платежу не є успішним: ${orderData.status}` }) };
        }

        // Отримуємо сплачену суму
        const amountPaid = parseFloat(orderData.purchase_units[0].amount.value);
        
        // Оновлюємо баланс транзакційно в users.json
        await performTransactionalUpdate('users.json', (usersData) => {
            if (!usersData[userId]) {
                usersData[userId] = {
                    email: user.email,
                    full_name: user.user_metadata.full_name || 'Ім\'я не вказано',
                    balance: 0,
                    purchases: []
                };
            }
            usersData[userId].balance += amountPaid;
            return usersData;
        });

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
