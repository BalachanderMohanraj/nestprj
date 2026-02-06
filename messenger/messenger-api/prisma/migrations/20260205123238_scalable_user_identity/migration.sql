/*
  Warnings:

  - You are about to drop the column `avatarUrl` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `Conversation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Message` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_ConversationToUser` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[gmail]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[mobilenumber]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `fname` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `gmail` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lname` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mobilenumber` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `password` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_conversationId_fkey";

-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_senderId_fkey";

-- DropForeignKey
ALTER TABLE "_ConversationToUser" DROP CONSTRAINT "_ConversationToUser_A_fkey";

-- DropForeignKey
ALTER TABLE "_ConversationToUser" DROP CONSTRAINT "_ConversationToUser_B_fkey";

-- DropIndex
DROP INDEX "User_email_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "avatarUrl",
DROP COLUMN "email",
ADD COLUMN     "fname" TEXT NOT NULL,
ADD COLUMN     "gmail" TEXT NOT NULL,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "lname" TEXT NOT NULL,
ADD COLUMN     "mname" TEXT,
ADD COLUMN     "mobilenumber" TEXT NOT NULL,
ADD COLUMN     "password" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- DropTable
DROP TABLE "Conversation";

-- DropTable
DROP TABLE "Message";

-- DropTable
DROP TABLE "_ConversationToUser";

-- CreateIndex
CREATE UNIQUE INDEX "User_gmail_key" ON "User"("gmail");

-- CreateIndex
CREATE UNIQUE INDEX "User_mobilenumber_key" ON "User"("mobilenumber");

-- CreateIndex
CREATE INDEX "User_gmail_idx" ON "User"("gmail");

-- CreateIndex
CREATE INDEX "User_username_idx" ON "User"("username");
