import { ApiProperty } from '@nestjs/swagger';

export class BookAnalyticsItemDto {
  @ApiProperty({ description: '書籍 ID', example: 1 })
  id: number;

  @ApiProperty({ description: '書名', example: '小鎮失蹤手冊' })
  title: string;

  @ApiProperty({ description: '作者', example: '夏佩爾&烏奴奴', required: false })
  author: string | null;

  @ApiProperty({ description: '閱讀總次數', example: 128 })
  total_reads: number;

  @ApiProperty({ description: '不重複閱讀人數', example: 42 })
  unique_readers: number;

  @ApiProperty({ description: '建立時間', example: '2026-05-15T10:30:00.000Z' })
  createdAt: Date;

  @ApiProperty({ description: '更新時間', example: '2026-05-15T12:34:56.000Z' })
  updatedAt: Date;
}

export class BooksAnalyticsPaginationDto {
  @ApiProperty({ description: '總筆數', example: 50 })
  total: number;

  @ApiProperty({ description: '目前頁碼', example: 1 })
  page: number;

  @ApiProperty({ description: '每頁筆數', example: 20 })
  limit: number;

  @ApiProperty({ description: '總頁數', example: 3 })
  totalPages: number;
}

export class BooksAnalyticsResponseDto {
  @ApiProperty({ type: [BookAnalyticsItemDto], description: '書籍統計清單' })
  data: BookAnalyticsItemDto[];

  @ApiProperty({ type: BooksAnalyticsPaginationDto, description: '分頁資訊' })
  pagination: BooksAnalyticsPaginationDto;
}
