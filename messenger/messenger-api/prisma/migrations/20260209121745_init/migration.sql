/*
  Warnings:

  - You are about to drop the column `fname` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `gmail` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `lname` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `mname` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `mobilenumber` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `username` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[email]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userName]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[mobileNumber]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `email` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `firstName` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lastName` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mobileNumber` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userName` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "User_gmail_idx";

-- DropIndex
DROP INDEX "User_gmail_key";

-- DropIndex
DROP INDEX "User_mobilenumber_key";

-- DropIndex
DROP INDEX "User_username_idx";

-- DropIndex
DROP INDEX "User_username_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "fname",
DROP COLUMN "gmail",
DROP COLUMN "lname",
DROP COLUMN "mname",
DROP COLUMN "mobilenumber",
DROP COLUMN "username",
ADD COLUMN     "email" TEXT NOT NULL,
ADD COLUMN     "firstName" TEXT NOT NULL,
ADD COLUMN     "lastName" TEXT NOT NULL,
ADD COLUMN     "middleName" TEXT,
ADD COLUMN     "mobileNumber" TEXT NOT NULL,
ADD COLUMN     "userName" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_userName_key" ON "User"("userName");

-- CreateIndex
CREATE UNIQUE INDEX "User_mobileNumber_key" ON "User"("mobileNumber");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_userName_idx" ON "User"("userName");
