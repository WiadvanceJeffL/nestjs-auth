import { Injectable, BadRequestException, ForbiddenException, InternalServerErrorException, Logger, NotFoundException, HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateCoinPackRequestDto } from './dto/create-coin-pack-request.dto';
import { UpdateCoinPackAdminRequestDto } from './dto/update-coin-pack-admin-request.dto';
import { GetCoinPacksQueryDto } from './dto/get-coin-packs-query.dto';
import { GetAdminCoinPacksResponseDto } from './dto/get-admin-coin-packs-response.dto';

@Injectable()
export class CoinPacksService {
  private readonly logger = new Logger(CoinPacksService.name);
  private static readonly ACCOUNTING_FIELDS = [
    'price',
    'currency',
    'amount',
    'bonus_amount',
    'platform',
  ] as const;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 取得金幣商品清單
   * @param platform 平台 (GOOGLE | APPLE)
   */
  async findAll(platform?: 'GOOGLE' | 'APPLE') {
    return this.prisma.coinPack.findMany({
      where: {
        // 1. 只撈取 "上架中" 的商品
        isActive: true,
        // 2. 如果有指定平台則過濾，否則撈取全部
        ...(platform && { platform }),
      },
      orderBy: {
        // 3. 依照資料庫設定的 sortOrder 進行排序 (由小到大)
        sortOrder: 'asc',
      },
      // 4. (選填) 如果不想回傳 created_at 等欄位，可以用 select 過濾
      // select: {
      //   id: true,
      //   productId: true,
      //   name: true,
      //   price: true,
      //   currency: true,
      //   amount: true,
      //   bonusAmount: true,
      //   platform: true,
      // }
    });
  }

