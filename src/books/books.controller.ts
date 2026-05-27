import { Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { AdminGuard } from '../auth/admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BooksService } from './books.service';
import { BooksAnalyticsQueryDto } from './dto/books-analytics-query.dto';
import { BooksAnalyticsResponseDto } from './dto/books-analytics-response.dto';
import { ReadBookResponseDto } from './dto/read-book-response.dto';

@ApiTags('Books')
@Controller()
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  @Post('books/:id/read')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '使用者觸發閱讀',
    description: `
      使用者每次點擊閱讀時呼叫此 API。

      **資料一致性設計**：
      - 使用 Database Transaction 同步寫入 read_logs 與更新書籍快取統計欄位
      - 交易內會鎖定該書籍 row，避免高併發下 unique_readers 重複累加
      - 每次閱讀都會新增一筆 read_logs 流水帳
    `,
  })
  @ApiParam({
    name: 'id',
    description: '書籍 ID（StoryLists.id）',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: '成功記錄閱讀',
    type: ReadBookResponseDto,
    example: {
      success: true,
      readLogId: '123456789',
      bookId: 1,
      isFirstRead: true,
      total_reads: 128,
      unique_readers: 42,
      readAt: '2026-05-27T10:30:00.000Z',
    },
  })
  @ApiNotFoundResponse({
    description: '書籍不存在',
    schema: {
      example: {
        statusCode: 404,
        message: '書籍 (ID: 999999) 不存在',
        error: 'Not Found',
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: '未授權 - 憑證無效或未登入',
    schema: {
      example: {
        statusCode: 401,
        message: '缺少 Authorization header',
        error: 'Unauthorized',
      },
    },
  })
  recordRead(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ): Promise<ReadBookResponseDto> {
    return this.booksService.recordRead(id, user.userId);
  }

  @Get('admin/books/analytics')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '【後台】查看書籍閱讀統計清單',
    description: `
      管理員查看每本書的閱讀總次數與不重複閱讀人數。

      **效能重點**：
      - 直接讀取書籍表快取欄位 total_reads 與 unique_readers
      - 不對 read_logs 做全表 COUNT，避免統計 API 隨流水帳資料量線性變慢
      - 需要 roleLevel >= 9 的管理員權限
    `,
  })
  @ApiQuery({
    name: 'page',
    description: '頁碼（可選，預設 1）',
    type: Number,
    example: 1,
    required: false,
  })
  @ApiQuery({
    name: 'limit',
    description: '每頁筆數（可選，預設 20）',
    type: Number,
    example: 20,
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: '成功取得書籍統計清單',
    type: BooksAnalyticsResponseDto,
    example: {
      data: [
        {
          id: 1,
          title: '小鎮失蹤手冊',
          author: '夏佩爾&烏奴奴',
          total_reads: 128,
          unique_readers: 42,
          createdAt: '2026-05-15T10:30:00.000Z',
          updatedAt: '2026-05-27T10:30:00.000Z',
        },
      ],
      pagination: {
        total: 50,
        page: 1,
        limit: 20,
        totalPages: 3,
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: '未授權 - 憑證無效或未登入',
    schema: {
      example: {
        statusCode: 401,
        message: '缺少 Authorization header',
        error: 'Unauthorized',
      },
    },
  })
  @ApiForbiddenResponse({
    description: '權限不足 - 需要 roleLevel >= 9',
    schema: {
      example: {
        message: '只有管理員可存取此資源',
        error: 'Forbidden',
        statusCode: 403,
      },
    },
  })
  getAnalytics(
    @Query() query: BooksAnalyticsQueryDto,
  ): Promise<BooksAnalyticsResponseDto> {
    return this.booksService.getAnalytics(query);
  }
}
