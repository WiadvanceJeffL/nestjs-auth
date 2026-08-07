import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsNumber,
  Min,
  IsOptional,
  IsEnum,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * @description 建立金幣儲值包的請求 DTO
 */
export class CreateCoinPackRequestDto {
  /**
   * @description 平台類型 (GOOGLE 或 APPLE)
   * @example GOOGLE
   */
  @ApiProperty({
    description: '平台類型',
    enum: ['GOOGLE', 'APPLE'],
    example: 'GOOGLE',
  })
  @IsNotEmpty({ message: '平台類型不能為空' })
  @IsEnum(['GOOGLE', 'APPLE'], { message: '平台類型只能為 GOOGLE 或 APPLE' })
  @IsString({ message: '平台類型必須為字串' })
  @MinLength(2, { message: '平台類型長度不能少於 2 個字元' })
  @MaxLength(20, { message: '平台類型長度不能超過 20 個字元' })
  platform: 'GOOGLE' | 'APPLE';

  /**
   * @description 商品 ID (SKU)
   * @example test_item_001
   */
  @ApiProperty({
    description: '商品 ID (SKU)，同一平台內不可重複；不同平台可使用相同 SKU',
    example: 'test_item_001',
  })
  @IsNotEmpty({ message: '商品 ID 不能為空' })
  @IsString({ message: '商品 ID 必須為字串' })
  @MinLength(2, { message: '商品 ID 長度不能少於 2 個字元' })
  @MaxLength(100, { message: '商品 ID 長度不能超過 100 個字元' })
  product_id: string;

  /**
   * @description 商品名稱
   * @example 90 金幣 + 5 Bonus
   */
  @ApiProperty({
    description: '商品名稱，用於顯示給用戶',
    example: '90 金幣 + 5 Bonus',
  })
  @IsNotEmpty({ message: '商品名稱不能為空' })
  @IsString({ message: '商品名稱必須為字串' })
  @MinLength(2, { message: '商品名稱長度不能少於 2 個字元' })
  @MaxLength(100, { message: '商品名稱長度不能超過 100 個字元' })
  name: string;

  /**
   * @description 基礎金幣數量
   * @example 90
   */
  @ApiProperty({
    description: '基礎金幣數量，最少 10 枚',
    example: 90,
  })
  @IsNotEmpty({ message: '基礎金幣數量不能為空' })
  @Type(() => Number)
  @IsInt({ message: '基礎金幣數量必須為整數' })
  @Min(10, { message: '基礎金幣數量最少為 10 枚' })
  amount: number;

  /**
   * @description 贈送金幣數量 (可選，預設 0)
   * @example 5
   */
  @ApiProperty({
    description: '贈送金幣數量 (可選)，預設為 0',
    example: 5,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '贈送金幣數量必須為整數' })
  @Min(0, { message: '贈送金幣數量最少為 0 枚' })
  bonusAmount?: number = 0;

  /**
   * @description 商品價格
   * @example 90.99
   */
  @ApiProperty({
    description: '商品價格，必須大於 0',
    example: 90.99,
  })
  @IsNotEmpty({ message: '商品價格不能為空' })
  @Type(() => Number)
  @IsNumber({ allowInfinity: false, allowNaN: false }, { message: '商品價格必須為有效的數字' })
  @Min(0.01, { message: '商品價格必須大於 0' })
  price: number;

  /**
   * @description 幣別 (可選，預設 TWD)
   * @example TWD
   */
  @ApiProperty({
    description: '幣別，可選值為 TWD, USD, JPY (預設: TWD)',
    enum: ['TWD', 'USD', 'JPY'],
    example: 'TWD',
    required: false,
  })
  @IsOptional()
  @IsEnum(['TWD', 'USD', 'JPY'], { message: '幣別只能為 TWD, USD 或 JPY' })
  @IsString({ message: '幣別必須為字串' })
  currency?: string = 'TWD';

  /**
   * @description 是否上架 (可選，預設 1 表示上架)
   * @example 1
   */
  @ApiProperty({
    description: '是否上架 (1: 上架, 0: 下架，預設: 1)',
    example: 1,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'is_active 必須為整數' })
  @IsEnum([0, 1], { message: 'is_active 只能為 0 或 1' })
  is_active?: number = 1;
}
