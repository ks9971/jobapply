-- AlterTable
ALTER TABLE "CVDocument" ADD COLUMN     "fileContent" TEXT,
ALTER COLUMN "filePath" SET DEFAULT '';
