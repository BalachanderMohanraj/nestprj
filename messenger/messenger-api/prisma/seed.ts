// import * as dotenv from 'dotenv';
// dotenv.config();
// import { PrismaClient } from '@prisma/client'
// // import { PrismaClient } from '../src/generated/client';
// import { PrismaPg } from '@prisma/adapter-pg';
// import pg from 'pg';

// // 1. Declare variables here so they are accessible to .finally()
// const connectionString = process.env.DATABASE_URL;
// const pool = new pg.Pool({ connectionString });
// const adapter = new PrismaPg(pool);
// const prisma = new PrismaClient({ adapter });

// async function main() {
//   console.log('--- Start Seeding ---');

//   // 1. Create Users
//   const user1 = await prisma.user.upsert({
//     where: { email: 'alice@example.com' },
//     update: {},
//     create: {
//       email: 'alice@example.com',
//       username: 'alice_wonder',
//     },
//   });

//   const user2 = await prisma.user.upsert({
//     where: { email: 'bob@example.com' },
//     update: {},
//     create: {
//       email: 'bob@example.com',
//       username: 'builder_bob',
//     },
//   });

//   console.log(`Created users: ${user1.username} and ${user2.username}`);

//   // 2. Create a Conversation between them
//   const conversation = await prisma.conversation.create({
//     data: {
//       users: {
//         connect: [{ id: user1.id }, { id: user2.id }],
//       },
//     },
//   });

//   console.log(`Created conversation ID: ${conversation.id}`);

//   // 3. Create an initial Message
//   const message = await prisma.message.create({
//     data: {
//       content: 'Hello Bob! This is a test message.',
//       senderId: user1.id,
//       conversationId: conversation.id,
//     },
//   });

//   console.log(`Created message: "${message.content}" from ${user1.username}`);
//   console.log('--- Seeding Finished ---');
// }

// main()
//   .catch((e) => {
//     console.error(e);
//     process.exit(1);
//   })
//   .finally(async () => {
//     // 2. Now these will work!
//     await prisma.$disconnect();
//     await pool.end();
//   });