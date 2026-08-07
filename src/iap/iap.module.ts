import { Module } from '@nestjs/common';
import { CoinPacksController } from './coin-packs.controller';
import { CoinPacksService } from './coin-packs.service';
import { IapController } from './iap.controller'; // 導入 IapController
import { IapService } from './iap.service'; // 導入 IapService
import { IapQueryController } from './iap-query.controller';
import { IapQueryService } from './iap-query.service';
import { PrismaService } from '../prisma.service';
import { UsersModule } from '../users/users.module'; // 導入 UsersModule

@Module({
    imports: [UsersModule], // 導入 UsersModule
    controllers: [CoinPacksController, IapController, IapQueryController], // 將 IapController 添加到 controllers 陣列
    providers: [CoinPacksService, IapService, IapQueryService, PrismaService], // 將 IapService 添加到 providers 陣列
    exports: [CoinPacksService],
})
export class IapModule {}
