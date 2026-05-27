import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class BooksAnalyticsQueryDto {
  @IsOptional()
  @IsInt({ message: 'page 必須是整數' })
  @Min(1, { message: 'page 必須大於等於 1' })
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt({ message: 'limit 必須是整數' })
  @Min(1, { message: 'limit 必須大於等於 1' })
  @Type(() => Number)
  limit?: number = 20;
}
