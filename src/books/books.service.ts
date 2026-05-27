import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { BooksAnalyticsQueryDto } from './dto/books-analytics-query.dto';
import { BooksAnalyticsResponseDto } from './dto/books-analytics-response.dto';
import { ReadBookResponseDto } from './dto/read-book-response.dto';

@Injectable()
export class BooksService {
  constructor(private readonly prisma: PrismaService) {}

  async recordRead(bookId: number, userId: number): Promise<ReadBookResponseDto> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const lockedBooks = await tx.$queryRaw<Array<{ id: number }>>`
          SELECT id
          FROM StoryLists
          WHERE id = ${bookId}
          FOR UPDATE
        `;

        if (lockedBooks.length === 0) {
          throw new NotFoundException(`書籍 (ID: ${bookId}) 不存在`);
        }

        const existingRead = await tx.readLog.findFirst({
          where: {
            userId,
            bookId,
          },
          select: {
            id: true,
          },
        });
        const isFirstRead = !existingRead;

        const readLog = await tx.readLog.create({
          data: {
            userId,
            bookId,
          },
        });

        const updatedBook = await tx.storyLists.update({
          where: {
            id: bookId,
          },
          data: {
            totalReads: {
              increment: 1,
            },
            ...(isFirstRead
              ? {
                  uniqueReaders: {
                    increment: 1,
                  },
                }
              : {}),
          },
          select: {
            id: true,
            totalReads: true,
            uniqueReaders: true,
          },
        });

        return {
          success: true,
          readLogId: readLog.id.toString(),
          bookId: updatedBook.id,
          isFirstRead,
          total_reads: updatedBook.totalReads,
          unique_readers: updatedBook.uniqueReaders,
          readAt: readLog.createdAt,
        };
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException({
        success: false,
        message: '記錄閱讀失敗',
      });
    }
  }

  async getAnalytics(query: BooksAnalyticsQueryDto): Promise<BooksAnalyticsResponseDto> {
    try {
      const page = query.page || 1;
      const limit = query.limit || 20;
      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        this.prisma.storyLists.findMany({
          select: {
            id: true,
            main_menu_name: true,
            stroy_name: true,
            author: true,
            totalReads: true,
            uniqueReaders: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: {
            totalReads: 'desc',
          },
          skip,
          take: limit,
        }),
        this.prisma.storyLists.count(),
      ]);

      return {
        data: data.map((book) => ({
          id: book.id,
          title: book.main_menu_name || book.stroy_name || 'Untitled',
          author: book.author,
          total_reads: book.totalReads,
          unique_readers: book.uniqueReaders,
          createdAt: book.createdAt,
          updatedAt: book.updatedAt,
        })),
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new InternalServerErrorException({
          success: false,
          message: '資料庫查詢失敗',
        });
      }

      throw error;
    }
  }
}
