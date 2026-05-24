import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async coinPurchase(
    userId: number,
    storyListId: number,
    idemKey: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 集中處理購買前餘額檢查，避免不同購買路徑出現不一致的扣款規則。
      const assertSufficientBalance = async (priceCoins: number) => {
        // 使用 FOR UPDATE 鎖定使用者最新一筆流水，降低併發購買時重複使用同一份餘額的風險。
        const balanceRows = await tx.$queryRaw<any[]>`
          SELECT balance
          FROM coin_ledger
          WHERE user_id = ${userId}
          ORDER BY id DESC
          LIMIT 1
          FOR UPDATE
        `;

        // 沒有任何流水時視為 0 元，因為使用者尚未取得可消費金幣。
        const currentBalance = balanceRows.length
          ? Number(balanceRows[0].balance)
          : 0;

        // 系統允許帳務餘額為負數，但購買書籍不允許扣款後低於 0。
        if (currentBalance < priceCoins) {
          throw new ForbiddenException('金幣不足');
        }

        return {
          currentBalance,
          newBalance: currentBalance - priceCoins,
        };
      };

      // 1️⃣ 檢查權益是否存在（業務規則）
      const existingEntitlement = await tx.$queryRaw<any[]>`
        SELECT id FROM entitlements
        WHERE user_id = ${userId} AND story_list_id = ${storyListId}
        LIMIT 1
      `;

      if (existingEntitlement.length > 0) {
        return {
          success: true,
          message: '已擁有此書權益',
        };
      }

      // 2️⃣ 防重送（Idempotency）+ 檢查交易完整性
      const existedOrder = await tx.$queryRaw<any[]>`
        SELECT id, price_coins FROM book_orders
        WHERE user_id = ${userId}
          AND idempotency_key = ${idemKey}
        LIMIT 1
      `;
      if (existedOrder.length > 0) {
        const orderId = Number(existedOrder[0].id);
        const price = existedOrder[0].price_coins;
        
        // 檢查交易的各個步驟是否完整（防止之前的交易在任何步驟失敗）
        const entitlementExists = await tx.$queryRaw<any[]>`
          SELECT id FROM entitlements
          WHERE user_id = ${userId} AND story_list_id = ${storyListId}
          LIMIT 1
        `;
        
        const coinLedgerExists = await tx.$queryRaw<any[]>`
          SELECT id FROM coin_ledger
          WHERE user_id = ${userId}
            AND type = 'BOOK_PURCHASE'
            AND source = ${`ORDER:${orderId}`}
          LIMIT 1
        `;
        
        // 補齊缺失的步驟
        if (entitlementExists.length === 0 || coinLedgerExists.length === 0) {
          // 補齊第 6 步：扣幣流水（如果缺失）
          if (coinLedgerExists.length === 0) {
            // 補扣款前仍需重新檢查餘額，避免在允許負數帳務後把購買扣成負數。
            const { newBalance } = await assertSufficientBalance(price);
            const source = `ORDER:${orderId}`;
            
            await tx.$queryRaw`
              INSERT INTO coin_ledger
                (user_id, change_amount, balance, type, source, created_at)
              VALUES
                (${userId}, ${-price}, ${newBalance}, 'BOOK_PURCHASE', ${source}, NOW())
            `;
          }
          
          // 補齊第 7 步：建立權益（如果缺失）
          if (entitlementExists.length === 0) {
            await tx.$queryRaw`
              INSERT INTO entitlements
                (user_id, story_list_id, created_at)
              VALUES
                (${userId}, ${storyListId}, NOW())
            `;
            
            // 補齊第 8 步：更新銷售計數
            await tx.$queryRaw`
              UPDATE book_store_items
              SET soldCount = soldCount + 1,
                  updatedAt = NOW()
              WHERE storyListId = ${storyListId}
            `;
          }
        }
        
        return { message: '訂單已處理', orderId, success: true };
      }

      // 3️⃣ 取得商品價格
      const items = await tx.$queryRaw<any[]>`
        SELECT priceCoins
        FROM book_store_items
        WHERE storyListId = ${storyListId}
          AND isActive = true
        LIMIT 1
      `;
      if (items.length === 0) {
        throw new BadRequestException('商品不存在或未上架');
      }
      const price = items[0].priceCoins;

      // 4️⃣ 檢查目前餘額，確保購買扣款後不會低於 0。
      const { newBalance } = await assertSufficientBalance(price);

      // 5️⃣ 建立訂單
      await tx.$queryRaw`
        INSERT INTO book_orders
          (user_id, story_list_id, price_coins, status, idempotency_key, created_at)
        VALUES
          (${userId}, ${storyListId}, ${price}, 'SUCCESS', ${idemKey}, NOW())
      `;

      // 取得剛剛插入的訂單 ID
      const orderIdResult = await tx.$queryRaw<any[]>`
        SELECT LAST_INSERT_ID() as id
      `;
      const orderId = Number(orderIdResult[0]?.id);
      if (!orderId) {
        throw new BadRequestException('無法取得訂單 ID');
      }

      // 6️⃣ 扣幣流水
      const source = `ORDER:${orderId}`;
      await tx.$queryRaw`
        INSERT INTO coin_ledger
          (user_id, change_amount, balance, type, source, created_at)
        VALUES
          (${userId}, ${-price}, ${newBalance}, 'BOOK_PURCHASE', ${source}, NOW())
      `;

      // 7️⃣ 建立權益
      await tx.$queryRaw`
        INSERT INTO entitlements
          (user_id, story_list_id, created_at)
        VALUES
          (${userId}, ${storyListId}, NOW())
      `;

      // 8️⃣ 更新銷售計數
      await tx.$queryRaw`
        UPDATE book_store_items
        SET soldCount = soldCount + 1,
            updatedAt = NOW()
        WHERE storyListId = ${storyListId}
      `;

      return {
        success: true,
        orderId,
        priceCoins: price,
        balance: newBalance,
      };
    }, {
      timeout: 10000, // 增加 timeout 到 10 秒
    });
  }
}
