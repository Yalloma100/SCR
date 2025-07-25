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
        
        // Отримуємо дані конкретного користувача, якщо він існує в нашій БД
        const userData = allUsersData[userId];

        // ВИПРАВЛЕНО: Визначаємо покупки та баланс, навіть якщо користувача ще немає
        const userPurchases = userData ? userData.purchases || [] : [];
        const userBalance = userData ? userData.balance || 0 : 0;

        // Повертаємо повний набір даних
        return {
            statusCode: 200,
            body: JSON.stringify({
                investments: allInvestments,
                userPurchaseIds: userPurchases,
                balance: userBalance // Тепер це поле завжди буде присутнім
            }),
        };
    } catch (error) {
        console.error("Помилка отримання даних для користувача:", error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
