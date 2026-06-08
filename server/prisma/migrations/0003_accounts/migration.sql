-- Move from name+PIN to email+password accounts.
-- PIN becomes optional (legacy), email + password added, names no longer unique.
ALTER TABLE "users" ALTER COLUMN "pin_hash" DROP NOT NULL;
ALTER TABLE "users" ADD COLUMN "email" TEXT;
ALTER TABLE "users" ADD COLUMN "password_hash" TEXT;
DROP INDEX IF EXISTS "users_name_key";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
