// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding ...');
  const adminPassword = await bcrypt.hash(process.env.ADMIN1_PASSWORD || 'Admin123!', 10); // Use env var

  const admin1 = await prisma.user.upsert({
    where: { username: process.env.ADMIN1_USERNAME || 'admin1' },
    update: {},
    create: {
      username: process.env.ADMIN1_USERNAME || 'admin1',
      password: adminPassword,
      fullName: 'Main Administrator',
      email: process.env.ADMIN1_EMAIL || 'admin1@tassiac.church',
      phone: process.env.ADMIN1_PHONE || '0700000001',
      isAdmin: true,
      role: 'SUPER_ADMIN', // Assuming you add a 'role' field
      isActive: true,
    },
  });
  console.log({ admin1 });
  // Add other admin users (admin2 to admin5, potentially with different roles)
  // Example for a view-only admin:
  const admin3Password = await bcrypt.hash(process.env.ADMIN3_PASSWORD || 'Admin3View!', 10);
  const admin3 = await prisma.user.upsert({
      where: { username: process.env.ADMIN3_USERNAME || 'admin3' },
      update: {},
      create: {
          username: process.env.ADMIN3_USERNAME || 'admin3',
          password: admin3Password,
          fullName: 'View-Only Admin User 3',
          email: process.env.ADMIN3_EMAIL || 'admin3@tassiac.church',
          phone: process.env.ADMIN3_PHONE || '0700000003',
          isAdmin: true,
          role: 'VIEW_ONLY_ADMIN', // Set specific role
          isActive: true,
      }
  });
   console.log({ admin3 });

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });