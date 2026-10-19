import { io, type Socket } from 'socket.io-client';
import type { Ack } from '../types';

export function createRealtimeSocket(baseUrl: string, token: string): Socket {
  return io(`${baseUrl.replace(/\/$/, '')}/realtime`, {
    transports: ['websocket'],
    auth: { token },
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 4000,
  });
}

export function waitForSocketReady(socket: Socket, timeoutMs = 12_000): Promise<void> {
  if (socket.connected) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error('실시간 서버 연결 시간이 초과되었습니다.'));
    }, timeoutMs);
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = (payload: any) => {
      cleanup();
      reject(new Error(payload?.message || '실시간 서버 인증에 실패했습니다.'));
    };
    const onConnectError = (err: Error) => {
      cleanup();
      reject(err);
    };
    const cleanup = () => {
      window.clearTimeout(timer);
      socket.off('connection:ready', onReady);
      socket.off('connection:error', onError);
      socket.off('connect_error', onConnectError);
    };
    socket.once('connection:ready', onReady);
    socket.once('connection:error', onError);
    socket.once('connect_error', onConnectError);
    socket.connect();
  });
}

export function emitAck<T = Record<string, never>>(
  socket: Socket,
  event: string,
  payload: unknown,
  timeoutMs = 15_000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    socket.timeout(timeoutMs).emit(event, payload, (timeoutError: Error | null, response: Ack<T>) => {
      if (timeoutError) {
        reject(new Error(`${event} 응답 시간이 초과되었습니다.`));
        return;
      }
      if (!response || response.ok !== true) {
        const message = response && response.ok === false ? response.error.message : `${event} 요청에 실패했습니다.`;
        reject(new Error(message));
        return;
      }
      resolve(response.data);
    });
  });
}
