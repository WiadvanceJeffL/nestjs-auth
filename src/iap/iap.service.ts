import { Injectable, UnauthorizedException, Logger, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { google } from 'googleapis';
import { IapResponseDto } from './dto/iap-response.dto';
import { handleIapSuccess } from './iap-ledger.helper';
import { PrismaService } from '../prisma.service';

@Injectable()
export class IapService {
  private readonly logger = new Logger(IapService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 🟢 核心方法：從資料庫獲取商品設定（金幣與獎勵）
   */
  private async getProductSettings(platform: 'GOOGLE' | 'APPLE', productId: string) {
    const pack = await this.prisma.coinPack.findUnique({
      where: {
        platform_productId: { platform, productId },
      },
    });

    if (!pack || !pack.isActive) {
      this.logger.error(`[IAP] 商品無效或已下架: [${platform}] ${productId}`);
      throw new NotFoundException(`商品 ${productId} 無效或未上架`);
    }

    return pack;
  }

  /**
   * 🟢 驗證收據入口
   */
  async verifyReceipt(
    platform: 'GOOGLE' | 'APPLE',
    receipt: string,
    userId: number,
    productId: string, // 現在 productId 為必填，確保對應 DB 設定
  ): Promise<IapResponseDto> {
    if (!userId || userId <= 0) {
      throw new UnauthorizedException('無效的使用者 ID');
    }

    if (!productId) {
      throw new UnauthorizedException('必須提供 productId 以對應金幣設定');
    }

    const useMock = this.configService.get('IAP_USE_MOCK') === 'true';

    /**
     * 🟢 MOCK 模式：直接入金不校驗 Google/Apple
     */
    if (useMock) {
      this.logger.warn(`[MOCK] 正在為使用者 ${userId} 驗證 ${platform} 收據`);
      const pack = await this.getProductSettings(platform, productId);
      
      const result = await handleIapSuccess({
        userId,
        platform,
        productId,
        transactionId: `MOCK-TX-${Date.now()}`,
        amount: pack.amount,
        bonusAmount: pack.bonusAmount,
        rawResponse: { mock: true, receipt },
      });

      return {
        success: true,
        platform,
        userId,
        coinsAdded: pack.amount + pack.bonusAmount,
        message: 'Mock IAP verified and coins added',
        raw: result,
      };
    }

    /**
     * 🔵 正式模式：串接第三方 API
     */
    if (platform === 'GOOGLE') {
      return this.verifyGoogle(receipt, userId, productId);
    }

    if (platform === 'APPLE') {
      return this.verifyApple(receipt, userId, productId);
    }

    throw new UnauthorizedException('不支援的平台');
  }

  /**
   * 🔵 Google IAP 驗證邏輯
   */
  private async verifyGoogle(
    purchaseToken: string,
    userId: number,
    productId: string,
  ): Promise<IapResponseDto> {
    try {
      // 1. 先確認資料庫有無此商品設定
      const pack = await this.getProductSettings('GOOGLE', productId);

      // 2. 初始化 Google API 客戶端
      const auth = new google.auth.GoogleAuth({
        keyFile: this.configService.get<string>('GOOGLE_SERVICE_ACCOUNT_KEY_PATH'),
        scopes: ['https://www.googleapis.com/auth/androidpublisher'],
      });
      const androidPublisher = google.androidpublisher({ version: 'v3', auth });

      // 3. 呼叫 Google Developer API
      const response = await androidPublisher.purchases.products.get({
        packageName: this.configService.get<string>('GOOGLE_PACKAGE_NAME'),
        productId: productId,
        token: purchaseToken,
      });

      const data = response.data;

      // 4. 檢查購買狀態 (0 代表已購買成功)
      if (data.purchaseState !== 0) {
        throw new UnauthorizedException(`Google 訂單狀態異常: ${data.purchaseState}`);
      }

      // 5. 呼叫 Helper 進行資料庫交易（入金與存收據）
      const result = await handleIapSuccess({
        userId,
        platform: 'GOOGLE',
        productId,
        transactionId: data.orderId, // 真實的 Google 訂單編號
        amount: pack.amount,
        bonusAmount: pack.bonusAmount,
        rawResponse: data,
      });

      return {
        success: true,
        platform: 'GOOGLE',
        userId,
        coinsAdded: pack.amount + pack.bonusAmount,
        message: 'Google IAP verified success',
        raw: result,
      };

    } catch (error) {
      const msg = error.response?.data?.error?.message || error.message;
      this.logger.error(`[Google Verify Error] ${msg}`);
      throw new UnauthorizedException(`Google 驗證失敗: ${msg}`);
    }
  }

  /**
   * 🔵 Apple IAP 驗證邏輯
   */
  private async verifyApple(
    receipt: string,
    userId: number,
    productId: string,
  ): Promise<IapResponseDto> {
    try {
      const sharedSecret = this.configService.get<string>('APPLE_SHARED_SECRET');
      const isSandbox = this.configService.get('APPLE_IAP_SANDBOX') === 'true';
      
      const verifyUrl = isSandbox 
        ? 'https://sandbox.itunes.apple.com/verifyReceipt' 
        : 'https://buy.itunes.apple.com/verifyReceipt';

      // 1. 呼叫 Apple Verify API
      const response = await axios.post(verifyUrl, {
        'receipt-data': receipt,
        password: sharedSecret,
      });

      if (response.data.status !== 0) {
        throw new UnauthorizedException(`Apple 驗證失敗，Status Code: ${response.data.status}`);
      }

      // 2. 解析收據（如果是單次購買，通常在 receipt.in_app 陣列或直接在 receipt 中）
      const appleReceipt = response.data.receipt;
      const transactionId = appleReceipt.transaction_id || (appleReceipt.in_app && appleReceipt.in_app[0].transaction_id);
      const verifiedProductId = appleReceipt.product_id || (appleReceipt.in_app && appleReceipt.in_app[0].product_id);

      // 3. 從 DB 獲取金幣設定
      const pack = await this.getProductSettings('APPLE', verifiedProductId);

      // 4. 呼叫 Helper 進行資料庫交易
      const result = await handleIapSuccess({
        userId,
        platform: 'APPLE',
        productId: verifiedProductId,
        transactionId: transactionId,
        amount: pack.amount,
        bonusAmount: pack.bonusAmount,
        rawResponse: response.data,
      });

      return {
        success: true,
        platform: 'APPLE',
        userId,
        coinsAdded: pack.amount + pack.bonusAmount,
        message: 'Apple IAP verified success',
        raw: result,
      };

    } catch (error) {
      this.logger.error(`[Apple Verify Error] ${error.message}`);
      throw new UnauthorizedException(`Apple 驗證失敗: ${error.message}`);
    }
  }

  /**
   * 🟠 Webhooks (保持原有結構，可根據需求擴展邏輯)
   */
  async handleGoogleWebhook(body: any, userId: number | string = 'system'): Promise<IapResponseDto> {
    this.logger.warn(`收到 Google Webhook 通知: ${JSON.stringify(body)}`);
    return { success: true, platform: 'GOOGLE', userId: 0, coinsAdded: 0, message: 'Webhook received', raw: body };
  }

  async handleAppleWebhook(body: any, userId: number | string = 'system'): Promise<IapResponseDto> {
    this.logger.warn(`收到 Apple Webhook 通知: ${JSON.stringify(body)}`);
    return { success: true, platform: 'APPLE', userId: 0, coinsAdded: 0, message: 'Webhook received', raw: body };
  }
}
