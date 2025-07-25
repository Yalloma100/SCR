// /functions/db-manager.js
const { Octokit } = require("@octokit/rest");

const { GITHUB_TOKEN, GITHUB_USER, GITHUB_REPO, DB_PATH } = process.env;

const octokit = new Octokit({ auth: GITHUB_TOKEN });

const owner = GITHUB_USER;
const repo = GITHUB_REPO;

// Функція для безпечного читання файлу
async function getFile(filename) {
    try {
        const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path: `${DB_PATH}/${filename}`,
        });
        const content = Buffer.from(data.content, 'base64').toString('utf-8');
        return { data: JSON.parse(content), sha: data.sha };
    } catch (error) {
        if (error.status === 404) {
            // Якщо файл не знайдено, повертаємо порожню структуру
            const initialData = filename === 'users.json' ? {} : [];
            return { data: initialData, sha: null };
        }
        throw error;
    }
}

// Функція для безпечного запису файлу
async function updateFile(filename, data, sha) {
    const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
    
    // Якщо sha=null, це означає, що файл створюється вперше
    if (!sha) {
        return octokit.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: `${DB_PATH}/${filename}`,
            message: `feat: Create ${filename}`,
            content,
        });
    }

    // Інакше оновлюємо існуючий файл, передаючи його SHA
    return octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: `${DB_PATH}/${filename}`,
        message: `feat: Update ${filename} via API`,
        content,
        sha,
    });
}


// Універсальна функція-обгортка для оновлення з ретраями ("черга")
async function performTransactionalUpdate(filename, updateLogic) {
    const MAX_RETRIES = 5;
    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            // 1. Читаємо поточний стан файлу та його SHA
            const { data, sha } = await getFile(filename);

            // 2. Виконуємо логіку оновлення, передану ззовні
            const newData = updateLogic(data);

            // 3. Намагаємося записати зміни
            await updateFile(filename, newData, sha);

            // Якщо запис успішний, виходимо з циклу
            return newData;

        } catch (error) {
            // 409 Conflict означає, що хтось інший оновив файл, поки ми працювали
            if (error.status === 409) {
                // Чекаємо випадковий час перед повторною спробою
                await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
                continue; // Переходимо до наступної ітерації циклу
            }
            // Якщо інша помилка, прокидуємо її
            throw error;
        }
    }
    // Якщо всі спроби провалилися
    throw new Error(`Не вдалося оновити ${filename} після ${MAX_RETRIES} спроб.`);
}


module.exports = { getFile, performTransactionalUpdate };
