import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedDemoData } from "../src/lib/demo-data";

const db = new PrismaClient();

const DEMO_EMAIL = "demo@finsight.app";
const DEMO_PASSWORD = "Demo@1234";

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 11);
  const user = await db.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { passwordHash, onboarded: true, isDemo: true },
    create: {
      email: DEMO_EMAIL,
      name: "Aarav Sharma",
      passwordHash,
      onboarded: true,
      isDemo: true,
      preference: {
        create: {
          currency: "INR",
          theme: "dark",
          monthlyIncome: 68000 * 100,
          budgetingStyle: "50-30-20",
          financialGoals: JSON.stringify(["save_more", "emergency_fund", "big_purchase"]),
        },
      },
    },
  });
  await db.userPreference.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id, monthlyIncome: 68000 * 100, budgetingStyle: "50-30-20" },
  });

  const result = await seedDemoData(db, user.id);
  console.log(`Seeded demo account ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(result);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
