import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ChatService } from './chat.service';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private chatService: ChatService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // CONNECTION HANDLING
  // ═══════════════════════════════════════════════════════════════════════════

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`Client ${client.id} hat keinen Token gesendet`);
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      });

      client.data.userId = payload.sub;
      client.data.type = payload.type;
      client.data.companyId = payload.companyId;

      this.logger.log(
        `Client verbunden: ${client.id} (${payload.type}: ${payload.sub})`,
      );
    } catch (error) {
      this.logger.warn(
        `Client ${client.id} Authentifizierung fehlgeschlagen: ${error.message}`,
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client getrennt: ${client.id}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // JOIN / LEAVE CHAT ROOM
  // ═══════════════════════════════════════════════════════════════════════════

  @SubscribeMessage('join_chat')
  async handleJoinChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: string },
  ) {
    try {
      const { userId, type } = client.data;
      const chat = await this.chatService.getChatById(data.chatId);

      // Verify access based on user type
      if (type === 'user' && chat.userId !== userId) {
        client.emit('error', { message: 'Kein Zugriff auf diesen Chat' });
        return;
      }

      if (type === 'company') {
        // companyId from JWT matches chat.companyId
        if (client.data.companyId !== chat.companyId) {
          client.emit('error', { message: 'Kein Zugriff auf diesen Chat' });
          return;
        }
      }

      const room = `chat_${data.chatId}`;
      client.join(room);

      client.emit('joined_chat', { chatId: data.chatId, room });
      this.logger.log(`Client ${client.id} ist Raum ${room} beigetreten`);
    } catch (error) {
      client.emit('error', { message: error.message || 'Chat beitreten fehlgeschlagen' });
    }
  }

  @SubscribeMessage('leave_chat')
  async handleLeaveChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: string },
  ) {
    const room = `chat_${data.chatId}`;
    client.leave(room);

    client.emit('left_chat', { chatId: data.chatId });
    this.logger.log(`Client ${client.id} hat Raum ${room} verlassen`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SEND MESSAGE
  // ═══════════════════════════════════════════════════════════════════════════

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: string; content: string; messageType?: string },
  ) {
    try {
      const { userId, type } = client.data;

      const message = await this.chatService.sendMessage(
        data.chatId,
        type,
        userId,
        data.content,
        data.messageType || 'TEXT',
      );

      const room = `chat_${data.chatId}`;
      this.server.to(room).emit('new_message', message);
    } catch (error) {
      client.emit('error', { message: error.message || 'Nachricht senden fehlgeschlagen' });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TYPING INDICATOR
  // ═══════════════════════════════════════════════════════════════════════════

  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: string },
  ) {
    const room = `chat_${data.chatId}`;
    client.to(room).emit('user_typing', {
      chatId: data.chatId,
      userId: client.data.userId,
      userType: client.data.type,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MARK AS READ
  // ═══════════════════════════════════════════════════════════════════════════

  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: string },
  ) {
    try {
      const { userId, type } = client.data;

      await this.chatService.markAsRead(data.chatId, userId, type);

      const room = `chat_${data.chatId}`;
      client.to(room).emit('messages_read', {
        chatId: data.chatId,
        userId: client.data.userId,
        userType: client.data.type,
      });
    } catch (error) {
      client.emit('error', { message: error.message || 'Als gelesen markieren fehlgeschlagen' });
    }
  }
}
