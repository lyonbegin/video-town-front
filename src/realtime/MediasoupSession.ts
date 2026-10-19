import * as mediasoupClient from 'mediasoup-client';
import type { Socket } from 'socket.io-client';
import { emitAck } from './socket';
import type {
  ConsumerDescriptor,
  ProducerDescriptor,
  RemoteTile,
} from '../types';

type StatusCallback = (message: string) => void;
type RemoteCallback = (tiles: RemoteTile[]) => void;

interface RtcJoinResult {
  peerId: string;
  resumed: boolean;
  routerRtpCapabilities: any;
  existingProducers: ProducerDescriptor[];
}

interface TransportResult {
  transportOptions: any;
}

export class MediasoupSession {
  private device?: mediasoupClient.Device;
  private sendTransport: any;
  private recvTransport: any;
  private audioProducer: any;
  private videoProducer: any;
  private screenProducer: any;
  private consumers = new Map<string, any>();
  private consumerMeta = new Map<string, { producerId: string; tileKey: string }>();
  private remoteTiles = new Map<string, RemoteTile>();
  private consuming = new Set<string>();
  private pendingProducers = new Map<string, ProducerDescriptor>();
  private started = false;
  private disposed = false;
  private localStream?: MediaStream;

  constructor(
    private readonly socket: Socket,
    private readonly sessionId: string,
    private readonly onRemote: RemoteCallback,
    private readonly onStatus: StatusCallback,
  ) {
    this.bindServerEvents();
  }

  async start(localStream: MediaStream, resume = false) {
    if (this.started) return;
    this.started = true;
    this.localStream = localStream;
    this.onStatus('진료 미디어 연결 중…');

    try {
      const joined = await emitAck<RtcJoinResult>(this.socket, 'rtc:join', {
        sessionId: this.sessionId,
        resume,
      });

      const device = new mediasoupClient.Device();
      await device.load({ routerRtpCapabilities: joined.routerRtpCapabilities });
      this.device = device;

      await this.createRecvTransport();
      await this.flushPendingProducers();
      await this.createSendTransport();

      for (const producer of joined.existingProducers ?? []) {
        await this.consumeProducer(producer).catch((error) => {
          console.warn('기존 Producer 소비 실패', producer.producerId, error);
        });
      }

      await this.publishLocalMedia(localStream);

      // rtc:join 시점과 recv transport 준비 사이에 다른 참가자가 Producer를
      // 만들면 rtc:new-producer 이벤트가 먼저 도착할 수 있습니다. 이벤트 큐와
      // 서버의 현재 Producer 목록을 한 번 더 합쳐서 이 race condition을 제거합니다.
      await this.syncRemoteProducers();
      await this.flushPendingProducers();

      this.onStatus('연결됨');
    } catch (error) {
      this.started = false;
      throw error;
    }
  }

  isStarted() {
    return this.started;
  }

  async resumeSignaling(): Promise<boolean> {
    if (!this.started || !this.device) return false;
    const joined = await emitAck<RtcJoinResult>(this.socket, 'rtc:join', {
      sessionId: this.sessionId,
      resume: true,
    });
    for (const producer of joined.existingProducers ?? []) {
      await this.consumeProducer(producer).catch(() => undefined);
    }
    await this.syncRemoteProducers().catch(() => undefined);
    await this.flushPendingProducers().catch(() => undefined);
    return joined.resumed;
  }

  async setMicrophoneEnabled(enabled: boolean) {
    const track = this.localStream?.getAudioTracks()[0];
    if (track) track.enabled = enabled;
    if (!this.audioProducer) return;
    if (enabled) {
      this.audioProducer.resume();
      await emitAck(this.socket, 'rtc:resume-producer', {
        sessionId: this.sessionId,
        producerId: this.audioProducer.id,
      });
    } else {
      this.audioProducer.pause();
      await emitAck(this.socket, 'rtc:pause-producer', {
        sessionId: this.sessionId,
        producerId: this.audioProducer.id,
      });
    }
  }

  async setCameraEnabled(enabled: boolean) {
    const track = this.localStream?.getVideoTracks()[0];
    if (track) track.enabled = enabled;
    if (!this.videoProducer) return;
    if (enabled) {
      this.videoProducer.resume();
      await emitAck(this.socket, 'rtc:resume-producer', {
        sessionId: this.sessionId,
        producerId: this.videoProducer.id,
      });
    } else {
      this.videoProducer.pause();
      await emitAck(this.socket, 'rtc:pause-producer', {
        sessionId: this.sessionId,
        producerId: this.videoProducer.id,
      });
    }
  }

  async startScreenShare(): Promise<MediaStream> {
    if (!this.sendTransport) throw new Error('송신 Transport가 아직 준비되지 않았습니다.');
    if (this.screenProducer) throw new Error('이미 화면을 공유하고 있습니다.');
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    const track = stream.getVideoTracks()[0];
    if (!track) throw new Error('화면 공유 트랙을 가져오지 못했습니다.');

    const producer = await this.sendTransport.produce({
      track,
      appData: { source: 'screen' },
      encodings: [
        { rid: 'l', maxBitrate: 350_000, scaleResolutionDownBy: 2 },
        { rid: 'h', maxBitrate: 1_500_000 },
      ],
    });
    this.screenProducer = producer;
    track.addEventListener('ended', () => {
      void this.stopScreenShare();
    }, { once: true });
    return stream;
  }

