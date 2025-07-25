// /functions/get-investments.js
const { getFile } = require('./db-manager');

exports.handler = async (event, context) => {
    // Ця функція є публічною і не потребує авторизації,
    // оскільки вона просто читає загальнодоступний список.
    // Якщо ви хочете її захистити, додайте перевірку context.clientContext.user

    try {
        // Використовуємо нашу універсальну функцію для читання файлу
        const { data } = await getFile('investments.json');
        
        return {
            statusCode: 200,
            body: JSON.stringify(data),
        };
    } catch (error) {
        console.error("Помилка отримання вкладень:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Не вдалося завантажити дані про вкладення.' }),
        };
    }
};
