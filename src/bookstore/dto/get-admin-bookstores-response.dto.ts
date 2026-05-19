import { ApiProperty } from '@nestjs/swagger';
import { BookstoreItemDto } from './get-bookstore-list-response.dto';

/**
 * 分頁資訊 DTO
 */
export class PaginationInfoDto {
  /**
   * 資料總筆數
   */
  @ApiProperty({
    example: 50,
    description: '資料總筆數',
    type: Number,
  })
  total: number;

  /**
   * 當前頁碼
   */
  @ApiProperty({
    example: 1,
    description: '當前頁碼',
    type: Number,
  })
  page: number;

  /**
   * 每頁筆數
   */
  @ApiProperty({
    example: 20,
    description: '每頁筆數',
    type: Number,
  })
  limit: number;

  /**
   * 總頁數
   */
  @ApiProperty({
    example: 3,
    description: '總頁數',
    type: Number,
  })
  totalPages: number;
}

/**
 * 後台管理員查詢書本商店清單的響應 DTO
 * - data: 書本商店清單（BookstoreItemDto 陣列）
 * - pagination: 分頁資訊
 */
export class GetAdminBookstoresResponseDto {
  /**
   * 書本商店清單（包含所有狀態的書籍，不論上下架）
   */
  @ApiProperty({
    description: '書本商店清單（包含所有狀態的書籍，不論上下架）',
    type: () => BookstoreItemDto,
    isArray: true,
    example: [
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
  })
  data: BookstoreItemDto[];

  /**
   * 分頁資訊
   */
  @ApiProperty({
    description: '分頁資訊',
    type: () => PaginationInfoDto,
    example: {
      total: 50,
      page: 1,
      limit: 20,
      totalPages: 3,
    },
  })
  pagination: PaginationInfoDto;
}
