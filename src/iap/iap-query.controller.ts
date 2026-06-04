import { Controller, Get, Req, UseGuards, Query, BadRequestException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IapQueryService } from './iap-query.service';
import { MyIapReceiptDto } from './dto/my-iap-receipt.dto';
import { MyIapReceiptsResponseDto } from './dto/my-iap-receipts-response.dto';
import { AdminIapReceiptsQueryDto } from './dto/admin-iap-receipts-query.dto';
import { AdminIapReceiptsResponseDto } from './dto/admin-iap-receipts-response.dto';
import { AdminCoinLedgerQueryDto } from './dto/admin-coin-ledger-query.dto';
import { AdminCoinLedgerResponseDto } from './dto/admin-coin-ledger-response.dto';

@ApiTags('IAP / Coins')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class IapQueryController {
  constructor(private readonly iapQueryService: IapQueryService) {}

  @Get('me/iap-receipts')
  @ApiOperation({ summary: '查詢我的 IAP 儲值紀錄' })
  @ApiResponse({
    status: 200,
    description: '成功獲取 IAP 儲值紀錄',
    type: MyIapReceiptsResponseDto,
  })
  getMyIapReceipts(@Req() req): Promise<MyIapReceiptsResponseDto> {
    return this.iapQueryService.getMyIapReceipts(req.user.userId);
  }

  @Get('me/coins/balance')
  @ApiOperation({ summary: '查詢我的金幣餘額' })
  getMyCoinBalance(@Req() req) {
    return this.iapQueryService.getMyCoinBalance(req.user.userId);
  }

  @Get('me/coins/ledger')
  @ApiOperation({ summary: '查詢我的金幣流水' })
  getMyCoinLedger(@Req() req) {
    return this.iapQueryService.getMyCoinLedger(req.user.userId);
  }

  @Get('admin/iap-receipts')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: '【後台】查詢用戶的 IAP 交易記錄' })
  @ApiQuery({
    name: 'userId',
    description: '用戶 ID（必填）',
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
    description: '成功獲取用戶 IAP 交易記錄',
    type: AdminIapReceiptsResponseDto,
    example: {
      items: [
        {
          id: 1,
          receiptId: 'GPA.3218-2019-1234567890',
          userId: 12,
          username: 'John Doe',
          email: 'john@example.com',
          platform: 'GOOGLE',
          productId: 'coins_100',
          productName: '100 金幣',
          price: '99.99',
          currency: 'TWD',
          baseCoins: 100,
          bonusCoins: 10,
          totalCoins: 110,
          status: 'SUCCESS',
          createdAt: '2026-02-27T10:30:00.000Z',
        },
        {
          id: 2,
          receiptId: '17000123456789012',
          userId: 12,
          username: 'John Doe',
          email: 'john@example.com',
          platform: 'APPLE',
          productId: 'com.xstory.coins_500',
          productName: '500 金幣',
          price: '499.99',
          currency: 'TWD',
          baseCoins: 500,
          bonusCoins: 50,
          totalCoins: 550,
          status: 'SUCCESS',
          createdAt: '2026-02-26T15:20:00.000Z',
        },
      ],
      pagination: {
        total: 2,
        page: 1,
        limit: 20,
        pages: 1,
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: '無管理員權限',
  })
  @ApiResponse({
    status: 400,
    description: 'userId 必須是有效的整數',
  })
  async getAdminIapReceipts(
    @Query() query: AdminIapReceiptsQueryDto,
    @CurrentUser() user: any,
  ): Promise<AdminIapReceiptsResponseDto> {
    // 驗證 userId
    if (!query.userId || query.userId <= 0) {
      throw new BadRequestException('userId 必須是大於 0 的整數');
    }

    const page = query.page || 1;
    const limit = query.limit || 20;

    return this.iapQueryService.getAdminIapReceipts(query.userId, page, limit);
  }

  @Get('admin/coins/ledger')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: '【後台】查詢用戶的金幣流水' })
  @ApiQuery({
    name: 'userId',
    description: '用戶 ID（必填）',
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
    description: '成功獲取用戶金幣流水',
    type: AdminCoinLedgerResponseDto,
    example: {
      items: [
        {
          id: 101,
          amount: 100,
          balance: 1500,
          type: 'IAP',
          source: 'ORDER:GPA.1234|PROD:coins_100',
          createdAt: '2026-02-27T10:30:00.000Z',
          userId: 12,
          username: 'John Doe',
          email: 'john@example.com',
        },
        {
          id: 100,
          amount: -50,
          balance: 1400,
          type: 'USE',
          source: 'SHOP:book_001',
          createdAt: '2026-02-26T15:20:00.000Z',
          userId: 12,
          username: 'John Doe',
          email: 'john@example.com',
        },
      ],
      pagination: {
        total: 100,
        page: 1,
        limit: 20,
        pages: 5,
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: '無管理員權限',
  })
  @ApiResponse({
    status: 400,
    description: 'userId 必須是有效的整數',
  })
  async getAdminCoinLedger(
    @Query() query: AdminCoinLedgerQueryDto,
    @CurrentUser() user: any,
  ): Promise<AdminCoinLedgerResponseDto> {
    // 驗證 userId
    if (!query.userId || query.userId <= 0) {
      throw new BadRequestException('userId 必須是大於 0 的整數');
    }

    const page = query.page || 1;
    const limit = query.limit || 20;

    return this.iapQueryService.getAdminCoinLedger(query.userId, page, limit);
  }
}
