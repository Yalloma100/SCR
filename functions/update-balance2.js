exports.handler = async (event, context) => {
  const body = JSON.parse(event.body);
  const orderID = body.orderID;

  console.log('Отримано orderID:', orderID);

  // Тут можна перевірити статус у PayPal або оновити баланс у базі даних
  const updatedBalance = 100; // тестове значення

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, newBalance: updatedBalance })
  };
};
