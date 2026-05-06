import { Injectable } from '@nestjs/common';
import { EngineRegistry } from '../../engine-commons';
import { Component } from './component';

@Injectable()
export class EngineEntitiesComponentsRegistry extends EngineRegistry<
  string,
  Component
> {}
