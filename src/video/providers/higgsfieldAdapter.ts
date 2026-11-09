/**
 * Higgsfield Video Engine Adapter
 * Automates Higgsfield web-session task generation with Bearer token authentication.
 */

import { VideoAccountSession, VideoGenerationRequest, VideoGenerationJob } from '../types';

export class HiggsfieldAdapter {
  /**
   * Dispatch generation request using an active Higgsfield account session
   */
  public static async executeJob(
    session: VideoAccountSession,
    req: VideoGenerationRequest,
    onProgress?: (percent: number, status: string) => void
  ): Promise<Partial<VideoGenerationJob>> {
    const startTime = performance.now();
    const jobId = `hf-job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    onProgress?.(10, 'Establishing handshake with Higgsfield cluster...');
    await new Promise((r) => setTimeout(r, 600));

    // Check if token appears simulated vs real HTTP
    if (session.sessionToken.startsWith('hf_sess_mock')) {
      // High-fidelity simulation for local verification
      onProgress?.(30, 'Allocating GPU compute & neural motion tokens...');
      await new Promise((r) => setTimeout(r, 700));

      onProgress?.(65, 'Rendering diffusion latents (Higgsfield Soul v2 engine)...');
      await new Promise((r) => setTimeout(r, 800));

      onProgress?.(90, 'Encoding MP4 stream & generating spatial thumbnail...');
      await new Promise((r) => setTimeout(r, 500));

      // Realistic high-quality generative video loop sample
      const sampleVideoUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
      const sampleThumbUrl = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80';

      return {
        jobId,
        phase: 'completed',
        progressPercent: 100,
        providerUsed: 'higgsfield',
        accountIdUsed: session.id,
        videoUrl: sampleVideoUrl,
        thumbnailUrl: sampleThumbUrl,
        elapsedMs: Math.round(performance.now() - startTime),
      };
    }

    // Real API / Session Endpoint invocation
    try {
      onProgress?.(25, 'Dispatching task to api.higgsfield.ai...');
      const response = await fetch('https://api.higgsfield.ai/v1/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionToken}`,
        },
        body: JSON.stringify({
          prompt: req.prompt,
          aspect_ratio: req.aspectRatio || '16:9',
          duration: req.durationSeconds || 5,
        }),
      });

      if (!response.ok) {
        throw new Error(`Higgsfield HTTP ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      return {
        jobId: data.id || jobId,
        phase: 'completed',
        progressPercent: 100,
        providerUsed: 'higgsfield',
        accountIdUsed: session.id,
        videoUrl: data.video_url,
        thumbnailUrl: data.thumbnail_url,
        elapsedMs: Math.round(performance.now() - startTime),
      };
    } catch (err: any) {
      throw new Error(`Higgsfield dispatch failed: ${err.message}`);
    }
  }
}
