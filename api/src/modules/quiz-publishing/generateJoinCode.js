function generateJoinCode(length = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let joinCode = "";

  for (let index = 0; index < length; index += 1) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    joinCode += chars[randomIndex];
  }

  return joinCode;
}

module.exports = generateJoinCode;
