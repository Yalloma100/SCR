const { getFile } = require('./db-manager');

exports.handler = async () => {
    try {
        // Використовуємо нашу функцію для читання файлу
        const { data } = await getFile('investments.json');
        return {
            statusCode: 200,
            body: JSON.stringify(data),
        };
    } catch (error) {
        console.error("Помилка отримання вкладень:", error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
