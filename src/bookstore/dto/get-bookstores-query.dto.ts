import { IsInt, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 後台管理員查詢書本商店清單的查詢參數 DTO
 * - page: 可選，分頁頁碼（預設 1）
 * - limit: 可選，每頁筆數（預設 20，最多 100）
 */
export class GetBookstoresQueryDto {
  /**
   * 頁碼（可選，預設 1）
   */
  @ApiProperty({
    example: 1,
    description: '頁碼（可選，預設 1）',
    type: Number,
    required: false,
  })
  @IsOptional()
  @IsInt({ message: 'page 必須是整數' })
  @Min(1, { message: 'page 最小為 1' })
  @Type(() => Number)
  page?: number = 1;

  /**
   * 每頁筆數（可選，預設 20，最多 100）
   */
  @ApiProperty({
    example: 20,
    description: '每頁筆數（可選，預設 20，最多 100）',
    type: Number,
    required: false,
  })
  @IsOptional()
  @IsInt({ message: 'limit 必須是整數' })
  @Min(1, { message: 'limit 最小為 1' })
  @Max(100, { message: 'limit 最多為 100' })
  @Type(() => Number)
  limit?: number = 20;
}
