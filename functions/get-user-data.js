// /functions/get-user-data.js
const { performTransactionalUpdate } = require('./db-manager');

exports.handler = async (event, context) => {
    const { user } = context.clientContext;
    if (!user) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Ви не авторизовані.' }) };
    }
    const userId = user.sub;

    try {
        // Використовуємо транзакційний апдейт, щоб безпечно створити користувача, якщо його нема
        const updatedUsersData = await performTransactionalUpdate('users.json', (usersData) => {
            if (!usersData[userId]) {
                // Створюємо запис для нового користувача
                usersData[userId] = {
                    email: user.email,
                    full_name: user.user_metadata.full_name || 'Ім\'я не вказано',
                    balance: 0, // Початковий баланс
                    purchases: []
                };
            }
            return usersData;
        });

        return {
            statusCode: 200,
            body: JSON.stringify(updatedUsersData[userId]), // Повертаємо дані тільки цього користувача
        };
    } catch (error) {
        console.error("Помилка отримання даних користувача:", error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
