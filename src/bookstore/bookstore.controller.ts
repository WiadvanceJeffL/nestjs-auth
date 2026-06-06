import { Body, Controller, Delete, Get, Logger, Param, ParseIntPipe, Patch, Post, Query, UseGuards, ValidationPipe } from '@nestjs/common';
import { BookstoreService } from './bookstore.service';
import { ApiBearerAuth, ApiBody, ApiForbiddenResponse, ApiInternalServerErrorResponse, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { BookstoreItemDto } from './dto/get-bookstore-list-response.dto';
import { GetMyEntitlementsResponseDto } from './dto/get-my-entitlements-response.dto';
import { AdminEntitlementsQueryDto } from './dto/admin-entitlements-query.dto';
import { AdminEntitlementsResponseDto } from './dto/admin-entitlements-response.dto';
import { GetBookstoresQueryDto } from './dto/get-bookstores-query.dto';
import { GetAdminBookstoresResponseDto } from './dto/get-admin-bookstores-response.dto';
import { CreateBookstoreDto } from './dto/create-bookstore.dto';
import { UpdateBookstoreDto } from './dto/update-bookstore.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('BookStore')
@Controller()
export class BookstoreController {
  private readonly logger = new Logger(BookstoreController.name);

  constructor(private readonly bookstoreService: BookstoreService) {}

  @Post('admin/bookstores')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '【後台管理員專用】建立書本商店上架屬性',
    description: `
      管理員可透過此 API 為指定書籍建立書本商店設定。

      **核心特性**：
      - 需要 JWT Token 且 roleLevel >= 9
      - 建立前會確認 bookId 對應的書籍存在
      - 每本書僅允許一筆商店設定，重複建立會回傳 409
      - currency、isActive、soldCount 未傳入時會套用預設值
    `,
  })
  @ApiBody({
    type: CreateBookstoreDto,
    examples: {
      activeBook: {
        summary: '建立上架書籍',
        value: {
          bookId: 1,
          priceCoins: 100,
          currency: 'COIN',
          isActive: true,
          soldCount: 0,
        },
      },
      withDefaults: {
        summary: '使用選填欄位預設值',
        value: {
          bookId: 2,
          priceCoins: 150,
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: '書本商店設定建立成功',
    type: BookstoreItemDto,
    example: {
      id: 1,
      storyListId: 1,
      priceCoins: 100,
      currency: 'COIN',
      isActive: true,
      soldCount: 0,
      createdAt: '2026-06-06T10:30:00.000Z',
      updatedAt: '2026-06-06T10:30:00.000Z',
      story: {
        id: 1,
        main_menu_name: '小鎮失蹤手冊',
        author: '夏佩爾&烏奴奴',
        main_menu_image: 'mainMenuImage-1709644166964.jpeg',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: '請求參數驗證失敗',
    example: {
      statusCode: 400,
      message: [
        'bookId 必須大於 0',
        'priceCoins 必須大於等於 0',
        'currency 只能為 COIN',
        'isActive 必須是布林值',
        'soldCount 必須是整數',
      ],
      error: 'Bad Request',
    },
  })
  @ApiResponse({
    status: 401,
    description: '憑證無效或未登入',
    example: {
      statusCode: 401,
      message: 'Unauthorized',
    },
  })
  @ApiResponse({
    status: 403,
    description: '權限不足（非管理員，roleLevel < 9）',
    example: {
      statusCode: 403,
      message: '只有管理員可存取此資源',
      error: 'Forbidden',
    },
  })
  @ApiResponse({
    status: 404,
    description: '指定書籍不存在',
    example: {
      statusCode: 404,
      message: '書籍 (ID: 999999) 不存在',
      error: 'Not Found',
    },
  })
  @ApiResponse({
    status: 409,
    description: '該書籍已存在商店設定',
    example: {
      statusCode: 409,
      message: '書籍 (ID: 1) 已存在商店設定',
      error: 'Conflict',
    },
  })
  @ApiResponse({
    status: 500,
    description: '伺服器錯誤 - 資料庫連線失敗',
    example: {
      statusCode: 500,
      message: {
        success: false,
        message: '資料庫連線失敗',
      },
      error: 'Internal Server Error',
    },
  })
  async createAdminBookstore(
    @Body(new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }))
    body: CreateBookstoreDto,
    @CurrentUser() user: any,
  ): Promise<BookstoreItemDto> {
    this.logger.log(
      `🔵 [BookstoreController] createAdminBookstore() 被呼叫，管理員 ID: ${user?.userId}, bookId: ${body.bookId}`,
    );

    return this.bookstoreService.createAdminBookstore(body);
  }

  @Patch('admin/bookstores/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '【後台管理員專用】部分更新書本商店上架屬性',
    description: `
      管理員可透過此 API 編輯指定書本商店設定。

      **核心特性**：
      - 需要 JWT Token 且 roleLevel >= 9
      - 使用 book_store_items.id 作為 Primary Key
      - 只更新 request body 有傳入的欄位
      - 更新前會確認指定商店設定存在，不存在回傳 404
    `,
  })
  @ApiParam({
    name: 'id',
    description: '書本商店設定 ID（book_store_items.id）',
    type: Number,
    example: 1,
  })
  @ApiBody({
    type: UpdateBookstoreDto,
    examples: {
      updatePrice: {
        summary: '只更新金幣價格',
        value: {
          priceCoins: 120,
        },
      },
      updateStatus: {
        summary: '只更新上架狀態',
        value: {
          isActive: false,
        },
      },
      updateMultipleFields: {
        summary: '同時更新價格、貨幣與上架狀態',
        value: {
          priceCoins: 150,
          currency: 'COIN',
          isActive: true,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: '書本商店設定更新成功',
    type: BookstoreItemDto,
    example: {
      id: 1,
      storyListId: 1,
      priceCoins: 120,
      currency: 'COIN',
      isActive: false,
      soldCount: 42,
      createdAt: '2026-06-06T10:30:00.000Z',
      updatedAt: '2026-06-06T11:30:00.000Z',
      story: {
        id: 1,
        main_menu_name: '小鎮失蹤手冊',
        author: '夏佩爾&烏奴奴',
        main_menu_image: 'mainMenuImage-1709644166964.jpeg',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: '請求參數驗證失敗',
    example: {
      statusCode: 400,
      message: [
        'priceCoins 必須大於等於 0',
        'currency 只能為 COIN',
        'isActive 必須是布林值',
      ],
      error: 'Bad Request',
    },
  })
  @ApiResponse({
    status: 401,
    description: '憑證無效或未登入',
    example: {
      statusCode: 401,
      message: 'Unauthorized',
    },
  })
  @ApiResponse({
    status: 403,
    description: '權限不足（非管理員，roleLevel < 9）',
    example: {
      statusCode: 403,
      message: '只有管理員可存取此資源',
      error: 'Forbidden',
    },
  })
  @ApiResponse({
    status: 404,
    description: '指定書本商店設定不存在',
    example: {
      statusCode: 404,
      message: '書本商店設定 (ID: 999999) 不存在',
      error: 'Not Found',
    },
  })
  @ApiResponse({
    status: 500,
    description: '伺服器錯誤 - 資料庫連線失敗',
    example: {
      statusCode: 500,
      message: {
        success: false,
        message: '資料庫連線失敗',
      },
      error: 'Internal Server Error',
    },
  })
  async updateAdminBookstore(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }))
    body: UpdateBookstoreDto,
    @CurrentUser() user: any,
  ): Promise<BookstoreItemDto> {
    this.logger.log(
      `🔵 [BookstoreController] updateAdminBookstore() 被呼叫，管理員 ID: ${user?.userId}, bookstoreId: ${id}`,
    );

    return this.bookstoreService.updateAdminBookstore(id, body);
  }

  @Delete('admin/bookstores/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '【後台管理員專用】刪除書本商店屬性',
    description: `
      管理員可透過此 API 刪除指定書籍的商店屬性，等同於將商品從商店移除。

      **核心特性**：
      - 需要 JWT Token 且 roleLevel >= 9
      - 使用 book_store_items.id 作為 Primary Key
      - 僅刪除 book_store_items 商店屬性紀錄
      - 不會刪除 StoryLists 書籍主表紀錄
      - 刪除前會確認指定商店設定存在，不存在回傳 404
    `,
  })
  @ApiParam({
    name: 'id',
    description: '書本商店設定 ID（book_store_items.id）',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: '書本商店設定刪除成功，書籍主表紀錄保留',
    example: {
      success: true,
      message: '書本商店設定已刪除，書籍主表紀錄保留',
      deletedItem: {
        id: 1,
        storyListId: 1,
        priceCoins: 120,
        currency: 'COIN',
        isActive: false,
        soldCount: 42,
        createdAt: '2026-06-06T10:30:00.000Z',
        updatedAt: '2026-06-06T11:30:00.000Z',
        story: {
          id: 1,
          main_menu_name: '小鎮失蹤手冊',
          author: '夏佩爾&烏奴奴',
          main_menu_image: 'mainMenuImage-1709644166964.jpeg',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'id 參數驗證失敗',
    example: {
      statusCode: 400,
      message: 'Validation failed (numeric string is expected)',
      error: 'Bad Request',
    },
  })
  @ApiResponse({
    status: 401,
    description: '憑證無效或未登入',
    example: {
      statusCode: 401,
      message: 'Unauthorized',
    },
  })
  @ApiResponse({
    status: 403,
    description: '權限不足（非管理員，roleLevel < 9）',
    example: {
      statusCode: 403,
      message: '只有管理員可存取此資源',
      error: 'Forbidden',
    },
  })
  @ApiResponse({
    status: 404,
    description: '指定書本商店設定不存在',
    example: {
      statusCode: 404,
      message: '書本商店設定 (ID: 999999) 不存在',
      error: 'Not Found',
    },
  })
  @ApiResponse({
    status: 500,
    description: '伺服器錯誤 - 資料庫連線失敗',
    example: {
      statusCode: 500,
      message: {
        success: false,
        message: '資料庫連線失敗',
      },
      error: 'Internal Server Error',
    },
  })
  async deleteAdminBookstore(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    this.logger.log(
      `🔵 [BookstoreController] deleteAdminBookstore() 被呼叫，管理員 ID: ${user?.userId}, bookstoreId: ${id}`,
    );

    return this.bookstoreService.deleteAdminBookstore(id);
  }

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
