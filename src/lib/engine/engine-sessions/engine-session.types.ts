export type SessionAction = {
  type: string;
  [key: string]: unknown;
};

export type Session = {
  id: string;
  actions: SessionAction[];
  [key: string]: unknown;
};

export type DispatchedSessionAction<T extends SessionAction = SessionAction> = {
  sessionId: string;
  action: T;
};

export const createSession = (data: Partial<Session>): Session => {
  if (!data.id) {
    throw new Error('Session must have an ID');
  }

  return {
    id: data.id,
    actions: data?.actions ?? [],
    ...data,
  };
};

export const createActionEvent = (actionType: string) => {
  return `session.action.${actionType}`;
};
