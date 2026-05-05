import { Server, Socket } from 'socket.io';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Inject } from '@nestjs/common';
import { SessionsSocketHandler } from './sessions-socket.handler';
import { type SessionAction } from '../../../lib/engine/engine-sessions';

@WebSocketGateway({ cors: { origin: '*' } })
export class SessionsSocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    @Inject(SessionsSocketHandler)
    private readonly sessionsSocketHandler: SessionsSocketHandler,
  ) {}

  /**
   * Authenticate incoming socket connections using the `authenticateSocket` helper.
   * This will ensure that only authenticated users can establish a WebSocket connection.
   *
   * @param {Server} server The Socket.IO server instance to apply the middleware to.
   * @returns {void}
   */
  afterInit(server: Server): void {
    this.sessionsSocketHandler.onServerInit(server);

    server.use(async (client, next) => {
      try {
        await this.sessionsSocketHandler.onSocketHandShake(client);
        next();
      } catch (error) {
        next(error as Error);
      }
    });
  }

  /**
   * Handle new socket connections by delegating to the `SessionsSocketHandler`.
   *
   * @param {Socket} client The connected socket client.
   * @returns {void}
   */
  handleConnection(client: Socket): void {
    this.sessionsSocketHandler.onSocketConnect(client);
  }

  /**
   * Handle socket disconnections by delegating to the `SessionsSocketHandler`.
   *
   * @param {Socket} client The disconnected socket client.
   * @returns {void}
   */
  handleDisconnect(client: Socket): void {
    this.sessionsSocketHandler.onSocketDisconnect(client);
  }

  /**
   * Handle incoming session action messages from the client and delegate to the `SessionsSocketHandler`.
   *
   * @param {Socket} client The socket client sending the message.
   * @param {string} action The action type sent by the client.
   * @returns {void}
   */
  @SubscribeMessage('session:action')
  handleSessionInput(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    action: SessionAction,
  ): void {
    this.sessionsSocketHandler.onSessionAction(client, action);
  }
}
