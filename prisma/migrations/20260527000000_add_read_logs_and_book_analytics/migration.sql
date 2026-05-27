-- AlterTable
ALTER TABLE `StoryLists`
    ADD COLUMN `total_reads` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `unique_readers` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `read_logs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `book_id` INTEGER NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_read_logs_user_id`(`user_id`),
    INDEX `idx_read_logs_book_id`(`book_id`),
    INDEX `idx_read_logs_created_at`(`created_at`),
    INDEX `idx_read_logs_user_book`(`user_id`, `book_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `read_logs` ADD CONSTRAINT `read_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `read_logs` ADD CONSTRAINT `read_logs_book_id_fkey` FOREIGN KEY (`book_id`) REFERENCES `StoryLists`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;
