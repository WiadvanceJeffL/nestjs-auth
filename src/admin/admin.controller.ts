import { Controller, Post, Patch, Delete, Body, Param, UseGuards, HttpCode, HttpStatus, Logger, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AdminGuard } from '../auth/admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GrantRewardRequestDto } from './dto/grant-reward-request.dto';
import { GrantRewardResponseDto } from './dto/grant-reward-response.dto';
import { UpdateCoinLedgerRemarkDto } from './dto/update-coin-ledger-remark.dto';
import { UpdateCoinPackAdminRequestDto } from '../iap/dto/update-coin-pack-admin-request.dto';
import { CoinPacksService } from '../iap/coin-packs.service';
import { RemoveUserEntitlementResponseDto } from './dto/remove-user-entitlement-response.dto';
import {
  IapReceiptStatus,
  UpdateIapReceiptStatusDto,
  UpdateIapReceiptStatusParamDto,
  UpdateIapReceiptStatusResponseDto,
} from './dto/update-iap-receipt-status.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(
    private readonly adminService: AdminService,
    private readonly coinPacksService: CoinPacksService,
  ) {}

  @Post('rewards/grant')
  @UseGuards(JwtAuthGuard, AdminGuard) // ✅ 先 JWT 認證，再 Admin 授權
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '【管理員專用】調整使用者金幣（增加或扣除）',
    description: `
      管理員可透過此 API 調整使用者的金幣餘額，支持增加或扣除金幣。
      
      **核心特性**：
      - 需要 roleLevel >= 9 的管理員權限
      - amount 可為正數（增加）或負數（扣除），無最小值限制
      - 允許餘額為負數（用於記錄欠款或異常狀態）
      - 使用 Database Transaction 確保調整與紀錄完全同步（ACID 特性）
      - 所有調整紀錄寫入 CoinLedger 表（type='ADMIN_GRANT'，source=reason）
      - 檢查目標使用者是否存在，不存在返回 404 錯誤
      
      **用途**：禮物卡兌換、活動補償、系統故障補償、違規扣款、異常狀態補正等
    `,
  })
  @ApiBody({
    type: GrantRewardRequestDto,
    examples: {
      example1: {
        summary: '增加金幣範例',
        value: {
          targetUserId: 123,
          amount: 100,
          reason: '禮物卡兌換 - Gift-2026-05-15-ABC123',
        },
      },
      example2: {
        summary: '扣除金幣範例',
        value: {
          targetUserId: 456,
          amount: -50,
          reason: '違規扣款',
        },
      },
      example3: {
        summary: '記錄欠款（負餘額）',
        value: {
          targetUserId: 789,
          amount: -500,
          reason: '帳務調整',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    type: GrantRewardResponseDto,
    description: '金幣調整成功',
    example: {
      success: true,
      targetUserId: 123,
      amount: 100,
      newBalance: 250,
      reason: '禮物卡兌換 - Gift-2026-05-15-ABC123',
      grantedAt: '2026-05-15T12:34:56.000Z',
    },
  })
  @ApiResponse({
    status: 400,
    description: '請求參數驗證失敗（targetUserId 無效）',
    example: {
      statusCode: 400,
      message: ['targetUserId 必須是整數'],
      error: 'Bad Request',
    },
  })
  @ApiResponse({
    status: 401,
    description: '憑證無效或未登入',
    example: {
      statusCode: 401,
      message: '未認證的使用者',
      error: 'Unauthorized',
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
    description: '目標使用者不存在',
    example: {
      statusCode: 404,
      message: '目標使用者 (ID: 999999) 不存在',
      error: 'Not Found',
    },
  })
  @ApiResponse({
    status: 500,
    description: '伺服器內部錯誤（交易失敗等）',
    example: {
      statusCode: 500,
      message: '金幣發放失敗: [交易錯誤詳情]',
      error: 'Internal Server Error',
    },
  })
  async grantReward(
    @Body() body: GrantRewardRequestDto,
    @CurrentUser() user: any,
  ): Promise<GrantRewardResponseDto> {
    this.logger.log(
      `[GrantReward] 管理員 ${user.userId} 發起金幣發放操作 | target=${body.targetUserId}, amount=${body.amount}, reason=${body.reason}`,
    );

    return this.adminService.grantRewardToUser(body, user.userId);
  }

  @Patch('iap-receipts/:id/status')
  @UseGuards(JwtAuthGuard, AdminGuard) // ✅ 先 JWT 認證，再 Admin 授權
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '【管理員專用】將 IAP 收據狀態標記為退款',
    description: `
      管理員可透過此 API 將指定 IAP 收據從 SUCCESS 標記為 REFUNDED。
      
      **核心特性**：
      - 需要 roleLevel >= 9 的管理員權限
      - 僅允許將 SUCCESS 交易標記為 REFUNDED
      - 若收據不存在回傳 404
      - 若收據不是 SUCCESS 狀態，回傳 400，避免重複退款或錯誤狀態轉換
    `,
  })
  @ApiParam({
    name: 'id',
    description: 'IAP 收據 ID（iap_receipts.id）',
    type: Number,
    example: 123,
  })
  @ApiBody({
    type: UpdateIapReceiptStatusDto,
    examples: {
      refunded: {
        summary: '標記退款',
        value: {
          status: IapReceiptStatus.REFUNDED,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'IAP 收據狀態更新成功',
    type: UpdateIapReceiptStatusResponseDto,
    example: {
      success: true,
      id: 123,
      userId: 456,
      platform: 'GOOGLE',
      productId: 'coins_100',
      transactionId: 'GPA.3218-2019-1234567890',
      coins: 110,
      status: 'REFUNDED',
      createdAt: '2026-05-15T10:30:00.000Z',
      markedAt: '2026-05-25T12:34:56.000Z',
    },
  })
  @ApiResponse({
    status: 400,
    description: '請求參數驗證失敗，或收據目前狀態不可退款',
    example: {
      statusCode: 400,
      message: '僅能針對成功交易進行退款標記',
      error: 'Bad Request',
    },
  })
  @ApiResponse({
    status: 401,
    description: '憑證無效或未登入',
    example: {
      statusCode: 401,
      message: '未認證的使用者',
      error: 'Unauthorized',
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
    description: 'IAP 收據不存在',
    example: {
      statusCode: 404,
      message: 'IAP 收據 (ID: 999999) 不存在',
      error: 'Not Found',
    },
  })
  async updateIapReceiptStatus(
    @Param() params: UpdateIapReceiptStatusParamDto,
    @Body() body: UpdateIapReceiptStatusDto,
    @CurrentUser() user: any,
  ): Promise<UpdateIapReceiptStatusResponseDto> {
    this.logger.log(
      `[UpdateIapReceiptStatus] 管理員 ${user.userId} 發起退款標記操作 | iapReceiptId=${params.id}, status=${body.status}`,
    );

    return this.adminService.updateIapReceiptStatus(params.id, body, user.userId);
  }

  @Patch('coin-ledger/:id/remark')
  @UseGuards(JwtAuthGuard, AdminGuard) // ✅ 先 JWT 認證，再 Admin 授權
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '【管理員專用】編輯金幣流水紀錄的備註欄位',
    description: `
      管理員可透過此 API 編輯特定金幣流水紀錄的備註欄位，用於審計與管理。
      
      **核心特性**：
      - 需要 roleLevel >= 9 的管理員權限
      - 支援部分更新（PATCH）
      - 傳入空字串可清除現有備註
      - 檢查指定的 CoinLedger 紀錄是否存在，不存在返回 404 錯誤
      
      **用途**：編輯金幣交易的審計備註、補充說明、標記特殊交易等
    `,
  })
  @ApiParam({
    name: 'id',
    description: '金幣流水紀錄 ID',
    type: Number,
    example: 123,
  })
  @ApiBody({
    type: UpdateCoinLedgerRemarkDto,
    examples: {
      example1: {
        summary: '新增備註範例',
        value: {
          remark: '禮物卡兌換 - GiftCard-2026-05-15-ABC123',
        },
      },
      example2: {
        summary: '清除備註範例',
        value: {
          remark: '',
        },
      },
      example3: {
        summary: '活動補償說明',
        value: {
          remark: '伺服器維護補償 - 2026-05-15 16:00~18:00',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: '備註編輯成功',
    example: {
      success: true,
      id: 123,
      userId: 456,
      changeAmount: 100,
      balance: 250,
      type: 'ADMIN_GRANT',
      source: '禮物卡兌換',
      remark: '禮物卡兌換 - GiftCard-2026-05-15-ABC123',
      createdAt: '2026-05-15T10:30:00.000Z',
      updatedAt: '2026-05-15T12:34:56.000Z',
    },
  })
  @ApiResponse({
    status: 400,
    description: '請求參數驗證失敗（remark 長度超過 255 字元或型別錯誤）',
    example: {
      statusCode: 400,
      message: ['remark 最多 255 個字元'],
      error: 'Bad Request',
    },
  })
  @ApiResponse({
    status: 401,
    description: '憑證無效或未登入',
    example: {
      statusCode: 401,
      message: '未認證的使用者',
      error: 'Unauthorized',
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
    description: '金幣流水紀錄不存在',
    example: {
      statusCode: 404,
      message: '金幣流水紀錄 (ID: 999999) 不存在',
      error: 'Not Found',
    },
  })
  @ApiResponse({
    status: 500,
    description: '伺服器內部錯誤',
    example: {
      statusCode: 500,
      message: '更新備註失敗: [錯誤詳情]',
      error: 'Internal Server Error',
    },
  })
  async updateCoinLedgerRemark(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateCoinLedgerRemarkDto,
    @CurrentUser() user: any,
  ) {
    this.logger.log(
      `[UpdateRemark] 管理員 ${user.userId} 發起編輯備註操作 | coinLedgerId=${id}, remark=${body.remark}`,
    );

    return this.adminService.updateCoinLedgerRemark(id, body, user.userId);
  }

  @Patch('coin-packs/:id')
  @UseGuards(JwtAuthGuard, AdminGuard) // ✅ 先 JWT 認證，再 Admin 授權
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '【管理員專用】更新金幣方案',
    description: `
      管理員可透過此 API 部分更新指定金幣方案。
      
      **核心特性**：
      - 需要 roleLevel >= 9 的管理員權限
      - 支援部分更新（PATCH）
      - 檢查方案是否存在，不存在返回 404 錯誤
      - 名稱、上下架狀態與排序可隨時修改
      - 商品已有交易紀錄時，不可修改價格、幣別、金幣數量、贈送金幣或平台
      - product_id（SKU）不開放修改
    `,
  })
  @ApiParam({
    name: 'id',
    description: '金幣方案 ID',
    type: Number,
    example: 1,
  })
  @ApiBody({
    type: UpdateCoinPackAdminRequestDto,
    examples: {
      displayFields: {
        summary: '商品已售出後仍可修改的顯示欄位',
        value: {
          name: '基礎套餐',
          is_active: 1,
          sort_order: 10,
        },
      },
      accountingFields: {
        summary: '尚無交易紀錄時可修改帳務欄位',
        value: {
          price: 90,
          currency: 'TWD',
          amount: 100,
          bonus_amount: 10,
          platform: 'GOOGLE',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: '金幣方案更新成功',
    example: {
      success: true,
      id: 1,
      platform: 'ios',
      productId: 'com.example.coins_100',
      name: 'Premium Pack - 1000 Coins',
      amount: 1000,
      bonusAmount: 100,
      price: '9.99',
      currency: 'USD',
      isActive: true,
      sortOrder: 1,
      createdAt: '2026-05-15T10:30:00.000Z',
      updatedAt: '2026-05-15T12:34:56.000Z',
    },
  })
  @ApiResponse({
    status: 400,
    description: '請求參數驗證失敗',
    example: {
      statusCode: 400,
      message: ['name 不能為空', 'name 最多 100 個字元'],
      error: 'Bad Request',
    },
  })
  @ApiResponse({
    status: 401,
    description: '憑證無效或未登入',
    example: {
      statusCode: 401,
      message: '未認證的使用者',
      error: 'Unauthorized',
    },
  })
  @ApiResponse({
    status: 403,
    description: '權限不足，或商品已有交易紀錄卻嘗試修改核心帳務欄位',
    example: {
      statusCode: 403,
      message: '此商品已有交易紀錄，為確保財務對帳正確，無法修改價格、平台或金幣數量。請僅修改名稱/狀態，或建立新商品。',
      error: 'Forbidden',
    },
  })
  @ApiResponse({
    status: 404,
    description: '金幣方案不存在',
    example: {
      statusCode: 404,
      message: '金幣方案 (ID: 999999) 不存在',
      error: 'Not Found',
    },
  })
  @ApiResponse({
    status: 500,
    description: '伺服器內部錯誤',
    example: {
      statusCode: 500,
      message: '金幣方案更新失敗: [錯誤詳情]',
      error: 'Internal Server Error',
    },
  })
  async updateCoinPack(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateCoinPackAdminRequestDto,
    @CurrentUser() user: any,
  ) {
    this.logger.log(
      `[UpdateCoinPack] 管理員 ${user.userId} 發起更新金幣方案操作 | coinPackId=${id}`,
    );

    const coinPack = await this.coinPacksService.updateCoinPackAdmin(id, body);

    return {
      success: true,
      id: coinPack.id,
      platform: coinPack.platform,
      productId: coinPack.productId,
      name: coinPack.name,
      amount: coinPack.amount,
      bonusAmount: coinPack.bonusAmount,
      price: coinPack.price,
      currency: coinPack.currency,
      isActive: coinPack.isActive,
      sortOrder: coinPack.sortOrder,
      createdAt: coinPack.createdAt,
      updatedAt: coinPack.updatedAt,
    };
  }

  @Delete('users/:userId/entitlements/:bookId')
  @UseGuards(JwtAuthGuard, AdminGuard) // ✅ 先 JWT 認證，再 Admin 授權
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '【管理員專用】移除使用者對已購買書籍的擁有權',
    description: `
      管理員可透過此 API 移除（或撤銷）指定使用者對某本已購買書籍的擁有權。
      
      **核心特性**：
      - 需要 roleLevel >= 9 的管理員權限
      - 執行硬刪除操作，此操作不可逆
      - 檢查使用者是否擁有該書籍的權限紀錄，不存在返回 404 錯誤
      - 所有操作均記錄於審計日誌
      
      **用途**：收回贈送的書籍、撤銷誤操作、權限管理等
    `,
  })
  @ApiParam({
    name: 'userId',
    description: '使用者 ID',
    type: Number,
    example: 123,
  })
  @ApiParam({
    name: 'bookId',
    description: '書籍 ID（story_list_id）',
    type: Number,
    example: 456,
  })
  @ApiResponse({
    status: 200,
    description: '擁有權移除成功',
    type: RemoveUserEntitlementResponseDto,
    example: {
      success: true,
      message: '已成功移除使用者 (ID: 123) 對書籍 (ID: 456) 的擁有權',
      userId: 123,
      bookId: 456,
      removedAt: '2026-05-15T12:34:56.000Z',
    },
  })
  @ApiResponse({
    status: 401,
    description: '憑證無效或未登入',
    example: {
      statusCode: 401,
      message: '未認證的使用者',
      error: 'Unauthorized',
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
    description: '擁有權紀錄不存在',
    example: {
      statusCode: 404,
      message: '使用者 (ID: 123) 不擁有書籍 (ID: 456) 的權限紀錄',
      error: 'Not Found',
    },
  })
  @ApiResponse({
    status: 500,
    description: '伺服器內部錯誤',
    example: {
      statusCode: 500,
      message: '移除擁有權失敗: [錯誤詳情]',
      error: 'Internal Server Error',
    },
  })
  async removeUserEntitlement(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('bookId', ParseIntPipe) bookId: number,
    @CurrentUser() user: any,
  ): Promise<RemoveUserEntitlementResponseDto> {
    this.logger.log(
      `[RemoveEntitlement] 管理員 ${user.userId} 發起移除擁有權操作 | targetUserId=${userId}, bookId=${bookId}`,
    );

    return this.adminService.removeUserEntitlement(userId, bookId, user.userId);
  }
}
