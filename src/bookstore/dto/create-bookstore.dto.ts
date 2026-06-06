import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBookstoreDto {
  @ApiProperty({
    description: '要綁定到書本商店的書籍 ID，對應 StoryLists.id',
    example: 1,
    type: Number,
  })
  @IsNotEmpty({ message: 'bookId 為必填' })
  @Type(() => Number)
  @IsInt({ message: 'bookId 必須是整數' })
  @Min(1, { message: 'bookId 必須大於 0' })
  bookId: number;

  @ApiProperty({
    description: '金幣價格，必須為大於等於 0 的整數',
    example: 100,
    type: Number,
  })
  @IsNotEmpty({ message: 'priceCoins 為必填' })
  @Type(() => Number)
  @IsInt({ message: 'priceCoins 必須是整數' })
  @Min(0, { message: 'priceCoins 必須大於等於 0' })
  priceCoins: number;

  @ApiProperty({
    description: '貨幣類型，目前僅支援 COIN',
    enum: ['COIN'],
    example: 'COIN',
    default: 'COIN',
    required: false,
  })
  @IsOptional()
  @IsIn(['COIN'], { message: 'currency 只能為 COIN' })
  currency?: string = 'COIN';

  @ApiProperty({
    description: '是否上架啟用',
    example: true,
    default: true,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean({ message: 'isActive 必須是布林值' })
  isActive?: boolean = true;

  @ApiProperty({
    description: '初始銷售量，必須為大於等於 0 的整數',
    example: 0,
    default: 0,
    required: false,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'soldCount 必須是整數' })
  @Min(0, { message: 'soldCount 必須大於等於 0' })
  soldCount?: number = 0;
}
