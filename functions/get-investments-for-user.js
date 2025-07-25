// /functions/get-investments-for-user.js
const { getFile } = require('./db-manager');

exports.handler = async (event, context) => {
    // Перевірка авторизації користувача
    const { user } = context.clientContext;
    if (!user) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Ви не авторизовані.' }) };
    }
    const userId = user.sub;

    try {
        // Асинхронно отримуємо обидва файли
        const [investmentsResult, usersResult] = await Promise.all([
            getFile('investments.json'),
            getFile('users.json')
        ]);

        const allInvestments = investmentsResult.data;
        const allUsersData = usersResult.data;
        
        // Отримуємо покупки конкретного користувача, якщо він існує в нашій БД
        const userPurchases = allUsersData[userId] ? allUsersData[userId].purchases : [];

        return {
            statusCode: 200,
            body: JSON.stringify({
                investments: allInvestments,
                userPurchaseIds: userPurchases // Масив ID куплених вкладень
            }),
        };
    } catch (error) {
        console.error("Помилка отримання даних для користувача:", error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
