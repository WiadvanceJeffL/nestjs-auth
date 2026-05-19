import { ApiProperty } from '@nestjs/swagger';

/**
 * StoryDto
 * - 對應 Prisma 中的 story 物件欄位
 * - 屬性名稱保留與資料庫一致（例如 main_menu_name）
 */
export class StoryDto {
  /** 故事 ID */
  @ApiProperty({ example: 1, description: '故事 ID' })
  id: number;

  /** 主選單名稱（資料庫欄位：main_menu_name） */
  @ApiProperty({ example: '小鎮失蹤手冊', description: '主選單名稱（原欄位 main_menu_name）', nullable: true })
  main_menu_name: string | null;

  /** 作者名稱 */
  @ApiProperty({ example: '夏佩爾&烏奴奴', description: '作者名稱', nullable: true })
  author: string | null;

  /** 主選單圖片檔名 */
  @ApiProperty({ example: 'mainMenuImage-1709644166964.jpeg', description: '主選單圖片檔名', nullable: true })
  main_menu_image: string | null;
}

/**
 * BookstoreItemDto
 * - 對應 `bookStoreItem` 的回傳資料結構，供前端直接使用與 Swagger 文件呈現
 * - 每個屬性加上範例與說明，方便前端與 API 文件閱讀
 */
export class BookstoreItemDto {
  /** 書城項目 ID */
  @ApiProperty({ example: 1, description: '書城項目 ID' })
  id: number;

  /** 對應的 storyListId（資料庫欄位） */
  @ApiProperty({ example: 1, description: '對應的 storyListId' })
  storyListId: number;

  /** 價格（以 coins 計） */
  @ApiProperty({ example: 100, description: '價格（以 coin 計）' })
  priceCoins: number;

  /** 幣種 */
  @ApiProperty({ example: 'COIN', description: '幣種' })
  currency: string;

  /** 是否上架 */
  @ApiProperty({ example: true, description: '是否上架' })
  isActive: boolean;

  /** 已售出數量 */
  @ApiProperty({ example: 0, description: '已售出數量' })
  soldCount: number;

  /** 建立時間（ISO 字串） */
  @ApiProperty({ example: '2025-12-18T15:28:17.000Z', description: '建立時間' })
  createdAt: Date;

  /** 更新時間（ISO 字串） */
  @ApiProperty({ example: '2025-12-18T15:28:17.000Z', description: '更新時間' })
  updatedAt: Date;

  /** 關聯的 story 資料 */
  @ApiProperty({ type: () => StoryDto, description: '關聯的 story 資料' })
  story: StoryDto;
}

/**
 * GetBookstoreListResponseDto
 * - 回傳為 BookstoreItemDto 的陣列
 * - 前端可以直接使用此型別來描述 API 回傳
 */
export type GetBookstoreListResponseDto = BookstoreItemDto[];
