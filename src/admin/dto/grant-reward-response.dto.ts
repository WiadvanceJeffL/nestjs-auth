import { ApiProperty } from '@nestjs/swagger';

export class GrantRewardResponseDto {
  @ApiProperty({
    description: '是否發放成功',
    example: true,
    type: Boolean,
  })
  success: boolean;

  @ApiProperty({
    description: '目標使用者 ID',
    example: 123,
    type: Number,
  })
  targetUserId: number;

  @ApiProperty({
    description: '調整的金幣額度（正數為增加、負數為扣除）',
    example: 100,
    type: Number,
  })
  amount: number;

  @ApiProperty({
    description: '調整後使用者的新金幣餘額（可為負數）',
    example: 250,
    type: Number,
  })
  newBalance: number;

  @ApiProperty({
    description: '管理員填寫的調整原因',
    example: '禮物卡兌換',
    type: String,
  })
  reason: string;

  @ApiProperty({
    description: '調整時間戳記',
    example: '2026-05-15T12:34:56.000Z',
    type: String,
  })
  grantedAt: string;
}
