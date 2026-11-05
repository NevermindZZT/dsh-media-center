import { VideoDatabase } from './src/host/db/database.js';
import { MediaEngine } from './src/host/media/engine.js';
import { ProjectExporter } from './src/host/export/project-exporter.js';
import { ShotSearchService } from './src/host/search/shot-search.js';
import { createVideoManagerApiHandler } from './src/host/api/router.js';
import { registerVideoManagerTools } from './src/host/tools/register-tools.js';

export const inject = ['tools', 'webServer'];

export function apply(ctx, config) {
  const workspaceRoot = process.cwd();
  const db = new VideoDatabase({ workspaceRoot });
  const mediaEngine = new MediaEngine(db);
  const projectExporter = new ProjectExporter(db);
  const shotSearchService = new ShotSearchService(db);

  ctx.effect(() => {
    // 1. Register Host Web API Route
    let disposeRoute = () => {};
    if (ctx.webServer && typeof ctx.webServer.register === 'function') {
      const handler = createVideoManagerApiHandler({
        db,
        mediaEngine,
        projectExporter,
        shotSearchService
      });
      disposeRoute = ctx.webServer.register({
        kind: 'prefix',
        path: '/api/video-manager',
        handler
      });
    }

    // 2. Register Agent Tools
    const disposeTools = registerVideoManagerTools(ctx, {
      db,
      mediaEngine,
      projectExporter,
      shotSearchService
    });

    return () => {
      try { disposeRoute(); } catch {}
      try { disposeTools(); } catch {}
    };
  });
}
