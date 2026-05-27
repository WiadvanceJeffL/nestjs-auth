import { ApiProperty } from '@nestjs/swagger';

export class ReadBookResponseDto {
  @ApiProperty({ description: '請求是否成功', example: true })
  success: boolean;

  @ApiProperty({ description: '閱讀流水帳 ID', example: '123456789' })
  readLogId: string;

  @ApiProperty({ description: '書籍 ID', example: 1 })
  bookId: number;

  @ApiProperty({ description: '是否為該使用者首次閱讀此書', example: true })
  isFirstRead: boolean;

  @ApiProperty({ description: '更新後的閱讀總次數', example: 128 })
  total_reads: number;

  @ApiProperty({ description: '更新後的不重複閱讀人數', example: 42 })
  unique_readers: number;

  @ApiProperty({ description: '閱讀時間', example: '2026-05-27T10:30:00.000Z' })
  readAt: Date;
}
