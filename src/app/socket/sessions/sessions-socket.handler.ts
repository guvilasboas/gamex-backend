import { Inject, Injectable } from '@nestjs/common';
import { AuthService, AuthToken } from '../../../domain/auth';
import { Server, Socket } from 'socket.io';
import {
  EngineSessionsManager,
  SessionAction,
} from '../../../lib/engine/engine-sessions';
import { EngineStoreState } from '../../../lib/engine/engine-store/engine-store.state';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ENGINE_STORE_UPDATED_EVENT,
  type EngineStorePatch,
} from '../../../lib/engine/engine-store';
import { OnRender } from '../../../lib/engine';

const DISCONNECT_GRACE_MS = 3_000;
const GRANCE_LOOP_PERIOD = 1;

@Injectable()
export class SessionsSocketHandler {
  server: Server;

  private acc = 0;

  /**
   * Map to track active socket connections for each user.
   *
   * The key is the user ID, and the value is a set of socket IDs associated with that user.
   *
   * @type {Map<string, Set<string>>}
   */
  private readonly activeConnections: Map<string, Set<string>> = new Map();

  /**
   * Map to track pending disconnect timers for each user.
   *
   * When a user disconnects, a timer is set to allow for a grace period before considering
   * the user fully disconnected.
   *
   * The key is the user ID, and the value is the timer instance returned by setTimeout.
   * If the user reconnects within the grace period, the timer is cleared.
   *
   * @type {Map<string, NodeJS.Timeout>}
   */
  private readonly disconnectTimers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Queue to store pending engine store patches that need to be sent to clients.
   *
   * This queue can be used to batch multiple patches together before emitting them to clients,
   * reducing the number of individual messages sent over the WebSocket connection.
   *
   * @type {EngineStorePatch[]}
   * @private
   */
  private readonly patches: EngineStorePatch[] = [];

  constructor(
    @Inject(EngineSessionsManager)
    private readonly sessionsManager: EngineSessionsManager,
    @Inject(EngineStoreState)
    private readonly storeState: EngineStoreState,
    @Inject(AuthService)
    private readonly authService: AuthService,
  ) {}

  /**
   * Initialize the WebSocket server and set up any necessary middleware or event listeners.
   *
   * This method is called after the WebSocket server has been initialized. It can be used to set up
   * middleware for authentication, logging, or any other necessary setup before handling connections.
   *
   * @param {Server} server The Socket.IO server instance that has been initialized.
   * @returns {void}
   */
  onServerInit(server: Server) {
    this.server = server;
  }

  /**
   * Handle the socket handshake process to authenticate the user.
   *
   * This method extracts the authentication token from the socket handshake,
   * verifies it using the AuthService, and attaches the session information to the socket's data.
   *
   * @param {Socket} client The socket client attempting to connect.
   * @returns {void}
   * @throws {Error} Throws an error if authentication fails, which will prevent the connection from being established.
   */
  onSocketHandShake(client: Socket) {
    const token = this.getSocketToken(client);

    if (!token) {
      throw new Error('Unauthorized');
    }

    const session = this.authService.verifyToken(token);
    client.data.session = session;
  }

  /**
   * Handle a new socket connection.
   *
   * This method is called when a client successfully connects to the WebSocket server.
   * It manages the active connections for the user and handles any pending disconnect timers.
   *
   * @param {Socket} client The socket client that has connected.
   * @returns {void}
   */
  onSocketConnect(client: Socket) {
    const session = this.getSocketSession(client);
    const socketId = client.id;
    const userId = session.id;

    const pending = this.disconnectTimers.get(userId);
    if (pending !== undefined) {
      clearTimeout(pending);
      this.disconnectTimers.delete(userId);
    }

    const connections = this.activeConnections.get(userId) ?? new Set<string>();
    const wasOffline = connections.size === 0;

    connections.add(socketId);
    this.activeConnections.set(userId, connections);

    if (!wasOffline) {
      return;
    }

    this.sessionsManager.connect(session);

    client.emit('session:init', this.storeState.getSnapshot());
  }

  /**
   * Handle a socket disconnection.
   *
   * This method is called when a client disconnects from the WebSocket server.
   * It manages the active connections for the user and sets a timer to handle potential reconnections within a grace period.
   *
   * @param {Socket} client The socket client that has disconnected.
   * @returns {void}
   */
  onSocketDisconnect(client: Socket) {
    const session = this.getSocketSession(client);
    const socketId = client.id;
    const userId = session.id;

    const connections = this.activeConnections.get(userId);
    connections?.delete(socketId);

    if (connections && connections.size > 0) {
      return;
    }

    this.activeConnections.delete(userId);

    const timer = setTimeout(() => {
      this.disconnectTimers.delete(userId);

      if (this.activeConnections.has(userId)) {
        return;
      }

      this.sessionsManager.disconnect(userId);
    }, DISCONNECT_GRACE_MS);

    this.disconnectTimers.set(userId, timer);
  }

  /**
   * Handle a session action from the client.
   *
   * This method is called when a client sends an action related to their session.
   * It retrieves the session information from the socket and pushes the action to the session manager.
   *
   * @param {Socket} client The socket client sending the action.
   * @param {SessionAction} action The action being sent by the client.
   * @returns {void}
   */
  onSessionAction(client: Socket, action: SessionAction) {
    const session = this.getSocketSession(client);
    this.sessionsManager.pushAction(session.id, action);
  }

  /**
   * Handle updates to the engine store and broadcast them to all connected clients.
   *
   * This method listens for updates to the engine store and emits a 'session:patch' event to all connected clients with the updated patch information.
   *
   * @param {EngineStorePatch} patch The patch information representing the update to the engine store.
   * @returns {void}
   */
  @OnEvent(ENGINE_STORE_UPDATED_EVENT)
  onStoreUpdate(patch: EngineStorePatch) {
    this.patches.push(patch);
  }

  @OnRender()
  onStep() {
    if (this.patches.length === 0 || this.acc < GRANCE_LOOP_PERIOD) {
      this.acc += 1;
      return;
    }

    this.acc = 0;

    const patches = this.patches.splice(0, this.patches.length);

    this.server.emit('session:patch', patches);
  }

  /**
   * Extract the authentication token from the socket handshake.
   *
   * This method checks both the `auth` field and the `Authorization` header for a valid token.
   *
   * @param {Socket} client The socket client from which to extract the token.
   * @returns {string | undefined} The extracted token, or undefined if no valid token is found.
   */
  private getSocketToken(client: Socket): string | undefined {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.length > 0) {
      return authToken;
    }

    const authorization = client.handshake.headers.authorization;
    if (typeof authorization !== 'string') {
      return undefined;
    }

    const [type, token] = authorization.split(' ');
    return type === 'Bearer' ? token : undefined;
  }

  /**
   * Retrieve the authenticated session information from the socket's data.
   *
   * This method checks if the session information is present in the socket's data and returns it.
   * If no session information is found, it throws an error indicating that the user is unauthorized.
   *
   * @param {Socket} client The socket client from which to retrieve the session information.
   * @returns {AuthToken} The authenticated session information associated with the socket.
   * @throws {Error} Throws an error if no session information is found, indicating that the user is unauthorized.
   */
  private getSocketSession(client: Socket): AuthToken {
    const session = client.data.session;

    if (!session) {
      throw new Error('Unauthorized');
    }

    return session;
  }
}
