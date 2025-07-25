// /functions/get-trash.js
const { getFile } = require('./db-manager');

exports.handler = async (event, context) => {
    // За замовчуванням ця функція є публічною.
    // Для адмін-панелі її варто було б захистити перевіркою паролю або токену,
    // але для простоти реалізації зараз вона відкрита.

    try {
        // Використовуємо нашу універсальну функцію для читання файлу кошика
        const { data } = await getFile('trash.json');
        
        return {
            statusCode: 200,
            body: JSON.stringify(data),
        };
    } catch (error) {
        console.error("Помилка отримання даних з кошика:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Не вдалося завантажити дані з кошика.' }),
        };
    }
};