  async stopScreenShare() {
    const producer = this.screenProducer;
    if (!producer) return;
    this.screenProducer = undefined;
    try {
      await emitAck(this.socket, 'rtc:close-producer', {
        sessionId: this.sessionId,
        producerId: producer.id,
      });
    } catch {}
    try { producer.close(); } catch {}
  }

  async restartIce() {
    const transports = [this.sendTransport, this.recvTransport].filter(Boolean);
    for (const transport of transports) {
      const data = await emitAck<{ iceParameters: any }>(this.socket, 'rtc:restart-ice', {
        sessionId: this.sessionId,
        transportId: transport.id,
      });
      await transport.restartIce({ iceParameters: data.iceParameters });
    }
  }

  async dispose(closeServerResources = true) {
    if (this.disposed) return;
    this.disposed = true;
    this.unbindServerEvents();
    if (closeServerResources) {
      for (const producer of [this.screenProducer, this.videoProducer, this.audioProducer]) {
        if (!producer) continue;
        try {
          await emitAck(this.socket, 'rtc:close-producer', {
            sessionId: this.sessionId,
            producerId: producer.id,
          }, 3000);
        } catch {}
      }
      for (const transport of [this.sendTransport, this.recvTransport]) {
        if (!transport) continue;
        try {
          await emitAck(this.socket, 'rtc:close-transport', {
            sessionId: this.sessionId,
            transportId: transport.id,
          }, 3000);
        } catch {}
      }
    }
    for (const consumer of this.consumers.values()) {
      try { consumer.close(); } catch {}
    }
    for (const producer of [this.screenProducer, this.videoProducer, this.audioProducer]) {
      try { producer?.close(); } catch {}
    }
    try { this.sendTransport?.close(); } catch {}
    try { this.recvTransport?.close(); } catch {}
    this.consumers.clear();
    this.consumerMeta.clear();
    this.pendingProducers.clear();
    this.remoteTiles.clear();
    this.emitRemote();
  }

  private async createSendTransport() {
    if (!this.device) throw new Error('mediasoup Device가 없습니다.');
    const result = await emitAck<TransportResult>(this.socket, 'rtc:create-transport', {
      sessionId: this.sessionId,
      direction: 'send',
    });
    const transport = this.device.createSendTransport(result.transportOptions);

    transport.on('connect', ({ dtlsParameters }: any, callback: () => void, errback: (error: Error) => void) => {
      emitAck(this.socket, 'rtc:connect-transport', {
        sessionId: this.sessionId,
        transportId: transport.id,
        dtlsParameters,
      }).then(() => callback()).catch((error) => errback(this.asError(error)));
    });

    transport.on('produce', (
      { kind, rtpParameters, appData }: any,
      callback: ({ id }: { id: string }) => void,
      errback: (error: Error) => void,
    ) => {
      emitAck<ProducerDescriptor>(this.socket, 'rtc:produce', {
        sessionId: this.sessionId,
        transportId: transport.id,
        kind,
        rtpParameters,
        appData,
      }).then((producer) => callback({ id: producer.producerId })).catch((error) => errback(this.asError(error)));
    });

    transport.on('connectionstatechange', (state: string) => {
      if (state === 'failed') void this.restartIce().catch(() => undefined);
    });

    this.sendTransport = transport;
  }

  private async createRecvTransport() {
    if (!this.device) throw new Error('mediasoup Device가 없습니다.');
    const result = await emitAck<TransportResult>(this.socket, 'rtc:create-transport', {
      sessionId: this.sessionId,
      direction: 'recv',
    });
    const transport = this.device.createRecvTransport(result.transportOptions);

    transport.on('connect', ({ dtlsParameters }: any, callback: () => void, errback: (error: Error) => void) => {
      emitAck(this.socket, 'rtc:connect-transport', {
        sessionId: this.sessionId,
        transportId: transport.id,
        dtlsParameters,
      }).then(() => callback()).catch((error) => errback(this.asError(error)));
    });

    transport.on('connectionstatechange', (state: string) => {
      if (state === 'failed') void this.restartIce().catch(() => undefined);
    });

    this.recvTransport = transport;
  }

