import { ApiProperty } from '@nestjs/swagger';

export class AdminCoinPackDto {
  @ApiProperty({ description: '金幣方案 ID', example: 1 })
  id: number;

  @ApiProperty({ description: '平台類型', example: 'GOOGLE' })
  platform: string;

  @ApiProperty({ description: '商品 ID', example: 'coins_100' })
  product_id: string;

  @ApiProperty({ description: '金幣方案名稱', example: '100 金幣' })
  name: string;

  @ApiProperty({ description: '基礎金幣數量', example: 100 })
  amount: number;

  @ApiProperty({ description: '贈送金幣數量', example: 10 })
  bonus_amount: number;

  @ApiProperty({ description: '價格', example: 99 })
  price: number;

  @ApiProperty({ description: '幣別', example: 'TWD' })
  currency: string;

  @ApiProperty({ description: '是否啟用', example: true })
  is_active: boolean;

  @ApiProperty({ description: '排序權重', example: 1 })
  sort_order: number;

  @ApiProperty({ description: '建立時間', example: '2026-05-15T10:30:00.000Z' })
  created_at: Date;

  @ApiProperty({ description: '更新時間', example: '2026-05-15T12:34:56.000Z' })
  updated_at: Date;
}

export class GetAdminCoinPacksResponseDto {
  @ApiProperty({ description: '請求是否成功', example: true })
  success: boolean;

  @ApiProperty({ type: [AdminCoinPackDto], description: '金幣方案列表' })
  data: AdminCoinPackDto[];

  @ApiProperty({ description: '總筆數', example: 42 })
  total: number;

  @ApiProperty({ description: '目前頁碼', example: 1 })
  page: number;

  @ApiProperty({ description: '每頁筆數', example: 20 })
  limit: number;
}
