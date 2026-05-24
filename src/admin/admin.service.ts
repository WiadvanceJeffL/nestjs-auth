import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { GrantRewardRequestDto } from './dto/grant-reward-request.dto';
import { GrantRewardResponseDto } from './dto/grant-reward-response.dto';
import { UpdateCoinLedgerRemarkDto } from './dto/update-coin-ledger-remark.dto';
import { UpdateCoinPackNameDto } from './dto/update-coin-pack-name.dto';
import {
  IapReceiptStatus,
  UpdateIapReceiptStatusDto,
  UpdateIapReceiptStatusResponseDto,
} from './dto/update-iap-receipt-status.dto';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 管理員手動發放免費金幣獎勵給指定使用者
   * 使用 Database Transaction 確保金幣增加與發放紀錄完全同步
   *
   * @param requestDto 發放請求（targetUserId, amount, reason）
   * @param adminId 執行此操作的管理員 ID（用於審計日誌）
   * @returns 發放結果（包含新餘額與發放時間戳）
   * @throws NotFoundException 如果 targetUserId 不存在
   * @throws BadRequestException 如果參數驗證失敗
   */
  async grantRewardToUser(
    requestDto: GrantRewardRequestDto,
    adminId: number,
  ): Promise<GrantRewardResponseDto> {
    const { targetUserId, amount, reason } = requestDto;

    // ✅ Step 1: 檢查目標使用者是否存在
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      this.logger.warn(
        `[GrantReward] 嘗試向不存在的使用者發放獎勵: targetUserId=${targetUserId}, admin=${adminId}`,
      );
      throw new NotFoundException(`目標使用者 (ID: ${targetUserId}) 不存在`);
    }

    // ✅ Step 2: 使用 Transaction 確保原子性操作
    try {
      const result = await this.prisma.$transaction(
        async (tx) => {
          // 查詢該使用者最後一筆金幣流水，取得當前餘額
          const lastLedger = await tx.coinLedger.findFirst({
            where: { userId: targetUserId },
            orderBy: { id: 'desc' },
          });

          const currentBalance = lastLedger?.balance || 0;
          const newBalance = currentBalance + amount;

          // 寫入新的金幣流水記錄
          const ledgerEntry = await tx.coinLedger.create({
            data: {
              userId: targetUserId,
              changeAmount: amount,
              balance: newBalance,
              type: 'ADMIN_GRANT', // ✅ 區分為管理員發放
              source: reason, // ✅ 將原因寫入 source 欄位進行審計
            },
          });

          this.logger.log(
            `[GrantReward] 成功發放 | admin=${adminId}, target=${targetUserId}, amount=${amount}, newBalance=${newBalance}, reason=${reason}`,
          );

          return {
            ledgerEntry,
            newBalance,
          };
        },
        { timeout: 5000 }, // 交易超時 5 秒
      );

      // ✅ Step 3: 構建成功回應
      return {
        success: true,
        targetUserId,
        amount,
        newBalance: result.newBalance,
        reason,
        grantedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `[GrantReward] 交易失敗 | admin=${adminId}, target=${targetUserId}, amount=${amount}, error=${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BadRequestException(`金幣發放失敗: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 管理員將成功的 IAP 收據標記為退款
   *
   * @param iapReceiptId IAP 收據 ID
   * @param updateDto 更新請求（status 僅允許 REFUNDED）
   * @param adminId 執行此操作的管理員 ID（用於審計日誌）
   * @returns 更新後的 IAP 收據資訊
   * @throws NotFoundException 如果指定的 IAP 收據不存在
   * @throws BadRequestException 如果收據目前不是 SUCCESS 狀態
   */
  async updateIapReceiptStatus(
    iapReceiptId: number,
    updateDto: UpdateIapReceiptStatusDto,
    adminId: number,
  ): Promise<UpdateIapReceiptStatusResponseDto> {
    const result = await this.prisma.$transaction(async (tx) => {
      const receipt = await tx.iapReceipt.findUnique({
        where: { id: iapReceiptId },
      });

      if (!receipt) {
        this.logger.warn(
          `[UpdateIapReceiptStatus] 嘗試更新不存在的 IAP 收據: id=${iapReceiptId}, admin=${adminId}`,
        );
        throw new NotFoundException(`IAP 收據 (ID: ${iapReceiptId}) 不存在`);
      }

      if (receipt.status !== 'SUCCESS') {
        this.logger.warn(
          `[UpdateIapReceiptStatus] 收據狀態不可退款 | id=${iapReceiptId}, currentStatus=${receipt.status}, admin=${adminId}`,
        );
        throw new BadRequestException('僅能針對成功交易進行退款標記');
      }

      const updateResult = await tx.iapReceipt.updateMany({
        where: {
          id: iapReceiptId,
          status: 'SUCCESS',
        },
        data: {
          status: updateDto.status,
        },
      });

      if (updateResult.count !== 1) {
        this.logger.warn(
          `[UpdateIapReceiptStatus] 收據狀態已被異動，無法退款 | id=${iapReceiptId}, admin=${adminId}`,
        );
        throw new BadRequestException('僅能針對成功交易進行退款標記');
      }

      const updatedReceipt = await tx.iapReceipt.findUniqueOrThrow({
        where: { id: iapReceiptId },
      });

      this.logger.log(
        `[UpdateIapReceiptStatus] 成功更新 | admin=${adminId}, iapReceiptId=${iapReceiptId}, transactionId=${updatedReceipt.transactionId}, status=${updatedReceipt.status}`,
      );

      return updatedReceipt;
    });

    return {
      success: true,
      id: result.id,
      userId: result.userId,
      platform: result.platform,
      productId: result.productId,
      transactionId: result.transactionId,
      coins: result.coins,
      status: result.status as IapReceiptStatus,
      createdAt: result.createdAt,
      markedAt: new Date().toISOString(),
    };
  }

  /**
   * 管理員編輯金幣流水紀錄的備註欄位
   *
   * @param coinLedgerId 金幣流水紀錄 ID
   * @param updateDto 更新請求（remark 欄位）
   * @param adminId 執行此操作的管理員 ID（用於審計日誌）
   * @returns 更新後的金幣流水紀錄
   * @throws NotFoundException 如果指定的 CoinLedger 紀錄不存在
   */
  async updateCoinLedgerRemark(
    coinLedgerId: number,
    updateDto: UpdateCoinLedgerRemarkDto,
    adminId: number,
  ) {
    const { remark } = updateDto;

    // ✅ Step 1: 檢查指定的 CoinLedger 紀錄是否存在
    const coinLedger = await this.prisma.coinLedger.findUnique({
      where: { id: coinLedgerId },
    });

    if (!coinLedger) {
      this.logger.warn(
        `[UpdateRemarkLedger] 嘗試編輯不存在的 CoinLedger 紀錄: id=${coinLedgerId}, admin=${adminId}`,
      );
      throw new NotFoundException(`金幣流水紀錄 (ID: ${coinLedgerId}) 不存在`);
    }

    // ✅ Step 2: 更新備註欄位
    try {
      const updatedLedger = await this.prisma.coinLedger.update({
        where: { id: coinLedgerId },
        data: {
          remark: remark || null, // 允許傳入空字串以清除備註
        },
      });

      this.logger.log(
        `[UpdateRemarkLedger] 成功更新 | admin=${adminId}, coinLedgerId=${coinLedgerId}, remark=${remark}`,
      );

      return {
        success: true,
        id: updatedLedger.id,
        userId: updatedLedger.userId,
        changeAmount: updatedLedger.changeAmount,
        balance: updatedLedger.balance,
        type: updatedLedger.type,
        source: updatedLedger.source,
        remark: (updatedLedger as any).remark,
        createdAt: updatedLedger.createdAt,
        updatedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `[UpdateRemarkLedger] 更新失敗 | admin=${adminId}, coinLedgerId=${coinLedgerId}, error=${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BadRequestException(`更新備註失敗: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 管理員修改金幣方案的名稱
   *
   * @param coinPackId 金幣方案 ID
   * @param updateDto 更新請求（name 欄位）
   * @param adminId 執行此操作的管理員 ID（用於審計日誌）
   * @returns 更新後的金幣方案資訊
   * @throws NotFoundException 如果指定的 CoinPack 不存在
   * @throws ConflictException 如果新名稱已被其他方案使用（可選）
   */
  async updateCoinPackName(
    coinPackId: number,
    updateDto: UpdateCoinPackNameDto,
    adminId: number,
  ) {
    const { name } = updateDto;

    // ✅ Step 1: 檢查指定的 CoinPack 是否存在
    const existingCoinPack = await this.prisma.coinPack.findUnique({
      where: { id: coinPackId },
    });

    if (!existingCoinPack) {
      this.logger.warn(
        `[UpdateCoinPackName] 嘗試編輯不存在的 CoinPack: id=${coinPackId}, admin=${adminId}`,
      );
      throw new NotFoundException(`金幣方案 (ID: ${coinPackId}) 不存在`);
    }

    // ✅ Step 2: 檢查新名稱是否已被其他方案使用（可選的唯一性檢查）
    // 如果系統規定方案名稱不能重複，可啟用此檢查
    const duplicateName = await this.prisma.coinPack.findFirst({
      where: {
        name: name,
        id: { not: coinPackId }, // 排除當前方案本身
      },
    });

    if (duplicateName) {
      this.logger.warn(
        `[UpdateCoinPackName] 金幣方案名稱已存在: name=${name}, admin=${adminId}`,
      );
      throw new ConflictException(`金幣方案名稱「${name}」已被其他方案使用，請使用不同的名稱`);
    }

    // ✅ Step 3: 更新名稱欄位
    try {
      const updatedCoinPack = await this.prisma.coinPack.update({
        where: { id: coinPackId },
        data: {
          name: name,
        },
      });

      this.logger.log(
        `[UpdateCoinPackName] 成功更新 | admin=${adminId}, coinPackId=${coinPackId}, oldName=${existingCoinPack.name}, newName=${name}`,
      );

      return {
        success: true,
        id: updatedCoinPack.id,
        platform: updatedCoinPack.platform,
        productId: updatedCoinPack.productId,
        name: updatedCoinPack.name,
        amount: updatedCoinPack.amount,
        bonusAmount: updatedCoinPack.bonusAmount,
        price: updatedCoinPack.price,
        currency: updatedCoinPack.currency,
        isActive: updatedCoinPack.isActive,
        sortOrder: updatedCoinPack.sortOrder,
        createdAt: updatedCoinPack.createdAt,
        updatedAt: updatedCoinPack.updatedAt,
      };
    } catch (error) {
      this.logger.error(
        `[UpdateCoinPackName] 更新失敗 | admin=${adminId}, coinPackId=${coinPackId}, error=${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BadRequestException(`金幣方案名稱更新失敗: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 管理員移除指定使用者對某本已購買書籍的擁有權
   * 此操作將硬刪除該擁有權記錄，不可逆。
   *
   * @param userId 使用者 ID
   * @param bookId 書籍 ID（story_list_id）
   * @param adminId 執行此操作的管理員 ID（用於審計日誌）
   * @returns 移除結果
   * @throws NotFoundException 如果擁有權紀錄不存在
   */
  async removeUserEntitlement(
    userId: number,
    bookId: number,
    adminId: number,
  ): Promise<{
    success: boolean;
    message: string;
    userId: number;
    bookId: number;
    removedAt: string;
  }> {
    // ✅ Step 1: 檢查該使用者是否確實擁有該書籍的權限紀錄
    const entitlement = await this.prisma.entitlements.findFirst({
      where: {
        user_id: BigInt(userId),
        story_list_id: bookId,
      },
    });

    if (!entitlement) {
      this.logger.warn(
        `[RemoveEntitlement] 嘗試移除不存在的擁有權紀錄: userId=${userId}, bookId=${bookId}, admin=${adminId}`,
      );
      throw new NotFoundException(
        `使用者 (ID: ${userId}) 不擁有書籍 (ID: ${bookId}) 的權限紀錄`,
      );
    }

    // ✅ Step 2: 執行硬刪除操作
    try {
      await this.prisma.entitlements.deleteMany({
        where: {
          user_id: BigInt(userId),
          story_list_id: bookId,
        },
      });

      this.logger.log(
        `[RemoveEntitlement] 成功移除 | admin=${adminId}, userId=${userId}, bookId=${bookId}`,
      );

      return {
        success: true,
        message: `已成功移除使用者 (ID: ${userId}) 對書籍 (ID: ${bookId}) 的擁有權`,
        userId,
        bookId,
        removedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `[RemoveEntitlement] 刪除失敗 | admin=${adminId}, userId=${userId}, bookId=${bookId}, error=${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BadRequestException(
        `移除擁有權失敗: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