  private async publishLocalMedia(stream: MediaStream) {
    if (!this.sendTransport) throw new Error('송신 Transport가 없습니다.');
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      this.audioProducer = await this.sendTransport.produce({
        track: audioTrack,
        appData: { source: 'microphone' },
      });
    }

    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      const base = {
        track: videoTrack,
        appData: { source: 'camera' },
      };
      try {
        this.videoProducer = await this.sendTransport.produce({
          ...base,
          encodings: [
            { rid: 'q', maxBitrate: 180_000, scaleResolutionDownBy: 4 },
            { rid: 'h', maxBitrate: 500_000, scaleResolutionDownBy: 2 },
            { rid: 'f', maxBitrate: 1_200_000 },
          ],
          codecOptions: { videoGoogleStartBitrate: 700 },
        });
      } catch (error) {
        console.warn('Simulcast 시작 실패, 단일 레이어로 재시도합니다.', error);
        this.videoProducer = await this.sendTransport.produce(base);
      }
    }
  }

  private async consumeProducer(descriptor: ProducerDescriptor) {
    if (this.disposed || this.consumers.has(descriptor.producerId) || this.consuming.has(descriptor.producerId)) return;
    if (!this.recvTransport || !this.device) {
      this.pendingProducers.set(descriptor.producerId, descriptor);
      return;
    }
    this.pendingProducers.delete(descriptor.producerId);
    this.consuming.add(descriptor.producerId);
    try {
      const result = await emitAck<{ consumer: ConsumerDescriptor }>(this.socket, 'rtc:consume', {
        sessionId: this.sessionId,
        transportId: this.recvTransport.id,
        producerId: descriptor.producerId,
        rtpCapabilities: this.device.rtpCapabilities,
      });
      const data = result.consumer;
      const consumer = await this.recvTransport.consume({
        id: data.id,
        producerId: data.producerId,
        kind: data.kind,
        rtpParameters: data.rtpParameters,
        appData: data.appData,
      });
      this.consumers.set(descriptor.producerId, consumer);

      const source = descriptor.source === 'screen' ? 'screen' : 'camera';
      const tileKey = `${descriptor.userId}:${source}`;
      let tile = this.remoteTiles.get(tileKey);
      if (!tile) {
        tile = { key: tileKey, userId: descriptor.userId, source, stream: new MediaStream() };
        this.remoteTiles.set(tileKey, tile);
      }
      if (!tile.stream.getTracks().some((track) => track.id === consumer.track.id)) {
        tile.stream.addTrack(consumer.track);
      }
      this.consumerMeta.set(descriptor.producerId, { producerId: descriptor.producerId, tileKey });
      this.emitRemote();

      consumer.on('transportclose', () => this.removeConsumer(descriptor.producerId));
      consumer.on('producerclose', () => this.removeConsumer(descriptor.producerId));

      await emitAck(this.socket, 'rtc:resume-consumer', {
        sessionId: this.sessionId,
        consumerId: consumer.id,
      });
    } finally {
      this.consuming.delete(descriptor.producerId);
    }
  }

  private async syncRemoteProducers() {
    if (this.disposed || !this.recvTransport || !this.device) return;
    const result = await emitAck<{ producers: ProducerDescriptor[] }>(this.socket, 'rtc:list-producers', {
      sessionId: this.sessionId,
    });
    for (const producer of result.producers ?? []) {
      await this.consumeProducer(producer).catch((error) => {
        console.warn('Producer 동기화 소비 실패', producer.producerId, error);
      });
    }
  }

  private async flushPendingProducers() {
    if (this.disposed || !this.recvTransport || !this.device || this.pendingProducers.size === 0) return;
    const pending = [...this.pendingProducers.values()];
    for (const producer of pending) {
      await this.consumeProducer(producer).catch((error) => {
        console.warn('대기 Producer 소비 실패', producer.producerId, error);
      });
    }
  }

  private removeConsumer(producerId: string) {
    this.pendingProducers.delete(producerId);
    const consumer = this.consumers.get(producerId);
    const meta = this.consumerMeta.get(producerId);
    if (consumer) {
      try { consumer.close(); } catch {}
      this.consumers.delete(producerId);
    }
    if (meta) {
      const tile = this.remoteTiles.get(meta.tileKey);
      if (tile && consumer?.track) {
        try { tile.stream.removeTrack(consumer.track); } catch {}
        if (tile.stream.getTracks().length === 0) this.remoteTiles.delete(meta.tileKey);
      }
      this.consumerMeta.delete(producerId);
    }
    this.emitRemote();
  }

  private onNewProducer = (payload: ProducerDescriptor & { sessionId: string }) => {
    if (payload.sessionId !== this.sessionId) return;
    if (!this.recvTransport || !this.device) {
      this.pendingProducers.set(payload.producerId, payload);
      return;
    }
    void this.consumeProducer(payload).catch((error) => console.error('새 Producer 소비 실패', error));
  };

  private onProducerClosed = (payload: { sessionId: string; producerId: string }) => {
    if (payload.sessionId !== this.sessionId) return;
    this.removeConsumer(payload.producerId);
  };

  private bindServerEvents() {
    this.socket.on('rtc:new-producer', this.onNewProducer);
    this.socket.on('rtc:producer-closed', this.onProducerClosed);
  }

  private unbindServerEvents() {
    this.socket.off('rtc:new-producer', this.onNewProducer);
    this.socket.off('rtc:producer-closed', this.onProducerClosed);
  }

  private emitRemote() {
    this.onRemote([...this.remoteTiles.values()]);
  }

  private asError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
  }
}
