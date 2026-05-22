import { Controller, Post, Patch, Delete, Body, Param, UseGuards, HttpCode, HttpStatus, Logger, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AdminGuard } from '../auth/admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GrantRewardRequestDto } from './dto/grant-reward-request.dto';
import { GrantRewardResponseDto } from './dto/grant-reward-response.dto';
import { UpdateCoinLedgerRemarkDto } from './dto/update-coin-ledger-remark.dto';
import { UpdateCoinPackNameDto } from './dto/update-coin-pack-name.dto';
import { RemoveUserEntitlementResponseDto } from './dto/remove-user-entitlement-response.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(private readonly adminService: AdminService) {}

  @Post('rewards/grant')
  @UseGuards(JwtAuthGuard, AdminGuard) // ✅ 先 JWT 認證，再 Admin 授權
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '【管理員專用】手動發放免費金幣獎勵',
    description: `
      管理員可透過此 API 手動發放免費金幣給指定使用者。
      
      **核心特性**：
      - 需要 roleLevel >= 9 的管理員權限
      - 略過「單一活動限領一次」的限制
      - 使用 Database Transaction 確保金幣增加與發放紀錄完全同步（ACID 特性）
      - 所有發放紀錄寫入 CoinLedger 表（type='ADMIN_GRANT'，source=reason）
      - 檢查目標使用者是否存在，不存在返回 404 錯誤
      
      **用途**：禮物卡兌換、活動補償、系統故障補償、測試等管理員特殊操作
    `,
  })
  @ApiBody({
    type: GrantRewardRequestDto,
    examples: {
      example1: {
        summary: '禮物卡兌換範例',
        value: {
          targetUserId: 123,
          amount: 100,
          reason: '禮物卡兌換 - Gift-2026-05-15-ABC123',
        },
      },
      example2: {
        summary: '活動補償範例',
        value: {
          targetUserId: 456,
          amount: 50,
          reason: '系統故障補償 - 2026-05-15 伺服器維護期間',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    type: GrantRewardResponseDto,
    description: '金幣發放成功',
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
    description: '請求參數驗證失敗（targetUserId 或 amount 無效）',
    example: {
      statusCode: 400,
      message: ['targetUserId 必須是整數', 'amount 必須大於 0'],
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
    summary: '【管理員專用】修改金幣方案名稱',
    description: `
      管理員可透過此 API 修改指定金幣方案的名稱。
      
      **核心特性**：
      - 需要 roleLevel >= 9 的管理員權限
      - 支援部分更新（PATCH）
      - 檢查方案是否存在，不存在返回 404 錯誤
      - 檢查新名稱是否已被其他方案使用，防止重複（409 Conflict）
      
      **用途**：修改金幣方案的顯示名稱、更新方案描述等
    `,
  })
  @ApiParam({
    name: 'id',
    description: '金幣方案 ID',
    type: Number,
    example: 1,
  })
  @ApiBody({
    type: UpdateCoinPackNameDto,
    examples: {
      example1: {
        summary: '修改為簡單名稱',
        value: {
          name: '基礎套餐',
        },
      },
      example2: {
        summary: '修改為詳細名稱',
        value: {
          name: 'Premium Pack - 1000 Coins + 100 Bonus',
        },
      },
      example3: {
        summary: '修改為推廣套餐名稱',
        value: {
          name: '限時優惠 - 購買即送雙倍金幣',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: '金幣方案名稱修改成功',
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
    description: '請求參數驗證失敗（name 為空或長度超過 100 字元）',
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
    description: '權限不足（非管理員，roleLevel < 9）',
    example: {
      statusCode: 403,
      message: '只有管理員可存取此資源',
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
    status: 409,
    description: '金幣方案名稱已被其他方案使用',
    example: {
      statusCode: 409,
      message: '金幣方案名稱「Premium Pack」已被其他方案使用，請使用不同的名稱',
      error: 'Conflict',
    },
  })
  @ApiResponse({
    status: 500,
    description: '伺服器內部錯誤',
    example: {
      statusCode: 500,
      message: '金幣方案名稱更新失敗: [錯誤詳情]',
      error: 'Internal Server Error',
    },
  })
  async updateCoinPackName(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateCoinPackNameDto,
    @CurrentUser() user: any,
  ) {
    this.logger.log(
      `[UpdateCoinPackName] 管理員 ${user.userId} 發起修改金幣方案名稱操作 | coinPackId=${id}, newName=${body.name}`,
    );

    return this.adminService.updateCoinPackName(id, body, user.userId);
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
