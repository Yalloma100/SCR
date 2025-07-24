// Шлях до файлу: /functions/update-balance.js

const fetch = require('node-fetch');

// Ваші ключі PayPal залишаються без змін
const PAYPAL_CLIENT_ID     = "ASJIOL6y24xuwQiCC-a8RBkVypAp5VuYLf7cXEIzc4aLV5yYEXDVvellq-OGQQfZjkqJBZh1h0JqS9mU";
const PAYPAL_CLIENT_SECRET = "EJ4fJwwhV6PIVwQBJkvXSPRf8OWm6sVLYPXgQpqr4_GuMN_PIaaDpevPGg4AR-VlRu2Uly7x4NmsdGeY";
// АДМІНІСТРАТИВНИЙ ТОКЕН БІЛЬШЕ НЕ ПОТРІБЕН
// const NETLIFY_API_TOKEN = " ... ";

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
    // 1. Отримуємо дані про користувача та його токен доступу з контексту
    const { user, token } = context.clientContext;
    if (!user) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Ви не авторизовані для виконання цієї дії.' }) };
    }

    try {
        const { orderID } = JSON.parse(event.body);
        if (!orderID) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Відсутній ID замовлення.' }) };
        }
        
        console.log(`Функція викликана для користувача: ${user.email}`);

        // 2. Перевірка платежу PayPal (ця логіка залишається)
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

        // 3. Розрахунок нового балансу
        const currentBalance = user.app_metadata.balance || 0;
        const newBalance = currentBalance + amountPaid;
        console.log(`Розраховано новий баланс: з ${currentBalance} на ${newBalance}`);

        // 4. ОНОВЛЕНА ЛОГІКА: Оновлюємо дані від імені самого користувача
        // Ми звертаємось до того ж ендпоінту, що і user.update(), але з серверу
        const netlifyUpdateUrl = `${user.url}/user`;
        
        const updateUserResponse = await fetch(netlifyUpdateUrl, {
            method: 'PUT',
            headers: { 
                // ВИКОРИСТОВУЄМО ТОКЕН КОРИСТУВАЧА, А НЕ АДМІНА
                'Authorization': `Bearer ${token.access_token}`, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({
                // Зберігаємо в безпечному місці
                app_metadata: { 
                    ...user.app_metadata, 
                    balance: newBalance 
                } 
            })
        });

        if (!updateUserResponse.ok) {
            const errorText = await updateUserResponse.text();
            console.error("Помилка оновлення користувача через Identity:", errorText);
            throw new Error(`Не вдалося оновити баланс. Відповідь від Identity: ${errorText}`);
        }
        
        console.log("Баланс користувача успішно оновлено через Identity endpoint.");

        // 5. Повернення успішної відповіді
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
