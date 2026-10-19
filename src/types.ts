export type PlatformRole = 'admin' | 'staff' | 'doctor' | 'user';
export type TelemedicineRole =
  | 'DOCTOR'
  | 'CONSULTING_DOCTOR'
  | 'NURSE'
  | 'PATIENT'
  | 'GUARDIAN'
  | 'INTERPRETER';

export type SessionStatus =
  | 'SCHEDULED'
  | 'WAITING'
  | 'READY'
  | 'LIVE'
  | 'ENDED'
  | 'CANCELLED';

export type ParticipantPresence =
  | 'INVITED'
  | 'WAITING'
  | 'READY'
  | 'LIVE'
  | 'DISCONNECTED'
  | 'LEFT';

export interface ParticipantPermissions {
  publishAudio: boolean;
  publishVideo: boolean;
  consumeAudio: boolean;
  consumeVideo: boolean;
  shareScreen: boolean;
  manageSession: boolean;
  manageParticipants: boolean;
}

export interface SessionParticipant {
  userId: string;
  displayName?: string;
  role: string;
  permissions: ParticipantPermissions;
  presence: ParticipantPresence;
  ready: boolean;
  joinedAt?: number;
  lastSeenAt?: number;
}

export interface SessionPolicy {
  topology: 'ONE_TO_ONE' | 'ONE_TO_MANY' | 'MANY_TO_MANY';
  maxParticipants: number;
  maxVideoPublishers?: number;
  maxAudioPublishers?: number;
  waitingRoom: boolean;
  requireHostStart: boolean;
  allowUnlistedParticipants: boolean;
  allowRejoinAfterEnd: boolean;
}

export interface ConsultationSession {
  id: string;
  type: string;
  title?: string;
  status: SessionStatus;
  hostUserIds: string[];
  participants: SessionParticipant[];
  policy: SessionPolicy;
  scheduledAt?: string;
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  mediaNodeId?: string;
  mediaNodePublicUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface AuthProfile {
  userId: string;
  name: string;
  platformRole: PlatformRole;
  token: string;
}

export type Ack<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

export interface ProducerDescriptor {
  producerId: string;
  peerId: string;
  userId: string;
  kind: 'audio' | 'video';
  source: 'microphone' | 'camera' | 'screen' | string;
  appData?: Record<string, unknown>;
}

export interface ConsumerDescriptor {
  id: string;
  producerId: string;
  producerPeerId: string;
  producerUserId: string;
  kind: 'audio' | 'video';
  rtpParameters: any;
  type: string;
  appData?: Record<string, unknown>;
  producerPaused?: boolean;
}

export interface RemoteTile {
  key: string;
  userId: string;
  source: 'camera' | 'screen';
  stream: MediaStream;
}
