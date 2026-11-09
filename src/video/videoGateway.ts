/**
 * Master Video Gateway & Auto-Failover Orchestrator
 * Seamlessly manages session rotation across Higgsfield, Runway, and Zero-GPU tiers.
 */

import { VideoGenerationRequest, VideoGenerationJob, VideoProviderId } from './types';
import { sessionVault } from './sessionVault';
import { HiggsfieldAdapter } from './providers/higgsfieldAdapter';
import { RunwayAdapter } from './providers/runwayAdapter';
import { ZeroGpuAdapter } from './providers/zeroGpuAdapter';
import { PollinationsAdapter } from './providers/pollinationsAdapter';

export class VideoGateway {
  /**
   * Primary entry point: Routes request with automated multi-account rotation and failover
   */
  public static async generateVideo(
    request: VideoGenerationRequest,
    onProgress?: (percent: number, maskedStatus: string) => void
  ): Promise<VideoGenerationJob> {
    const startTime = performance.now();
    const targetProvider: VideoProviderId = request.preferredProvider || 'auto_pool';
    const now = Date.now();

    // 1. Try Higgsfield Tier if requested or in auto_pool
    if (targetProvider === 'higgsfield' || targetProvider === 'auto_pool') {
      let hfSession = sessionVault.getNextAvailableSession('higgsfield');
      
      while (hfSession) {
        try {
          onProgress?.(10, 'Activating high-fidelity motion cluster...');
          const result = await HiggsfieldAdapter.executeJob(
            hfSession,
            request,
            (pct, stat) => onProgress?.(pct, `Native Video Engine // ${stat}`)
          );

          sessionVault.recordJobSuccess(hfSession.id, 1);

          return {
            jobId: result.jobId || `job-${now}`,
            prompt: request.prompt,
            phase: 'completed',
            progressPercent: 100,
            providerUsed: 'higgsfield',
            accountIdUsed: hfSession.label,
            videoUrl: result.videoUrl,
            thumbnailUrl: result.thumbnailUrl,
            elapsedMs: Math.round(performance.now() - startTime),
            createdAt: now,
            completedAt: Date.now(),
          };
        } catch (err: any) {
          console.warn(`[VideoGateway] Higgsfield cluster ${hfSession.id} error:`, err.message);
          sessionVault.recordRateLimit(hfSession.id, 120000); // 2 minute cooldown
          onProgress?.(15, 'Cascading to auxiliary rendering node...');
          // Attempt next available Higgsfield account
          hfSession = sessionVault.getNextAvailableSession('higgsfield');
        }
      }
    }

    // 2. Try Runway Tier if requested or as cascade from Higgsfield
    if (targetProvider === 'runway' || targetProvider === 'auto_pool') {
      let rwSession = sessionVault.getNextAvailableSession('runway');

      while (rwSession) {
        try {
          onProgress?.(20, 'Dispatching to accelerated spatial motion pipeline...');
          const result = await RunwayAdapter.executeJob(
            rwSession,
            request,
            (pct, stat) => onProgress?.(pct, `Native Video Engine // ${stat}`)
          );

          sessionVault.recordJobSuccess(rwSession.id, 1);

          return {
            jobId: result.jobId || `job-${now}`,
            prompt: request.prompt,
            phase: 'completed',
            progressPercent: 100,
            providerUsed: 'runway',
            accountIdUsed: rwSession.label,
            videoUrl: result.videoUrl,
            thumbnailUrl: result.thumbnailUrl,
            elapsedMs: Math.round(performance.now() - startTime),
            createdAt: now,
            completedAt: Date.now(),
          };
        } catch (err: any) {
          console.warn(`[VideoGateway] Runway cluster ${rwSession.id} error:`, err.message);
          sessionVault.recordRateLimit(rwSession.id, 180000);
          onProgress?.(25, 'Rotating to standby rendering cluster...');
          rwSession = sessionVault.getNextAvailableSession('runway');
        }
      }
    }

    // 3. Zero-GPU Community Safety Net ($0 Free Cloud Fallback)
    try {
      onProgress?.(30, 'Routing through open cloud compute mesh (LTX-Video)...');
      const zgResult = await ZeroGpuAdapter.executeJob(
        request,
        (pct, stat) => onProgress?.(pct, `Native Video Engine // ${stat}`)
      );

      return {
        jobId: zgResult.jobId || `job-${now}`,
        prompt: request.prompt,
        phase: 'completed',
        progressPercent: 100,
        providerUsed: 'zero_gpu',
        accountIdUsed: 'Community Zero-GPU Mesh',
        videoUrl: zgResult.videoUrl,
        thumbnailUrl: zgResult.thumbnailUrl,
        elapsedMs: Math.round(performance.now() - startTime),
        createdAt: now,
        completedAt: Date.now(),
      };
    } catch (err) {
      console.warn('[VideoGateway] Zero-GPU tier unavailable, falling back to Pollinations:', err);
    }

    // 4. Instant Pollinations Video Safety Net
    onProgress?.(40, 'Executing via open neural stream gateway...');
    const polResult = await PollinationsAdapter.executeJob(
      request,
      (pct, stat) => onProgress?.(pct, `Native Video Engine // ${stat}`)
    );

    return {
      jobId: polResult.jobId || `job-${now}`,
      prompt: request.prompt,
      phase: 'completed',
      progressPercent: 100,
      providerUsed: 'pollinations',
      accountIdUsed: 'Open Neural Gateway',
      videoUrl: polResult.videoUrl,
      thumbnailUrl: polResult.thumbnailUrl,
      elapsedMs: Math.round(performance.now() - startTime),
      createdAt: now,
      completedAt: Date.now(),
    };
  }
}
