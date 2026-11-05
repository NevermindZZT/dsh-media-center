export class ShotSearchService {
  constructor(db) {
    this.db = db;
  }

  tokenize(text) {
    if (!text) return [];
    // Extract english words or chinese 2-grams and single characters
    const clean = text.toLowerCase().replace(/[,.!?;:，。！？；：“”‘’"'\(\)\[\]]/g, ' ');
    const tokens = [];

    // Split by spaces for words/pinyin/english
    const parts = clean.split(/\s+/).filter(Boolean);
    for (const part of parts) {
      tokens.push(part);
      // For chinese string, generate bigrams if longer than 2 chars
      if (/[\u4e00-\u9fa5]/.test(part) && part.length > 2) {
        for (let i = 0; i < part.length - 1; i++) {
          tokens.push(part.slice(i, i + 2));
        }
      }
    }
    return [...new Set(tokens)];
  }

  search(query, options = {}) {
    if (!query || !query.trim()) {
      return [];
    }

    const queryTokens = this.tokenize(query.trim());
    if (queryTokens.length === 0) return [];

    // 1. Fetch candidate shots
    const rawCandidates = this.db.searchShots(query.trim(), {
      tokens: queryTokens,
      limit: options.limit ? options.limit * 3 : 60
    });

    // 2. Score and rank candidates
    const scoredList = [];

    for (const shot of rawCandidates) {
      let score = 0;
      const matchedTokens = [];

      const targetText = [
        shot.visual_description || '',
        shot.subject || '',
        shot.shot_type || '',
        shot.camera_movement || '',
        shot.composition || '',
        shot.folder_path || '',
        (shot.tags || []).join(' ')
      ].join(' ').toLowerCase();

      for (const token of queryTokens) {
        if (targetText.includes(token)) {
          matchedTokens.push(token);

          // Add weight based on where it matches
          if ((shot.visual_description || '').toLowerCase().includes(token)) score += 3.0;
          if ((shot.subject || '').toLowerCase().includes(token)) score += 2.5;
          if ((shot.folder_path || '').toLowerCase().includes(token)) score += 2.0;
          if ((shot.shot_type || '').toLowerCase().includes(token)) score += 1.5;
          if ((shot.camera_movement || '').toLowerCase().includes(token)) score += 1.5;
          if ((shot.tags || []).some(t => t.toLowerCase().includes(token))) score += 2.0;
        }
      }

      // Quality score bonus (1-5 scaled to 0.1-0.5)
      score += (shot.quality_score || 3) * 0.1;

      // Filter options
      if (options.shot_type && shot.shot_type !== options.shot_type) continue;
      if (options.camera_movement && shot.camera_movement !== options.camera_movement) continue;
      if (options.min_duration && shot.duration < options.min_duration) continue;
      if (options.max_duration && shot.duration > options.max_duration) continue;

      if (score > 0 || matchedTokens.length > 0) {
        scoredList.push({
          ...shot,
          relevance_score: Math.round(score * 10) / 10,
          matched_tokens: matchedTokens
        });
      }
    }

    // Sort by score descending
    scoredList.sort((a, b) => b.relevance_score - a.relevance_score);

    const limit = Number(options.limit) || 20;
    return scoredList.slice(0, limit);
  }
}
