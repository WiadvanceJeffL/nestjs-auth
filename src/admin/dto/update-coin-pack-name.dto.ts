import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class UpdateCoinPackNameDto {
  @ApiProperty({
    description: '金幣方案名稱（必須是字串，不能為空，最多 100 個字元）',
    example: 'Premium Pack - 1000 Coins',
    type: String,
    maxLength: 100,
  })
  @IsString({ message: 'name 必須是字串' })
  @IsNotEmpty({ message: 'name 不能為空' })
  @MaxLength(100, { message: 'name 最多 100 個字元' })
  name: string;
}
