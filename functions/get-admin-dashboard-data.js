// /functions/get-admin-dashboard-data.js
const { getFile } = require('./db-manager');

exports.handler = async () => {
    try {
        const [investmentsResult, usersResult] = await Promise.all([
            getFile('investments.json'),
            getFile('users.json')
        ]);

        const investments = investmentsResult.data;
        const users = usersResult.data;
        
        // Підраховуємо кількість покупок для кожного вкладення
        const purchaseCounts = {};
        Object.values(users).forEach(userData => {
            if (userData.purchases) {
                userData.purchases.forEach(purchaseId => {
                    purchaseCounts[purchaseId] = (purchaseCounts[purchaseId] || 0) + 1;
                });
            }
        });

        // Додаємо кількість покупок до кожного об'єкту вкладення
        const investmentsWithStats = investments.map(inv => ({
            ...inv,
            purchaseCount: purchaseCounts[inv.id] || 0
        }));

        return {
            statusCode: 200,
            body: JSON.stringify({
                investments: investmentsWithStats,
                users: users // Також повертаємо дані користувачів для модального вікна
            }),
        };
    } catch (error) {
        console.error("Помилка отримання даних для адмін-панелі:", error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
