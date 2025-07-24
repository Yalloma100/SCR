exports.handler = async function(event, context) {
  try {
    const secret = event.headers.authorization;

    if (secret !== 'Bearer 4b4d4306-2e78-4707-bd6d-13b1c2e78ba3') {
      return {
        statusCode: 401,
        body: JSON.stringify({ message: 'Not authorized' })
      };
    }

    const { user } = context.clientContext;

    if (!user || !user.email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'No user info available' })
      };
    }

    const { amount } = JSON.parse(event.body);
    if (typeof amount !== 'number') {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Invalid amount' })
      };
    }

    // Отримуємо список всіх користувачів Netlify Identity
    const findUserResp = await fetch(`https://api.netlify.com/api/v1/identity/users`, {
      headers: {
        'Authorization': `Bearer xz2gGgJzxYtYWbLFzJeYNfYVHYDk42t77OzLhDTXKZkOarYZ7Jz2D4Qp2wY0rfFt`
      }
    });

    if (!findUserResp.ok) {
      const errorText = await findUserResp.text();
      console.error("Помилка при пошуку користувача:", errorText);
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Failed to fetch users from Netlify Identity' })
      };
    }

    const allUsers = await findUserResp.json();
    const identityUser = allUsers.find(u => u.email === user.email);

    if (!identityUser) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'User not found in Netlify Identity' })
      };
    }

    const currentBalance = identityUser.app_metadata?.balance || 0;
    const newBalance = currentBalance + amount;

    // Оновлення користувача з новим балансом
    const updateUserResponse = await fetch(`https://api.netlify.com/api/v1/identity/users/${identityUser.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer xz2gGgJzxYtYWbLFzJeYNfYVHYDk42t77OzLhDTXKZkOarYZ7Jz2D4Qp2wY0rfFt`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        app_metadata: {
          ...identityUser.app_metadata,
          balance: newBalance
        }
      })
    });

    if (!updateUserResponse.ok) {
      const errorText = await updateUserResponse.text();
      console.error("Помилка при оновленні користувача:", errorText);
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Failed to update user metadata' })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Balance updated', balance: newBalance })
    };
  } catch (error) {
    console.error("Internal error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal server error' })
    };
  }
};
