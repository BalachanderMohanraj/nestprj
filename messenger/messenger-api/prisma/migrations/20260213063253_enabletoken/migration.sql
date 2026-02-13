-- CreateTable
CREATE TABLE "local_dev"."EnableAccountToken" (
    "id" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnableAccountToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EnableAccountToken_jti_key" ON "local_dev"."EnableAccountToken"("jti");

-- CreateIndex
CREATE INDEX "EnableAccountToken_userId_idx" ON "local_dev"."EnableAccountToken"("userId");

-- CreateIndex
CREATE INDEX "EnableAccountToken_expiresAt_idx" ON "local_dev"."EnableAccountToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "local_dev"."EnableAccountToken" ADD CONSTRAINT "EnableAccountToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "local_dev"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
