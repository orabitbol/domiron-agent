-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('INSTAGRAM', 'FACEBOOK', 'BOTH');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('POST', 'STORY', 'CAROUSEL', 'REEL');

-- CreateEnum
CREATE TYPE "ContentFormat" AS ENUM ('STATIC', 'CAROUSEL', 'REEL', 'STORY');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'DRAFT_READY', 'REVISION_NEEDED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REVISION_NEEDED', 'REJECTED', 'EDITED');

-- CreateEnum
CREATE TYPE "PublishJobStatus" AS ENUM ('QUEUED', 'SCHEDULED', 'PUBLISHED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PublishMethod" AS ENUM ('MANUAL', 'AUTO');

-- CreateEnum
CREATE TYPE "ChangedBy" AS ENUM ('AGENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "MetaPlatform" AS ENUM ('INSTAGRAM', 'FACEBOOK');

-- CreateTable
CREATE TABLE "content_requests" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "contentType" "ContentType" NOT NULL,
    "sequenceDay" INTEGER,
    "contentPillar" TEXT,
    "instructions" TEXT,
    "targetPublishDate" TIMESTAMP(3),
    "status" "RequestStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drafts" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "goal" TEXT,
    "bestAngle" TEXT,
    "format" "ContentFormat" NOT NULL,
    "hook" TEXT,
    "facebookCaption" TEXT,
    "instagramCaption" TEXT,
    "storyFrames" JSONB,
    "carouselSlides" JSONB,
    "cta" TEXT,
    "hashtags" TEXT[],
    "visualDirection" TEXT,
    "whyThisMatters" TEXT,
    "adminNotes" TEXT,
    "mediaUrl" TEXT,
    "status" "DraftStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publish_jobs" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "scheduledDate" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "status" "PublishJobStatus" NOT NULL DEFAULT 'QUEUED',
    "publishMethod" "PublishMethod" NOT NULL DEFAULT 'MANUAL',
    "externalPostId" TEXT,
    "publishedUrl" TEXT,
    "failureReason" TEXT,
    "metaRequestId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "publish_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_connections" (
    "id" TEXT NOT NULL,
    "platform" "MetaPlatform" NOT NULL,
    "pageId" TEXT NOT NULL,
    "pageName" TEXT NOT NULL,
    "encryptedToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "draft_revisions" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changedBy" "ChangedBy" NOT NULL,
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "draft_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "drafts_requestId_key" ON "drafts"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "publish_jobs_draftId_key" ON "publish_jobs"("draftId");

-- CreateIndex
CREATE UNIQUE INDEX "meta_connections_platform_pageId_key" ON "meta_connections"("platform", "pageId");

-- AddForeignKey
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "content_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publish_jobs" ADD CONSTRAINT "publish_jobs_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_revisions" ADD CONSTRAINT "draft_revisions_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
