import { Controller, Get, Query, UseGuards, Logger, BadRequestException, ValidationPipe } from '@nestjs/common';
import { BookstoreService } from './bookstore.service';
import { ApiTags, ApiOperation, ApiResponse, ApiUnauthorizedResponse, ApiForbiddenResponse, ApiInternalServerErrorResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { BookstoreItemDto } from './dto/get-bookstore-list-response.dto';
import { GetMyEntitlementsResponseDto } from './dto/get-my-entitlements-response.dto';
import { AdminEntitlementsQueryDto } from './dto/admin-entitlements-query.dto';
import { AdminEntitlementsResponseDto } from './dto/admin-entitlements-response.dto';
import { GetBookstoresQueryDto } from './dto/get-bookstores-query.dto';
import { GetAdminBookstoresResponseDto } from './dto/get-admin-bookstores-response.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('BookStore')
@Controller()
export class BookstoreController {
  private readonly logger = new Logger(BookstoreController.name);

  constructor(private readonly bookstoreService: BookstoreService) {}

  @Get('bookstorelist')
  @ApiOperation({ summary: '取得書本商店清單' })
  @ApiResponse({ status: 200, description: '成功取得書本商店清單（空陣列表示沒有商品）', type: () => BookstoreItemDto, isArray: true })
  @ApiUnauthorizedResponse({
    description: '未授權（401）',
    schema: {
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: '未授權' },
      },
      example: { success: false, message: '未授權' },
    },
  })
  @ApiForbiddenResponse({
    description: '權限不足（403）',
    schema: {
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: '權限不足(403)' },
      },
      example: { success: false, message: '權限不足(403)' },
    },
  })
  @ApiInternalServerErrorResponse({
    description: '伺服器錯誤（500），例如 DB 連線失敗',
    schema: {
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: '伺服器錯誤（500），例如 DB 連線失敗' },
      },
      example: { success: false, message: '伺服器錯誤（500），例如 DB 連線失敗' },
    },
  })
  async getBookStoreList() {
    return this.bookstoreService.getBookStoreList();
  }

  @Get('me/entitlements')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '取得我已購買的書籍' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: '頁碼（預設 1）', example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '每頁筆數（預設 20）', example: 20 })
  @ApiResponse({
    status: 200,
    description: '成功取得已購買書籍清單',
    type: GetMyEntitlementsResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: '未授權（401）',
    schema: {
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: '未授權' },
      },
      example: { success: false, message: '未授權' },
    },
  })
  @ApiInternalServerErrorResponse({
    description: '伺服器錯誤（500）',
    schema: {
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: '資料庫連線失敗' },
      },
      example: { success: false, message: '資料庫連線失敗' },
    },
  })
  async getMyEntitlements(
    @CurrentUser() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    this.logger.log('🔵 [BookstoreController] getMyEntitlements() 被呼叫');
    this.logger.log('🔵 [BookstoreController] @CurrentUser() 返回:', JSON.stringify(user, null, 2));

    if (!user) {
      this.logger.error('❌ [BookstoreController] user 為 undefined，認證失敗');
      throw new Error('認證失敗，用戶信息為 undefined');
    }

    if (!user.userId) {
      this.logger.error('❌ [BookstoreController] user.userId 為 undefined，可能是 JWT decode 錯誤');
      this.logger.error('🔴 user 物件結構:', Object.keys(user));
      throw new Error('用戶 ID 無效');
    }

    this.logger.log('✅ [BookstoreController] 已取得 userId:', user.userId);

    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;

    this.logger.log(`🔵 [BookstoreController] 查詢分頁: page=${pageNum}, limit=${limitNum}`);

    return this.bookstoreService.getUserEntitlements(user.userId, pageNum, limitNum);
  }

  @Get('admin/entitlements')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '【後台】查詢用戶的書籍列表',
    description: '管理員可透過此 API 查詢任意用戶擁有的書籍列表（權益列表）。需驗證 JWT Token 且 roleLevel >= 9',
  })
  @ApiQuery({
    name: 'userId',
    description: '用戶 ID（必填）- 必須為整數且大於 0',
    type: Number,
    example: 123,
    required: true,
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
    description: '每頁筆數（可選，預設 20，最多 100）',
    type: Number,
    example: 20,
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: '成功取得用戶的書籍列表',
    type: AdminEntitlementsResponseDto,
    example: {
      user: {
        id: 123,
        username: 'John Doe',
        email: 'john@example.com',
      },
      entitlements: [
        {
          book: {
            id: 1,
            title: '小鎮失蹤手冊',
            author: '夏佩爾&烏奴奴',
            coverImage: 'mainMenuImage-1709644166964.jpeg',
          },
          purchasedAt: '2026-02-20T10:30:00.000Z',
        },
        {
          book: {
            id: 2,
            title: '冒險故事',
            author: '張三',
            coverImage: 'cover-image-2.jpeg',
          },
          purchasedAt: '2026-02-15T14:20:00.000Z',
        },
      ],
      pagination: {
        total: 5,
        page: 1,
        limit: 20,
        totalPages: 1,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'userId 驗證失敗 - 必須為整數且大於 0',
    schema: {
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          oneOf: [
            { type: 'string', example: 'userId 必須是有效的數字' },
            { type: 'string', example: 'userId 必須是整數' },
            { type: 'string', example: 'userId 必須大於 0' },
          ],
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: '無管理員權限 - roleLevel < 9 或未認證',
    schema: {
      properties: {
        statusCode: { type: 'number', example: 403 },
        message: { type: 'string', example: '只有管理員可存取此資源' },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: '伺服器錯誤 - 資料庫連線失敗',
    schema: {
      properties: {
        statusCode: { type: 'number', example: 500 },
        message: { type: 'object', example: { success: false, message: '資料庫連線失敗' } },
      },
    },
  })
  async getAdminEntitlements(
    @Query(new ValidationPipe({ transform: true, transformOptions: { enableImplicitConversion: true } }))
    query: AdminEntitlementsQueryDto,
    @CurrentUser() user: any,
  ): Promise<AdminEntitlementsResponseDto> {
    this.logger.log(`🔵 [BookstoreController] getAdminEntitlements() 被呼叫`);
    this.logger.log(`🔵 [BookstoreController] 管理員 ID: ${user?.userId}, 目標用戶 ID: ${query.userId}`);

    // 執行查詢
    const page = query.page || 1;
    const limit = query.limit || 20;

    this.logger.log(
      `🔵 [BookstoreController] 查詢用戶 ${query.userId} 的權益，分頁: page=${page}, limit=${limit}`,
    );

    return this.bookstoreService.getAdminEntitlements(query.userId, page, limit);
  }

  @Get('admin/bookstores')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '【後台管理員專用】取得書本商店清單（含所有狀態）',
    description: `
      管理員可透過此 API 查詢所有書本商店清單。
      
      **核心特性**：
      - 需要 roleLevel >= 9 的管理員權限
      - 包含所有狀態的書籍（包括已下架書籍），不進行上下架過濾
      - 支援分頁查詢（page, limit）
      - 按建立時間由新至舊排序
      - 返回完整的書籍資訊與分頁統計
      
      **用途**：後台查看完整的書籍清單，管理所有書籍狀態
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
    description: '每頁筆數（可選，預設 20，最多 100）',
    type: Number,
    example: 20,
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: '成功取得書本商店清單',
    type: GetAdminBookstoresResponseDto,
    example: {
      data: [
        {
          id: 1,
          storyListId: 1,
          priceCoins: 100,
          currency: 'COIN',
          isActive: true,
          soldCount: 42,
          createdAt: '2025-12-18T15:28:17.000Z',
          updatedAt: '2025-12-18T15:28:17.000Z',
          story: {
            id: 1,
            main_menu_name: '小鎮失蹤手冊',
            author: '夏佩爾&烏奴奴',
            main_menu_image: 'mainMenuImage-1709644166964.jpeg',
          },
        },
        {
          id: 2,
          storyListId: 2,
          priceCoins: 150,
          currency: 'COIN',
          isActive: false,
          soldCount: 0,
          createdAt: '2025-12-17T10:15:00.000Z',
          updatedAt: '2025-12-17T10:15:00.000Z',
          story: {
            id: 2,
            main_menu_name: '冒險故事',
            author: '張三',
            main_menu_image: 'adventure-cover.jpeg',
          },
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
  @ApiResponse({
    status: 400,
    description: 'page 或 limit 驗證失敗 - 必須為正整數',
    schema: {
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          oneOf: [
            { type: 'string', example: 'page 必須是整數' },
            { type: 'string', example: 'page 最小為 1' },
            { type: 'string', example: 'limit 必須是整數' },
            { type: 'string', example: 'limit 最小為 1' },
            { type: 'string', example: 'limit 最多為 100' },
          ],
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: '未授權 - 憑證無效或未登入',
    schema: {
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: '未認證的使用者' },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: '無管理員權限 - roleLevel < 9',
    schema: {
      properties: {
        statusCode: { type: 'number', example: 403 },
        message: { type: 'string', example: '只有管理員可存取此資源' },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: '伺服器錯誤 - 資料庫連線失敗',
    schema: {
      properties: {
        statusCode: { type: 'number', example: 500 },
        message: { type: 'object', example: { success: false, message: '資料庫連線失敗' } },
      },
    },
  })
  async getAdminBookstores(
    @Query(new ValidationPipe({ transform: true, transformOptions: { enableImplicitConversion: true } }))
    query: GetBookstoresQueryDto,
    @CurrentUser() user: any,
  ): Promise<GetAdminBookstoresResponseDto> {
    this.logger.log(
      `🔵 [BookstoreController] getAdminBookstores() 被呼叫，管理員 ID: ${user?.userId}, page: ${query.page}, limit: ${query.limit}`,
    );

    const page = query.page || 1;
    const limit = query.limit || 20;

    return this.bookstoreService.getAdminBookstores(page, limit) as any;
  }
}
