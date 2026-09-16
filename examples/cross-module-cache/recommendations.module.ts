import { Module } from '@nestjs/common';
import { CatalogModule } from './catalog.module.js';
import { RecommendationsService } from './recommendations.service.js';

@Module({
  imports: [CatalogModule],
  providers: [RecommendationsService],
  exports: [RecommendationsService],
})
export class RecommendationsModule {}
