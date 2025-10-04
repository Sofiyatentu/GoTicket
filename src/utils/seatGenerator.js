const generateSeats = (rows, seatsPerRow, categories, basePrice) => {
  const seats = [];
  const rowLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  for (let row = 0; row < rows; row++) {
    const rowLetter = rowLetters[row];
    const category = categories[row] || "standard";

    // Different pricing based on category
    let price;
    switch (category) {
      case "premium":
        price = basePrice * 1.5;
        break;
      case "balcony":
        price = basePrice * 0.8;
        break;
      default:
        price = basePrice;
    }

    for (let seatNum = 1; seatNum <= seatsPerRow; seatNum++) {
      seats.push({
        seat_code: `${rowLetter}${seatNum}`,
        category: category,
        price: price,
        status: "available",
      });
    }
  }

  return seats;
};

export default generateSeats;
