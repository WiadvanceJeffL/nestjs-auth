import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * @description 管理員更新金幣儲值包的請求 DTO。
 * product_id 是不可變的 SKU，因此不在此 DTO 中公開；商品以 platform + product_id 唯一識別。
 */
export class UpdateCoinPackAdminRequestDto {
  @ApiPropertyOptional({ description: '商品顯示名稱', example: '90 金幣 + 5 Bonus', maxLength: 100 })
  @IsOptional()
  @IsString({ message: 'name 必須是字串' })
  @IsNotEmpty({ message: 'name 不能為空' })
  @MaxLength(100, { message: 'name 最多 100 個字元' })
  name?: string;

  @ApiPropertyOptional({
    description: '是否上架 (1: 上架, 0: 下架)',
    example: 1,
    enum: [0, 1],
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'is_active 必須為整數' })
  @IsEnum([0, 1], { message: 'is_active 只能為 0 或 1' })
  is_active?: number;

  @ApiPropertyOptional({ description: '顯示排序權重', example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'sort_order 必須為整數' })
  sort_order?: number;

  @ApiPropertyOptional({ description: '商品價格；已有交易紀錄時不可修改', example: 90.99 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowInfinity: false, allowNaN: false }, { message: 'price 必須為有效的數字' })
  @Min(0.01, { message: 'price 必須大於 0' })
  price?: number;

  @ApiPropertyOptional({
    description: '幣別；已有交易紀錄時不可修改',
    enum: ['TWD', 'USD', 'JPY'],
    example: 'TWD',
  })
  @IsOptional()
  @IsString({ message: 'currency 必須是字串' })
  @IsEnum(['TWD', 'USD', 'JPY'], { message: 'currency 只能為 TWD、USD 或 JPY' })
  currency?: string;

  @ApiPropertyOptional({ description: '基礎金幣數量；已有交易紀錄時不可修改', example: 90 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'amount 必須為整數' })
  @Min(10, { message: 'amount 最少為 10' })
  amount?: number;

  @ApiPropertyOptional({ description: '贈送金幣數量；已有交易紀錄時不可修改', example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'bonus_amount 必須為整數' })
  @Min(0, { message: 'bonus_amount 最少為 0' })
  bonus_amount?: number;

  @ApiPropertyOptional({
    description: '所屬平台；與 product_id 組成唯一鍵，且已有交易紀錄時不可修改',
    enum: ['GOOGLE', 'APPLE'],
    example: 'GOOGLE',
  })
  @IsOptional()
  @IsString({ message: 'platform 必須是字串' })
  @IsEnum(['GOOGLE', 'APPLE'], { message: 'platform 只能為 GOOGLE 或 APPLE' })
  platform?: 'GOOGLE' | 'APPLE';
}
