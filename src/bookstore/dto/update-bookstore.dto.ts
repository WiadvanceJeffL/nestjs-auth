import { PartialType, PickType } from '@nestjs/swagger';
import { CreateBookstoreDto } from './create-bookstore.dto';

export class UpdateBookstoreDto extends PartialType(
  PickType(CreateBookstoreDto, ['priceCoins', 'currency', 'isActive'] as const),
) {
  constructor() {
    super();
    delete this.currency;
    delete this.isActive;
  }
}
