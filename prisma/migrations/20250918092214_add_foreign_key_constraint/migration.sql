-- AddForeignKey
ALTER TABLE "public"."scheduled_posts" ADD CONSTRAINT "scheduled_posts_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "public"."facebook_pages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
