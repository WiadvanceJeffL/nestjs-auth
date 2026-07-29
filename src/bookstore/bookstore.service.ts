import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateBookstoreDto } from './dto/create-bookstore.dto';
import { UpdateBookstoreDto } from './dto/update-bookstore.dto';

@Injectable()
export class BookstoreService {
  constructor(private prisma: PrismaService) {}

  /**
   * 【後台管理員專用】建立書本商店項目
   * - 建立前確認書籍存在，避免產生孤兒資料
   * - 每本書只能建立一筆商店屬性，重複建立回傳 409
   */
  async createAdminBookstore(createBookstoreDto: CreateBookstoreDto) {
    const {
      bookId,
      priceCoins,
      currency = 'COIN',
      isActive = true,
      soldCount = 0,
    } = createBookstoreDto;

    const book = await this.prisma.storyLists.findUnique({
      where: { id: bookId },
      select: {
        id: true,
        main_menu_name: true,
        author: true,
        main_menu_image: true,
      },
    });

    if (!book) {
      throw new NotFoundException(`書籍 (ID: ${bookId}) 不存在`);
    }

    const existingItem = await this.prisma.bookStoreItem.findUnique({
      where: { storyListId: bookId },
      select: { id: true },
    });

    if (existingItem) {
      throw new ConflictException(`書籍 (ID: ${bookId}) 已存在商店設定`);
    }

    try {
      return await this.prisma.bookStoreItem.create({
        data: {
          storyListId: bookId,
          priceCoins,
          currency,
          isActive,
          soldCount,
        },
        include: {
          story: {
            select: {
              id: true,
              main_menu_name: true,
              author: true,
              main_menu_image: true,
            },
          },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(`書籍 (ID: ${bookId}) 已存在商店設定`);
      }

      throw new InternalServerErrorException({
        success: false,
        message: '資料庫連線失敗',
      });
    }
  }

  /**
   * 【後台管理員專用】部分更新書本商店項目
   * - 更新前確認商店項目存在
   * - 只更新 request body 有帶入且不是 null 的欄位
   */
  async updateAdminBookstore(id: number, updateBookstoreDto: UpdateBookstoreDto) {
    const existingItem = await this.prisma.bookStoreItem.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingItem) {
      throw new NotFoundException(`書本商店設定 (ID: ${id}) 不存在`);
    }

    const data: Prisma.BookStoreItemUpdateInput = {};

    if (updateBookstoreDto.priceCoins !== undefined && updateBookstoreDto.priceCoins !== null) {
      data.priceCoins = updateBookstoreDto.priceCoins;
    }

    if (updateBookstoreDto.currency !== undefined && updateBookstoreDto.currency !== null) {
      data.currency = updateBookstoreDto.currency;
    }

    if (updateBookstoreDto.isActive !== undefined && updateBookstoreDto.isActive !== null) {
      data.isActive = updateBookstoreDto.isActive;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('至少需提供一個可更新欄位');
    }

    try {
      return await this.prisma.bookStoreItem.update({
        where: { id },
        data,
        include: {
          story: {
            select: {
              id: true,
              main_menu_name: true,
              author: true,
              main_menu_image: true,
            },
          },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`書本商店設定 (ID: ${id}) 不存在`);
      }

      throw new InternalServerErrorException({
        success: false,
        message: '資料庫連線失敗',
      });
    }
  }

  /**
   * 【後台管理員專用】刪除書本商店項目
   * - 僅刪除 book_store_items 的商店屬性紀錄
   * - 不會刪除 StoryLists 書籍主表紀錄
   */
  async deleteAdminBookstore(id: number) {
    const existingItem = await this.prisma.bookStoreItem.findUnique({
      where: { id },
      select: {
        id: true,
        storyListId: true,
      },
    });

    if (!existingItem) {
      throw new NotFoundException(`書本商店設定 (ID: ${id}) 不存在`);
    }

    try {
      const deletedItem = await this.prisma.bookStoreItem.delete({
        where: { id },
        include: {
          story: {
            select: {
              id: true,
              main_menu_name: true,
              author: true,
              main_menu_image: true,
            },
          },
        },
      });

      return {
        success: true,
        message: '書本商店設定已刪除，書籍主表紀錄保留',
        deletedItem,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`書本商店設定 (ID: ${id}) 不存在`);
      }

      throw new InternalServerErrorException({
        success: false,
        message: '資料庫連線失敗',
      });
    }
  }

  async getBookStoreList() {
    try {
      const items = await this.prisma.bookStoreItem.findMany({
        where: {
          isActive: true,
        },
        include: {
          story: {
            select: {
              id: true,
              main_menu_name: true,
              author: true,
              main_menu_image: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Prisma.findMany 若無資料會回傳空陣列，直接回傳給 controller
      return items;
    } catch (error) {
      // 若發生 DB 或 Prisma 錯誤，回傳 500 與一致的 message 結構
      throw new InternalServerErrorException({ success: false, message: '資料庫連線失敗' });
    }
  }

  /**
   * 取得使用者已購買的書籍清單（權益列表）
   * @param userId 使用者 ID
   * @param page 頁碼（預設 1）
   * @param limit 每頁筆數（預設 20）
   * @returns 分頁的已購買書籍列表
   */
  async getUserEntitlements(userId: number, page: number = 1, limit: number = 20) {
    try {
      // 驗證分頁參數
      const pageNum = Math.max(1, page);
      const limitNum = Math.max(1, limit);
      const skip = (pageNum - 1) * limitNum;

      // 並行查詢：取得總筆數和分頁資料
      const [entitlements, total] = await Promise.all([
        this.prisma.entitlements.findMany({
          where: {
            user_id: BigInt(userId),
          },
          select: {
            story_list_id: true,
            created_at: true,
          },
          orderBy: {
            created_at: 'desc', // 按購買日期最新優先
          },
          skip,
          take: limitNum,
        }),
        this.prisma.entitlements.count({
          where: {
            user_id: BigInt(userId),
          },
        }),
      ]);

      // 獲取關聯的故事資訊
      const storyListIds = entitlements.map((e) => e.story_list_id);
      const stories = await this.prisma.storyLists.findMany({
        where: {
          id: { in: storyListIds },
        },
        select: {
          id: true,
          main_menu_name: true,
          author: true,
          main_menu_image: true,
        },
      });

      // 建立 story ID 的 Map 以加速查詢
      const storyMap = new Map(stories.map((s) => [s.id, s]));

      // 組合結果
      const items = entitlements.map((entitled) => ({
        storyListId: entitled.story_list_id,
        createdAt: entitled.created_at,
        story: storyMap.get(entitled.story_list_id),
      }));

      return {
        items,
        total,
        page: pageNum,
        limit: limitNum,
      };
    } catch (error) {
      throw new InternalServerErrorException({ success: false, message: '資料庫連線失敗' });
    }
  }

  /**
   * 【後台管理員專用】取得指定用戶已購買的書籍列表（權益列表）
   * - 包含用戶基本資訊（ID、username、email）
   * - 包含用戶已購買的書籍列表，以購買日期由新至舊排序
   * - 支援分頁查詢
   *
   * @param userId 目標用戶 ID
   * @param page 頁碼（預設 1）
   * @param limit 每頁筆數（預設 20，最多 100）
   * @returns 包含用戶資訊、權益列表與分頁資訊的物件
   * @throws InternalServerErrorException 資料庫連線失敗時
   */
  async getAdminEntitlements(
    userId: number,
    page: number = 1,
    limit: number = 20,
  ) {
    try {
      // 驗證分頁參數
      const pageNum = Math.max(1, page);
      const limitNum = Math.min(100, Math.max(1, limit)); // 限制最多 100 筆
      const skip = (pageNum - 1) * limitNum;

      // 並行查詢：取得用戶資訊與權益總數
      const [user, entitlementCount] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            name: true,
            email: true,
          },
        }),
        this.prisma.entitlements.count({
          where: {
            user_id: BigInt(userId),
          },
        }),
      ]);

      // 若用戶不存在，返回用戶不存在的結構
      if (!user) {
        return {
          user: null,
          entitlements: [],
          pagination: {
            total: 0,
            page: pageNum,
            limit: limitNum,
            totalPages: 0,
          },
        };
      }

      // 查詢用戶的權益列表（已購買的書籍）
      const entitlements = await this.prisma.entitlements.findMany({
        where: {
          user_id: BigInt(userId),
        },
        select: {
          story_list_id: true,
          created_at: true,
        },
        orderBy: {
          created_at: 'desc', // 按購買日期最新優先
        },
        skip,
        take: limitNum,
      });

      // 獲取關聯的故事資訊
      const storyListIds = entitlements.map((e) => e.story_list_id);
      let stories = [];

      if (storyListIds.length > 0) {
        stories = await this.prisma.storyLists.findMany({
          where: {
            id: { in: storyListIds },
          },
          select: {
            id: true,
            main_menu_title: true,
            author: true,
            main_menu_image: true,
          },
        });
      }

      // 建立 story ID 的 Map 以加速查詢
      const storyMap = new Map(stories.map((s) => [s.id, s]));

      // 組合權益列表
      const entitlementList = entitlements.map((entitled) => {
        const story = storyMap.get(entitled.story_list_id);
        return {
          book: {
            id: entitled.story_list_id,
            title: story?.main_menu_title ?? 'Unknown Book',
            author: story?.author ?? 'Unknown Author',
            coverImage: story?.main_menu_image ?? '',
          },
          purchasedAt: entitled.created_at,
        };
      });

      // 計算總頁數
      const totalPages = Math.ceil(entitlementCount / limitNum);

      return {
        user: {
          id: user.id,
          username: user.name || 'Unknown',
          email: user.email,
        },
        entitlements: entitlementList,
        pagination: {
          total: entitlementCount,
          page: pageNum,
          limit: limitNum,
          totalPages,
        },
      };
    } catch (error) {
      throw new InternalServerErrorException({
        success: false,
        message: '資料庫連線失敗',
      });
    }
  }

  /**
   * 【後台管理員專用】取得所有書本商店清單（包含所有狀態的書籍）
   * - 不過濾上下架狀態，返回所有書籍
   * - 支援分頁查詢
   * - 按建立時間由新至舊排序
   *
   * @param page 頁碼（預設 1）
   * @param limit 每頁筆數（預設 20，最多 100）
   * @returns 包含書籍清單與分頁資訊的物件
   * @throws InternalServerErrorException 資料庫連線失敗時
   */
  async getAdminBookstores(
    page: number = 1,
    limit: number = 20,
  ) {
    try {
      // ✅ 驗證分頁參數
      const pageNum = Math.max(1, page);
      const limitNum = Math.min(100, Math.max(1, limit)); // 限制最多 100 筆
      const skip = (pageNum - 1) * limitNum;

      // ✅ 並行查詢：取得總筆數和分頁資料
      const [items, total] = await Promise.all([
        this.prisma.bookStoreItem.findMany({
          // ❌ 不過濾 isActive，查詢所有書籍
          include: {
            story: {
              select: {
                id: true,
                main_menu_name: true,
                author: true,
                main_menu_image: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc', // ✅ 按建立時間由新至舊排序
          },
          skip,
          take: limitNum,
        }),
        this.prisma.bookStoreItem.count(), // ✅ 不過濾，計算全部書籍總數
      ]);

      // ✅ 計算總頁數
      const totalPages = Math.ceil(total / limitNum);

      return {
        data: items,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages,
        },
      };
    } catch (error) {
      throw new InternalServerErrorException({
        success: false,
        message: '資料庫連線失敗',
      });
    }
  }
}
