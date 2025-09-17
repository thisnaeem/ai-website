-- CreateTable
CREATE TABLE "public"."scheduled_posts" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "postType" TEXT NOT NULL,
    "mediaUrls" TEXT[],
    "carouselImages" TEXT[],
    "pageId" TEXT NOT NULL,
    "pageName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "intervalMinutes" INTEGER,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "firstComment" TEXT,
    "postFirstComment" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "postedAt" TIMESTAMP(3),
    "facebookPostId" TEXT,
    "errorMessage" TEXT,

    CONSTRAINT "scheduled_posts_pkey" PRIMARY KEY ("id")
);
