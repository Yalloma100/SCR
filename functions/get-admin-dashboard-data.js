// /functions/get-admin-dashboard-data.js
const { getFile } = require('./db-manager');

exports.handler = async (event, context) => {
    // Тут можна додати перевірку пароля адміна для безпеки, якщо потрібно
    
    try {
        const [investmentsResult, usersResult] = await Promise.all([
            getFile('investments.json'),
            getFile('users.json')
        ]);

        const investments = investmentsResult.data;
        const users = usersResult.data;
        
        // Створюємо мапу для підрахунку покупок
        const purchaseCounts = new Map();

        // Ітеруємо по всіх користувачах
        for (const userId in users) {
            const userData = users[userId];
            // ВИПРАВЛЕНО: Перевіряємо, чи існує масив покупок, перед тим як його обробляти
            if (userData.purchases && Array.isArray(userData.purchases)) {
                userData.purchases.forEach(purchase => {
                    const investmentId = purchase.investmentId;
                    // Збільшуємо лічильник для відповідного вкладення
                    purchaseCounts.set(investmentId, (purchaseCounts.get(investmentId) || 0) + 1);
                });
            }
        }

        // Додаємо кількість покупок до кожного об'єкту вкладення
        const investmentsWithStats = investments.map(inv => ({
            ...inv,
            purchaseCount: purchaseCounts.get(inv.id) || 0 // Отримуємо значення з мапи
        }));

        return {
            statusCode: 200,
            body: JSON.stringify({
                investments: investmentsWithStats,
                users: users
            }),
        };
    } catch (error) {
        console.error("Помилка отримання даних для адмін-панелі:", error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
