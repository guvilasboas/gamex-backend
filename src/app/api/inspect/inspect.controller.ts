import { Controller, Get, Inject } from '@nestjs/common';
import { InspectHandler } from './inspect.handler';
import { ApiOperation } from '@nestjs/swagger/dist/decorators/api-operation.decorator';

@Controller()
export class InspectController {
  constructor(
    @Inject(InspectHandler)
    private readonly inspectHandler: InspectHandler,
  ) {}

  @Get('debug')
  @ApiOperation({ operationId: 'getDebugInfo' })
  getDebugInfo() {
    return this.inspectHandler.getDebugInfo();
  }
}
