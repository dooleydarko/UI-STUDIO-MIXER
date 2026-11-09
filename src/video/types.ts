/**
 * Video Generation & Proxy Daemon Types
 * Unified abstraction layer for multi-account session rotation across
 * Higgsfield, Runway, and zero-cost cloud tiers.
 */

export type VideoProviderId = 
  | 'higgsfield' 
  | 'runway' 
  | 'zero_gpu' 
  | 'pollinations'
  | 'auto_pool';

export type SessionHealthStatus = 'active' | 'rate_limited' | 'exhausted' | 'expired' | 'standby';

export interface VideoAccountSession {
  id: string;
  provider: 'higgsfield' | 'runway';
  label: string; // e.g. "Cluster Alpha (Higgsfield #1)"
  sessionToken: string; // Authenticated Bearer JWT or cookie session string
  refreshToken?: string;
  remainingCredits: number;
  totalGenerated: number;
  status: SessionHealthStatus;
  lastUsedTimestamp: number;
  cooldownUntilTimestamp?: number;
}

export interface VideoGenerationRequest {
  prompt: string;
  negativePrompt?: string;
  sourceImageUrl?: string; // Image-to-Video
  aspectRatio?: '16:9' | '9:16' | '1:1';
  durationSeconds?: 4 | 5 | 10;
  motionIntensity?: number; // 1 to 10
  preferredProvider?: VideoProviderId;
  seed?: number;
}

export type JobPhase = 'queued' | 'dispatching' | 'rendering' | 'completed' | 'failed' | 'fallback';

export interface VideoGenerationJob {
  jobId: string;
  prompt: string;
  phase: JobPhase;
  progressPercent: number; // 0 to 100
  providerUsed: VideoProviderId;
  accountIdUsed?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  elapsedMs: number;
  errorMessage?: string;
  createdAt: number;
  completedAt?: number;
}

export interface VideoProxyStats {
  totalClustersActive: number;
  totalCreditsAvailable: number;
  totalVideosRendered: number;
  activeProvider: string;
  failoverEventsCount: number;
}