  /**
   * 後台取得完整金幣方案清單（不過濾上下架狀態）
   */
  async findAllForAdmin(
    query: GetCoinPacksQueryDto,
  ): Promise<GetAdminCoinPacksResponseDto> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [total, coinPacks] = await this.prisma.$transaction([
      this.prisma.coinPack.count(),
      this.prisma.coinPack.findMany({
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
    ]);

    return {
      success: true,
      data: coinPacks.map((pack) => ({
        id: pack.id,
        platform: pack.platform,
        product_id: pack.productId,
        name: pack.name,
        amount: pack.amount,
        bonus_amount: pack.bonusAmount,
        price: Number(pack.price),
        currency: pack.currency,
        is_active: pack.isActive,
        sort_order: pack.sortOrder,
        created_at: pack.createdAt,
        updated_at: pack.updatedAt,
      })),
      total,
      page,
      limit,
    };
  }

  /**
   * 建立金幣儲值包 (Admin Only)
   * @param createCoinPackDto 金幣儲值包資料
   * @returns 建立的金幣儲值包
   * @throws BadRequestException - 當 platform + productId 已存在或參數不合法
   * @throws InternalServerErrorException - 資料庫操作失敗
   */
  async create(createCoinPackDto: CreateCoinPackRequestDto) {
    try {
      // SKU 在各平台內唯一；不同平台可使用相同的 productId。
      const existingPack = await this.prisma.coinPack.findUnique({
        where: {
          platform_productId: {
            platform: createCoinPackDto.platform,
            productId: createCoinPackDto.product_id,
          },
        },
      });

      if (existingPack) {
        this.logger.warn(
          `Duplicate coin pack attempt: platform=${createCoinPackDto.platform}, productId=${createCoinPackDto.product_id}`,
        );
        throw new BadRequestException(
          `此 platform (${createCoinPackDto.platform}) 已存在相同的 productId (${createCoinPackDto.product_id})`,
        );
      }

      // 建立新的金幣儲值包
      const coinPack = await this.prisma.coinPack.create({
        data: {
          platform: createCoinPackDto.platform,
          productId: createCoinPackDto.product_id,
          name: createCoinPackDto.name,
          amount: createCoinPackDto.amount,
          bonusAmount: createCoinPackDto.bonusAmount || 0,
          price: createCoinPackDto.price,
          currency: createCoinPackDto.currency || 'TWD',
          isActive: createCoinPackDto.is_active === 0 ? false : true,
          sortOrder: 999, // 預設排序權重，管理員可後續調整
        },
      });

      this.logger.log(
        `Successfully created coin pack: id=${coinPack.id}, platform=${coinPack.platform}, productId=${coinPack.productId}`,
      );

      return coinPack;
    } catch (error) {
      // 檢查 error 是否為 HttpException
      if (error instanceof HttpException) {
        throw error;
      }

      // 確認錯誤類型，用於檢查 Prisma 特定錯誤
      const prismaError = error as Record<string, unknown>;

      // P2002 是 Prisma 的唯一約束違反錯誤代碼
      if (prismaError.code === 'P2002') {
        this.logger.warn(`Unique constraint violation: ${String(prismaError.message)}`);
        throw new BadRequestException('此 platform 與 productId 的組合已存在');
      }

      // 其他未預期的錯誤
      const errorMessage = prismaError.message ? String(prismaError.message) : '未知錯誤';
      this.logger.error(`Failed to create coin pack: ${errorMessage}`, error instanceof Error ? error.stack : '');
      throw new InternalServerErrorException('建立金幣儲值包失敗，請稍後重試');
    }
  }

  /**
   * 更新金幣儲值包 (Admin Only)
   * @param id 金幣儲值包 ID
   * @param updateCoinPackAdminDto 可更新的顯示、狀態與帳務欄位；SKU 不可更新
   * @returns 更新後的金幣儲值包
   * @throws NotFoundException - 當指定 ID 的金幣儲值包不存在
   * @throws InternalServerErrorException - 資料庫操作失敗
   */
  async updateCoinPackAdmin(id: number, updateCoinPackAdminDto: UpdateCoinPackAdminRequestDto) {
    try {
      const data = this.buildUpdateData(updateCoinPackAdminDto);
      if (Object.keys(data).length === 0) {
        throw new BadRequestException('請至少提供一個可更新欄位');
      }

      const updatesAccountingField = CoinPacksService.ACCOUNTING_FIELDS.some((field) =>
        Object.prototype.hasOwnProperty.call(updateCoinPackAdminDto, field),
      );

      const updatedPack = await this.prisma.$transaction(async (tx) => {
        const existingPack = await tx.coinPack.findUnique({ where: { id } });

        if (!existingPack) {
          this.logger.warn(`Attempt to update non-existent coin pack: id=${id}`);
          throw new NotFoundException(`金幣儲值包不存在 (ID: ${id})`);
        }

        if (updatesAccountingField) {
          const receipt = await tx.iapReceipt.findFirst({
            where: {
              platform: existingPack.platform,
              productId: existingPack.productId,
            },
            select: { id: true },
          });

          if (receipt) {
            throw new ForbiddenException(
              '此商品已有交易紀錄，為確保財務對帳正確，無法修改價格、平台或金幣數量。請僅修改名稱/狀態，或建立新商品。',
            );
          }
        }

        return tx.coinPack.update({ where: { id }, data });
      });

      this.logger.log(
        `Successfully updated coin pack: id=${updatedPack.id}`,
      );

      return updatedPack;
    } catch (error) {
      // 檢查 error 是否為 HttpException
      if (error instanceof HttpException) {
        throw error;
      }

      const prismaError = error as Record<string, unknown>;
      if (prismaError.code === 'P2002') {
        throw new BadRequestException('此 platform 與 productId 的組合已存在');
      }

      // 其他未預期的錯誤
      const errorMessage = error instanceof Error ? error.message : '未知錯誤';
      this.logger.error(`Failed to update coin pack: ${errorMessage}`, error instanceof Error ? error.stack : '');
      throw new InternalServerErrorException('更新金幣儲值包失敗，請稍後重試');
    }
  }

  private buildUpdateData(dto: UpdateCoinPackAdminRequestDto): Prisma.CoinPackUpdateInput {
    return {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.is_active !== undefined && { isActive: dto.is_active === 1 }),
      ...(dto.sort_order !== undefined && { sortOrder: dto.sort_order }),
      ...(dto.price !== undefined && { price: dto.price }),
      ...(dto.currency !== undefined && { currency: dto.currency }),
      ...(dto.amount !== undefined && { amount: dto.amount }),
      ...(dto.bonus_amount !== undefined && { bonusAmount: dto.bonus_amount }),
      ...(dto.platform !== undefined && { platform: dto.platform }),
    };
  }
}
