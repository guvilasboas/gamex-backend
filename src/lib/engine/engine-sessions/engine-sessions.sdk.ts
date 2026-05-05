import { Container } from '../../../common/container';
import { EngineSessionsManager } from './engine-sessions.manager';

export function SetSessionData<T = unknown>(
  sessionId: string,
  key: string,
  value: T,
) {
  const engineSessionsManager = Container.get<EngineSessionsManager>(
    EngineSessionsManager,
  );

  engineSessionsManager.set(sessionId, key, value);
}

export function GetSessionData<T = Record<string, any>>(
  sessionId: string,
  key: string,
): T | undefined {
  const engineSessionsManager = Container.get<EngineSessionsManager>(
    EngineSessionsManager,
  );

  return engineSessionsManager.get(sessionId)?.[key] as T | undefined;
}

export function DeleteSessionData(sessionId: string, key: string) {
  const engineSessionsManager = Container.get<EngineSessionsManager>(
    EngineSessionsManager,
  );

  engineSessionsManager.delete(sessionId, key);
}
