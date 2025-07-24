// ТИМЧАСОВА ВЕРСІЯ ДЛЯ ТЕСТУВАННЯ - НЕБЕЗПЕЧНО ДЛЯ ПРОДАШКИНУ!

const fetch = require('node-fetch');

// --- ЗАМІНІТЬ ЦІ ЗНАЧЕННЯ НА ВАШІ РЕАЛЬНІ ДАНІ ---
const PAYPAL_CLIENT_ID     = "ASJIOL6y24xuwQiCC-a8RBkVypAp5VuYLf7cXEIzc4aLV5yYEXDVvellq-OGQQfZjkqJBZh1h0JqS9mU"; // <--- ВСТАВТЕ ВАШ PAYPAL CLIENT ID
const PAYPAL_CLIENT_SECRET = "EJ4fJwwhV6PIVwQBJkvXSPRf8OWm6sVLYPXgQpqr4_GuMN_PIaaDpevPGg4AR-VlRu2Uly7x4NmsdGeY";    // <--- ВСТАВТЕ ВАШ PAYPAL CLIENT SECRET
const NETLIFY_API_TOKEN    = "nfp_Hv9X1JNB9EqRxxLMB2YCnaUgzcL1GLoA6620";       // <--- ВСТАВТЕ ВАШ NETLIFY API TOKEN
// ---------------------------------------------------


async function getPaypalAccessToken(clientId, clientSecret) {
    if (!clientId || !clientSecret) {
        throw new Error('Відсутні PayPal Client ID або Client Secret.');
    }
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await fetch('https://api.sandbox.paypal.com/v1/oauth2/token', {
        method: 'POST',
        headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=client_credentials'
    });
    const data = await response.json();
    return data.access_token;
}

exports.handler = async (event, context) => {
    console.log("Функція update-balance викликана (ТЕСТОВА ВЕРСІЯ).");

    const { user } = context.clientContext;
    if (!user) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Ви не авторизовані.' }) };
    }

    try {
        const { orderID } = JSON.parse(event.body);
        if (!orderID) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Відсутній ID замовлення.' }) };
        }
        
        // Перевіряємо, чи всі змінні були вставлені
        if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET || !NETLIFY_API_TOKEN || PAYPAL_CLIENT_SECRET === "ВАШ_PAYPAL_CLIENT_SECRET") {
             throw new Error("Секретні ключі не були вставлені в код функції.");
        }
        console.log("Змінні завантажені напряму з коду.");

        const paypalToken = await getPaypalAccessToken(PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET);
        console.log("Отримано токен доступу PayPal.");

        const orderResponse = await fetch(`https://api.sandbox.paypal.com/v2/checkout/orders/${orderID}`, {
            headers: { 'Authorization': `Bearer ${paypalToken}` }
        });
        
        const orderData = await orderResponse.json();
        console.log(`Отримано дані замовлення від PayPal. Статус: ${orderData.status}`);
        
        if (orderData.status !== 'COMPLETED' && orderData.status !== 'APPROVED') {
            return { statusCode: 400, body: JSON.stringify({ error: `Статус платежу: ${orderData.status}` }) };
        }

        const amountPaid = parseFloat(orderData.purchase_units[0].amount.value);
        const currency = orderData.purchase_units[0].amount.currency_code;
        
        if (currency !== 'USD') {
            return { statusCode: 400, body: JSON.stringify({ error: 'Підтримується тільки валюта USD.' }) };
        }
        console.log(`Платіж успішний. Сума: ${amountPaid} ${currency}`);

        const currentBalance = user.user_metadata.balance || 0;
        const newBalance = currentBalance + amountPaid;
        console.log(`Оновлення балансу: з ${currentBalance} на ${newBalance}`);

        const netlifyAPI = `https://api.netlify.com/api/v1/users/${user.sub}`;
        const updateUserResponse = await fetch(netlifyAPI, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${NETLIFY_API_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_metadata: { ...user.user_metadata, balance: newBalance } })
        });

        if (!updateUserResponse.ok) {
            const errorBody = await updateUserResponse.text();
            console.error("Помилка оновлення користувача в Netlify:", errorBody);
            throw new Error('Не вдалося оновити баланс користувача.');
        }
        console.log("Баланс користувача в Netlify успішно оновлено.");

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, newBalance: newBalance }),
        };

    } catch (error) {
        console.error('КРАХ ФУНКЦІЇ:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};
