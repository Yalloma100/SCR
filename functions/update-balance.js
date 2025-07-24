// functions/update-balance.js

const fetch = require('node-fetch');

async function getPaypalAccessToken(clientId, clientSecret) {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await fetch('https://api.sandbox.paypal.com/v1/oauth2/token', {
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

        const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, NETLIFY_API_TOKEN } = process.env;
        
        const paypalToken = await getPaypalAccessToken(PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET);
        const orderResponse = await fetch(`https://api.sandbox.paypal.com/v2/checkout/orders/${orderID}`, {
            headers: {
                'Authorization': `Bearer ${paypalToken}`,
            },
        });
        
        const orderData = await orderResponse.json();
        
        if (orderData.status !== 'COMPLETED' && orderData.status !== 'APPROVED') {
            return { statusCode: 400, body: JSON.stringify({ error: `Статус платежу: ${orderData.status}` }) };
        }

        const amountPaid = parseFloat(orderData.purchase_units[0].amount.value);
        const currency = orderData.purchase_units[0].amount.currency_code;
        
        if (currency !== 'USD') {
            return { statusCode: 400, body: JSON.stringify({ error: 'Підтримується тільки валюта USD.' }) };
        }

        const currentBalance = user.user_metadata.balance || 0;
        const newBalance = currentBalance + amountPaid;

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
