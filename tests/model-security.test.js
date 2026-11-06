import test from 'node:test';
import assert from 'node:assert/strict';
import { VideoAiAnalyzer } from '../src/host/ai/video-analyzer.js';

test('saved configuration redacts credentials in legacy endpoints and forbids new secret URLs', async () => {
  const settings = new Map([['ai_base_url', 'https://name:password@example.org/v1?token=supersecret'], ['ai_api_key', 'key-secret'], ['ai_model', 'm']]);
  const db = { getSetting: k => settings.get(k), setSetting: (k,v) => settings.set(k,v) };
  const analyzer = new VideoAiAnalyzer(db, {});
  assert.equal(analyzer.getAiSettings().mode, 'custom');
  assert.equal(analyzer.getAiSettings().model, 'm');
  assert.equal(analyzer.getAiSettings().base_url, 'https://example.org/v1');
  assert.doesNotMatch(JSON.stringify(analyzer.getAiSettings()), /password|supersecret|key-secret/);
  await assert.rejects(analyzer.saveAiSettings({ mode:'custom', model:'m', base_url:'https://example.org/v1?token=secret' }), /不含凭据/);
  assert.equal(settings.get('ai_mode'), undefined);
});
