import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2] || 'admin@ausbildungsgenie.de';
  const password = process.argv[3] || 'Admin2026!';
  const name = process.argv[4] || 'Admin';

  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin ${email} existiert bereits.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.adminUser.create({
    data: {
      email,
      passwordHash,
      name,
      role: 'superadmin',
    },
  });

  console.log(`Admin erstellt:`);
  console.log(`  ID: ${admin.id}`);
  console.log(`  Email: ${admin.email}`);
  console.log(`  Name: ${admin.name}`);
  console.log(`  Role: ${admin.role}`);
  console.log(`  Password: ${password}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
