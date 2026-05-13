const bcrypt = require("bcryptjs");

const DEV_USERS = [
  {
    name: "Dev Admin",
    email: "dev@quivora.local",
    password: "devpassword123",
  },
  {
    name: "Demo Admin",
    email: "admin@quivora.local",
    password: "Admin@12345",
  },
];

async function seedDevUser() {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  const User = require("../modules/participants/User");

  for (const userSeed of DEV_USERS) {
    const existing = await User.findOne({ email: userSeed.email });

    if (existing) {
      continue;
    }

    const passwordHash = await bcrypt.hash(userSeed.password, 10);

    await User.create({
      name: userSeed.name,
      email: userSeed.email,
      role: "admin",
      passwordHash,
      authProvider: "local",
      isVerified: true,
      avatar: "",
    });
  }

  console.log("[Dev Seed] Local admins ready:");
  DEV_USERS.forEach((userSeed) => {
    console.log(`  ${userSeed.email} / ${userSeed.password}`);
  });
}

module.exports = { seedDevUser };
