import { Module } from '@nestjs/common';
import { InspectHandler } from './inspect.handler';
import { InspectController } from './inspect.controller';

@Module({
  controllers: [InspectController],
  providers: [InspectHandler],
})
export class InspectModule {}
