import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, Min } from 'class-validator';

export enum IapReceiptStatus {
  REFUNDED = 'REFUNDED',
}

export class UpdateIapReceiptStatusParamDto {
  @ApiProperty({
    description: 'IAP 收據 ID（iap_receipts.id）',
    example: 123,
    type: Number,
  })
  @Type(() => Number)
  @IsInt({ message: 'id 必須是有效的整數' })
  @Min(1, { message: 'id 必須是大於 0 的整數' })
  id: number;
}

export class UpdateIapReceiptStatusDto {
  @ApiProperty({
    description: '欲更新的退款狀態，目前僅允許 REFUNDED',
    enum: IapReceiptStatus,
    example: IapReceiptStatus.REFUNDED,
  })
  @IsEnum(IapReceiptStatus, { message: 'status 僅允許 REFUNDED' })
  status: IapReceiptStatus;
}

export class UpdateIapReceiptStatusResponseDto {
  @ApiProperty({ example: true, description: '是否更新成功' })
  success: boolean;

  @ApiProperty({ example: 123, description: 'IAP 收據 ID' })
  id: number;

  @ApiProperty({ example: 456, description: '使用者 ID' })
  userId: number;

  @ApiProperty({ example: 'GOOGLE', description: 'IAP 平台' })
  platform: string;

  @ApiProperty({
    example: 'coins_100',
    description: 'IAP 商品 ID',
  })
  productId: string;

  @ApiProperty({
    example: 'GPA.3218-2019-1234567890',
    description: '交易 ID / 收據 ID',
  })
  transactionId: string;

  @ApiProperty({ example: 110, description: '本筆交易金幣數' })
  coins: number;

  @ApiProperty({
    enum: IapReceiptStatus,
    example: IapReceiptStatus.REFUNDED,
    description: '更新後的收據狀態',
  })
  status: IapReceiptStatus;

  @ApiProperty({
    example: '2026-05-15T10:30:00.000Z',
    description: '收據建立時間',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2026-05-25T12:34:56.000Z',
    description: '退款標記完成時間',
  })
  markedAt: string;
}
