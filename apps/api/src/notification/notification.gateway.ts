import {
  WebSocketGateway, WebSocketServer,
  OnGatewayConnection, OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

/**
 * 실시간 매칭/친구 이벤트 게이트웨이.
 *
 * 클라이언트 연결 시 auth.token에 JWT를 보내면,
 * 유저별 room(`user:${userId}`)에 자동 join.
 *
 * emit 헬퍼는 MatchingService / FriendsService에서 호출.
 */
@WebSocketGateway({
  cors: { origin: true, credentials: true },
  namespace: '/',
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(NotificationGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    const token =
      (client.handshake.auth?.token as string | undefined) ||
      (client.handshake.query?.token as string | undefined);

    if (!token) {
      client.emit('unauthorized', { reason: 'no_token' });
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string; kakaoId: string }>(
        token,
        { secret: this.config.get<string>('JWT_SECRET') },
      );
      const room = `user:${payload.sub}`;
      await client.join(room);
      client.data.userId = payload.sub;
      this.logger.log(`connected ${client.id} → ${room}`);
    } catch (err: any) {
      this.logger.warn(`JWT 검증 실패 (${client.id}): ${err?.message ?? 'unknown'}`);
      client.emit('unauthorized', { reason: 'invalid_token' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`disconnected ${client.id} (userId=${client.data.userId ?? '?'})`);
  }

  /** 특정 유저에게 이벤트 전송 */
  emitToUser(userId: string, event: string, payload: unknown) {
    this.server.to(`user:${userId}`).emit(event, payload);
  }
}
