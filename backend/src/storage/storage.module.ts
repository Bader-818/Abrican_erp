import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';

@Global()
@Module({
  providers: [
    {
      provide: 'IStorageService',
      useClass: StorageService,
    },
    StorageService,
  ],
  exports: ['IStorageService', StorageService],
})
export class StorageModule {}
