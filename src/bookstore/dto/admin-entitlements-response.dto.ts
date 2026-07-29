import { ApiProperty } from '@nestjs/swagger';

/**
 * 用戶基本資訊 DTO
 * - 包含用戶的 ID、username、email
 */
export class UserBasicInfoDto {
  /** 用戶 ID */
  @ApiProperty({ example: 123, description: '用戶 ID' })
  id!: number;

  /** 用戶名稱 */
  @ApiProperty({ example: 'John Doe', description: '用戶名稱' })
  username!: string;

  /** 用戶電子郵件 */
  @ApiProperty({ example: 'john@example.com', description: '用戶電子郵件' })
  email!: string;
}

/**
 * 書籍基本資訊 DTO
 * - 用戶已購買書籍的詳細資訊
 */
export class BookBasicInfoDto {
  /** 故事 ID */
  @ApiProperty({ example: 1, description: '故事 ID' })
  id!: number;

  /** 書籍標題 */
  @ApiProperty({
    example: '小鎮失蹤手冊',
    description: '書籍標題（來源欄位：main_menu_title）',
  })
  title!: string;

  /** 作者名稱 */
  @ApiProperty({
    example: '夏佩爾&烏奴奴',
    description: '作者名稱',
  })
  author!: string;

  /** 封面圖片 */
  @ApiProperty({
    example: 'mainMenuImage-1709644166964.jpeg',
    description: '封面圖片 URL',
  })
  coverImage!: string;
}

/**
 * 用戶權益記錄 DTO
 * - 對應單個 entitlements 記錄（用戶已購買的一本書）
 */
export class EntitlementRecordDto {
  /** 書籍資訊 */
  @ApiProperty({ type: () => BookBasicInfoDto, description: '書籍資訊' })
  book!: BookBasicInfoDto;

  /** 購買日期 */
  @ApiProperty({
    example: '2026-02-20T10:30:00.000Z',
    description: '購買日期（ISO 8601 格式）',
  })
  purchasedAt!: Date;
}

/**
 * 分頁資訊 DTO
 * - 分頁的元數據
 */
export class PaginationDto {
  /** 總筆數 */
  @ApiProperty({ example: 25, description: '總筆數' })
  total!: number;

  /** 當前頁碼 */
  @ApiProperty({ example: 1, description: '當前頁碼' })
  page!: number;

  /** 每頁筆數 */
  @ApiProperty({ example: 20, description: '每頁筆數' })
  limit!: number;

  /** 總頁數 */
  @ApiProperty({ example: 2, description: '總頁數' })
  totalPages!: number;
}

/**
 * 管理後台查詢用戶權益列表的響應 DTO
 * - 包含用戶基本資訊、使用者已購買的書籍列表與分頁資訊
 */
export class AdminEntitlementsResponseDto {
  /** 用戶基本資訊（當用戶不存在時為 null） */
  @ApiProperty({ type: () => UserBasicInfoDto, description: '用戶基本資訊（當用戶不存在時為 null）', nullable: true })
  user!: UserBasicInfoDto | null;

  /** 用戶已購買的書籍列表 */
  @ApiProperty({
    type: () => [EntitlementRecordDto],
    description: '用戶已購買的書籍列表',
    isArray: true,
  })
  entitlements!: EntitlementRecordDto[];

  /** 分頁資訊 */
  @ApiProperty({ type: () => PaginationDto, description: '分頁資訊' })
  pagination!: PaginationDto;
}
