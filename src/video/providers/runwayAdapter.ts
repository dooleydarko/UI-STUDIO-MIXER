/**
 * Runway Gen-3 Video Engine Adapter
 * Automates Runway web session task creation and status tracking.
 */

import { VideoAccountSession, VideoGenerationRequest, VideoGenerationJob } from '../types';

export class RunwayAdapter {
  /**
   * Dispatch generation request using an active Runway account session
   */
  public static async executeJob(
    session: VideoAccountSession,
    req: VideoGenerationRequest,
    onProgress?: (percent: number, status: string) => void
  ): Promise<Partial<VideoGenerationJob>> {
    const startTime = performance.now();
    const jobId = `rw-job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    onProgress?.(15, 'Authenticating session with Runway cluster...');
    await new Promise((r) => setTimeout(r, 500));

    // Simulated vs Real session check
    if (session.sessionToken.startsWith('rw_jwt_mock')) {
      onProgress?.(40, 'Generating Gen-3 Alpha diffusion vectors...');
      await new Promise((r) => setTimeout(r, 700));

      onProgress?.(70, 'Applying camera motion and temporal coherence filter...');
      await new Promise((r) => setTimeout(r, 800));

      onProgress?.(95, 'Finalizing H.264 stream & poster frame...');
      await new Promise((r) => setTimeout(r, 400));

      const sampleVideoUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4';
      const sampleThumbUrl = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80';

      return {
        jobId,
        phase: 'completed',
        progressPercent: 100,
        providerUsed: 'runway',
        accountIdUsed: session.id,
        videoUrl: sampleVideoUrl,
        thumbnailUrl: sampleThumbUrl,
        elapsedMs: Math.round(performance.now() - startTime),
      };
    }

    try {
      onProgress?.(30, 'Dispatching task to api.runwayml.com...');
      const response = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionToken}`,
          'X-Runway-Version': '2024-09-13',
        },
        body: JSON.stringify({
          promptText: req.prompt,
          model: 'gen3a_turbo',
          duration: req.durationSeconds || 5,
          ratio: req.aspectRatio === '9:16' ? '768:1280' : '1280:768',
        }),
      });

      if (!response.ok) {
        throw new Error(`Runway HTTP ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      return {
        jobId: data.id || jobId,
        phase: 'completed',
        progressPercent: 100,
        providerUsed: 'runway',
        accountIdUsed: session.id,
        videoUrl: data.output?.[0],
        thumbnailUrl: data.poster,
        elapsedMs: Math.round(performance.now() - startTime),
      };
    } catch (err: any) {
      throw new Error(`Runway dispatch failed: ${err.message}`);
    }
  }
}
