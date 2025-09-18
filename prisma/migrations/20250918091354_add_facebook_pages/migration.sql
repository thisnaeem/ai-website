-- CreateTable
CREATE TABLE "public"."facebook_pages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "picture" TEXT,
    "followersCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facebook_pages_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."scheduled_posts" ADD CONSTRAINT "scheduled_posts_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "public"."facebook_pages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
