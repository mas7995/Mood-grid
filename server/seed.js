// Seed one demo profile with a few sample moods so the grid isn't empty on first look.
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const MOODS = ["happy", "content", "neutral", "sad", "angry", "overwhelmed"];

async function main() {
  const name = "Demo";
  const email = "demo@example.com";
  const password = "password";
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { name, email, passwordHash },
  });

  // Log moods for the last 14 days.
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const date = new Date(d.toISOString().slice(0, 10));
    const mood = MOODS[Math.floor(Math.random() * MOODS.length)];
    await prisma.entry.upsert({
      where: { userId_entryDate: { userId: user.id, entryDate: date } },
      update: { mood },
      create: { userId: user.id, entryDate: date, mood },
    });
  }

  console.log(`Seeded account ${email} (password "${password}") with 14 days of moods.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
