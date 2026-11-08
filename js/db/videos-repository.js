/**
 * Repository for Videos, Categories, and Views in videos.db
 */
import { getVideosDatabase, queryAll, queryOne, runStatement } from './sqlite-engine.js';
import { persistWithRollback } from './persistence.js';
import { deleteMediaAsset } from './indexeddb-store.js';
import { initSupabase, getSupabase } from './supabase-client.js';

export async function getCategories() {
  const db = await getVideosDatabase();
  return queryAll(db, 'SELECT * FROM video_categories ORDER BY name ASC;');
}

export async function countVideos({ search = '', categoryId = '', status = '' } = {}) {
  const db = await getVideosDatabase();
  const searchPattern = search ? `%${search.trim().toLowerCase()}%` : '';

  let sql = `
    SELECT COUNT(DISTINCT v.id) as total
    FROM videos v
    WHERE 1=1
  `;
  const params = [];

  if (searchPattern) {
    sql += ' AND lower(v.title) LIKE ?';
    params.push(searchPattern);
  }
  if (status) {
    sql += ' AND v.status = ?';
    params.push(status);
  }
  if (categoryId) {
    sql += ' AND EXISTS (SELECT 1 FROM video_category_map m WHERE m.video_id = v.id AND m.category_id = ?)';
    params.push(categoryId);
  }

  const row = queryOne(db, sql, params);
  return row ? row.total : 0;
}

export async function getVideos({
  search = '',
  categoryId = '',
  status = '',
  sort = 'created_desc',
  page = 1,
  limit = 10
} = {}) {
  const db = await getVideosDatabase();
  const searchPattern = search ? `%${search.trim().toLowerCase()}%` : '';
  const offset = Math.max(0, (page - 1) * limit);

  let sql = `
    SELECT v.id, v.title, v.description, v.status, v.source_type,
           v.video_url, v.video_asset_id, v.thumbnail_url, v.thumbnail_asset_id,
           v.duration_seconds, v.is_demo, v.created_at, v.updated_at,
           COALESCE(SUM(d.view_count), 0) AS views
    FROM videos v
    LEFT JOIN video_daily_views d ON d.video_id = v.id
    WHERE 1=1
  `;
  const params = [];

  if (searchPattern) {
    sql += ' AND lower(v.title) LIKE ?';
    params.push(searchPattern);
  }
  if (status) {
    sql += ' AND v.status = ?';
    params.push(status);
  }
  if (categoryId) {
    sql += ' AND EXISTS (SELECT 1 FROM video_category_map m WHERE m.video_id = v.id AND m.category_id = ?)';
    params.push(categoryId);
  }

  sql += ' GROUP BY v.id';

  // Sort whitelist
  switch (sort) {
    case 'created_asc':
      sql += ' ORDER BY v.created_at ASC, v.id ASC';
      break;
    case 'views_desc':
      sql += ' ORDER BY views DESC, v.title ASC, v.id ASC';
      break;
    case 'views_asc':
      sql += ' ORDER BY views ASC, v.title ASC, v.id ASC';
      break;
    case 'title_asc':
      sql += ' ORDER BY v.title ASC, v.id ASC';
      break;
    case 'created_desc':
    default:
      sql += ' ORDER BY v.created_at DESC, v.id ASC';
      break;
  }

  sql += ' LIMIT ? OFFSET ?;';
  params.push(limit, offset);

  const videos = queryAll(db, sql, params);

  // Attach category tags for each video
  for (const video of videos) {
    const cats = queryAll(db, `
      SELECT c.id, c.name, c.slug
      FROM video_categories c
      JOIN video_category_map m ON m.category_id = c.id
      WHERE m.video_id = ?
      ORDER BY c.name ASC;
    `, [video.id]);
    video.categories = cats;
  }

  return videos;
}

export async function getVideoById(id) {
  if (!id) return null;
  const db = await getVideosDatabase();

  const video = queryOne(db, `
    SELECT v.*, COALESCE(SUM(d.view_count), 0) as views
    FROM videos v
    LEFT JOIN video_daily_views d ON d.video_id = v.id
    WHERE v.id = ?
    GROUP BY v.id;
  `, [id]);

  if (!video) return null;

  const cats = queryAll(db, `
    SELECT c.id, c.name, c.slug
    FROM video_categories c
    JOIN video_category_map m ON m.category_id = c.id
    WHERE m.video_id = ?
    ORDER BY c.name ASC;
  `, [id]);
  video.categories = cats;
  video.categoryIds = cats.map(c => c.id);

  return video;
}

export async function createVideo(videoData) {
  const db = await getVideosDatabase();
  const now = new Date().toISOString();
  const id = videoData.id || crypto.randomUUID();

  await persistWithRollback(db, 'videos.db', () => {
    runStatement(db, `
      INSERT INTO videos (
        id, title, description, status, source_type, video_url,
        video_asset_id, thumbnail_url, thumbnail_asset_id,
        duration_seconds, is_demo, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `, [
      id,
      videoData.title.trim(),
      videoData.description ? videoData.description.trim() : '',
      videoData.status || 'draft',
      videoData.sourceType,
      videoData.videoUrl || null,
      videoData.videoAssetId || null,
      videoData.thumbnailUrl || null,
      videoData.thumbnailAssetId || null,
      videoData.durationSeconds || null,
      videoData.isDemo ? 1 : 0,
      now,
      now
    ]);

    // Categories
    if (Array.isArray(videoData.categoryIds)) {
      for (const catId of videoData.categoryIds) {
        runStatement(db, 'INSERT INTO video_category_map (video_id, category_id) VALUES (?, ?);', [id, catId]);
      }
    }

    return id;
  });

  // Sync to Supabase
  syncVideoInsertToSupabase(id, videoData, now).catch(e => console.warn('[Supabase Video Sync error]', e));

  return id;
}

export async function updateVideo(id, videoData) {
  const db = await getVideosDatabase();
  const now = new Date().toISOString();

  // Find previous asset IDs to clean up if replaced
  const prev = await getVideoById(id);

  const result = await persistWithRollback(db, 'videos.db', () => {
    runStatement(db, `
      UPDATE videos SET
        title = ?,
        description = ?,
        status = ?,
        source_type = ?,
        video_url = ?,
        video_asset_id = ?,
        thumbnail_url = ?,
        thumbnail_asset_id = ?,
        duration_seconds = ?,
        updated_at = ?
      WHERE id = ?;
    `, [
      videoData.title.trim(),
      videoData.description ? videoData.description.trim() : '',
      videoData.status || 'draft',
      videoData.sourceType,
      videoData.videoUrl || null,
      videoData.videoAssetId || null,
      videoData.thumbnailUrl || null,
      videoData.thumbnailAssetId || null,
      videoData.durationSeconds || null,
      now,
      id
    ]);

    // Re-link categories
    runStatement(db, 'DELETE FROM video_category_map WHERE video_id = ?;', [id]);
    if (Array.isArray(videoData.categoryIds)) {
      for (const catId of videoData.categoryIds) {
        runStatement(db, 'INSERT INTO video_category_map (video_id, category_id) VALUES (?, ?);', [id, catId]);
      }
    }

    return true;
  });

  // Cleanup old unreferenced media assets
  if (prev) {
    if (prev.video_asset_id && prev.video_asset_id !== videoData.videoAssetId) {
      await cleanupAssetIfUnreferenced(prev.video_asset_id);
    }
    if (prev.thumbnail_asset_id && prev.thumbnail_asset_id !== videoData.thumbnailAssetId) {
      await cleanupAssetIfUnreferenced(prev.thumbnail_asset_id);
    }
  }

  // Sync to Supabase
  syncVideoUpdateToSupabase(id, videoData, now).catch(e => console.warn('[Supabase Video Sync error]', e));

  return result;
}

export async function deleteVideo(id) {
  const db = await getVideosDatabase();
  const prev = await getVideoById(id);
  if (!prev) return false;

  await persistWithRollback(db, 'videos.db', () => {
    runStatement(db, 'DELETE FROM videos WHERE id = ?;', [id]);
    return true;
  });

  // Cleanup assets if not referenced elsewhere
  if (prev.video_asset_id) {
    await cleanupAssetIfUnreferenced(prev.video_asset_id);
  }
  if (prev.thumbnail_asset_id) {
    await cleanupAssetIfUnreferenced(prev.thumbnail_asset_id);
  }

  // Sync to Supabase
  syncVideoDeleteToSupabase(id).catch(e => console.warn('[Supabase Video Sync error]', e));

  return true;
}

/**
 * Sync single video update to Supabase public.videos
 */
async function syncVideoUpdateToSupabase(id, videoData, now = new Date().toISOString()) {
  try {
    const client = getSupabase() || await initSupabase();
    if (!client) return;

    const payload = {
      id: id,
      title: videoData.title.trim(),
      description: videoData.description ? videoData.description.trim() : '',
      status: videoData.status || 'draft',
      source_type: videoData.sourceType || 'url',
      video_url: videoData.videoUrl || null,
      thumbnail_url: videoData.thumbnailUrl || null,
      duration_seconds: videoData.durationSeconds || null,
      updated_at: now
    };

    const { error } = await client.from('videos').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.warn('[Supabase Video Sync] Update error:', error);
    } else {
      console.log('[Supabase Video Sync] Đã đồng bộ video lên Supabase:', id, payload.title);
    }

    // Sync categories
    if (Array.isArray(videoData.categoryIds)) {
      await client.from('video_category_map').delete().eq('video_id', id);
      if (videoData.categoryIds.length > 0) {
        const catRows = videoData.categoryIds.map(cId => ({
          video_id: id,
          category_id: cId
        }));
        await client.from('video_category_map').insert(catRows);
      }
    }
  } catch (err) {
    console.warn('[Supabase Video Sync] Exception:', err);
  }
}

/**
 * Sync video insert to Supabase public.videos
 */
async function syncVideoInsertToSupabase(id, videoData, now) {
  try {
    const client = getSupabase() || await initSupabase();
    if (!client) return;

    const payload = {
      id: id,
      title: videoData.title.trim(),
      description: videoData.description ? videoData.description.trim() : '',
      status: videoData.status || 'draft',
      source_type: videoData.sourceType || 'url',
      video_url: videoData.videoUrl || null,
      thumbnail_url: videoData.thumbnailUrl || null,
      duration_seconds: videoData.durationSeconds || null,
      is_demo: videoData.isDemo ? true : false,
      created_at: now,
      updated_at: now
    };

    const { error } = await client.from('videos').upsert(payload, { onConflict: 'id' });
    if (error) console.warn('[Supabase Video Sync] Insert error:', error);

    if (Array.isArray(videoData.categoryIds) && videoData.categoryIds.length > 0) {
      const catRows = videoData.categoryIds.map(cId => ({
        video_id: id,
        category_id: cId
      }));
      await client.from('video_category_map').insert(catRows);
    }
  } catch (err) {
    console.warn('[Supabase Video Sync] Exception:', err);
  }
}

/**
 * Sync video delete to Supabase public.videos
 */
async function syncVideoDeleteToSupabase(id) {
  try {
    const client = getSupabase() || await initSupabase();
    if (!client) return;
    await client.from('videos').delete().eq('id', id);
  } catch (err) {
    console.warn('[Supabase Video Sync] Exception:', err);
  }
}

/**
 * Push all local videos to Supabase
 */
export async function syncAllVideosToSupabase() {
  const db = await getVideosDatabase();
  const videos = queryAll(db, 'SELECT * FROM videos;');
  const client = getSupabase() || await initSupabase();
  if (!client) return { total: 0, synced: 0 };

  let count = 0;
  for (const v of videos) {
    try {
      const { error } = await client.from('videos').upsert({
        id: v.id,
        title: v.title,
        description: v.description || '',
        status: v.status || 'draft',
        source_type: v.source_type,
        video_url: v.video_url || null,
        thumbnail_url: v.thumbnail_url || null,
        duration_seconds: v.duration_seconds || null,
        is_demo: Boolean(v.is_demo),
        created_at: v.created_at,
        updated_at: v.updated_at
      }, { onConflict: 'id' });
      if (!error) count++;
    } catch (e) {}
  }
  return { total: videos.length, synced: count };
}

/**
 * Pull and sync videos from Supabase to local SQLite
 */
export async function syncVideosFromSupabase() {
  const client = getSupabase() || await initSupabase();
  if (!client) return false;

  try {
    const { data: remoteVideos, error } = await client.from('videos').select('*');
    if (error || !remoteVideos || remoteVideos.length === 0) return false;

    const db = await getVideosDatabase();
    for (const rv of remoteVideos) {
      const existing = queryOne(db, 'SELECT id, updated_at FROM videos WHERE id = ?;', [rv.id]);
      if (!existing) {
        runStatement(db, `
          INSERT INTO videos (
            id, title, description, status, source_type, video_url,
            duration_seconds, is_demo, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `, [
          rv.id,
          rv.title,
          rv.description || '',
          rv.status || 'draft',
          rv.source_type || 'url',
          rv.video_url || null,
          rv.duration_seconds || 60,
          rv.is_demo ? 1 : 0,
          rv.created_at,
          rv.updated_at
        ]);
      } else {
        // Update if remote is newer or existing title differs
        runStatement(db, `
          UPDATE videos SET
            title = ?,
            description = ?,
            status = ?,
            video_url = ?,
            duration_seconds = ?,
            updated_at = ?
          WHERE id = ?;
        `, [
          rv.title,
          rv.description || '',
          rv.status || 'draft',
          rv.video_url || null,
          rv.duration_seconds || 60,
          rv.updated_at,
          rv.id
        ]);
      }
    }
    return true;
  } catch (err) {
    console.warn('[Sync from Supabase warning]', err);
    return false;
  }
}

export async function incrementDailyView(videoId) {
  const db = await getVideosDatabase();
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;

  return persistWithRollback(db, 'videos.db', () => {
    runStatement(db, `
      INSERT INTO video_daily_views(video_id, view_date, view_count)
      VALUES (?, ?, 1)
      ON CONFLICT(video_id, view_date)
      DO UPDATE SET view_count = view_count + 1;
    `, [videoId, dateStr]);

    return true;
  });
}

export async function getAllReferencedAssetIds() {
  const db = await getVideosDatabase();
  const rows = queryAll(db, `
    SELECT video_asset_id, thumbnail_asset_id FROM videos
    WHERE video_asset_id IS NOT NULL OR thumbnail_asset_id IS NOT NULL;
  `);

  const idSet = new Set();
  for (const r of rows) {
    if (r.video_asset_id) idSet.add(r.video_asset_id);
    if (r.thumbnail_asset_id) idSet.add(r.thumbnail_asset_id);
  }
  return idSet;
}

async function cleanupAssetIfUnreferenced(assetId) {
  if (!assetId) return;
  const db = await getVideosDatabase();
  const row = queryOne(db, `
    SELECT COUNT(*) as cnt FROM videos
    WHERE video_asset_id = ? OR thumbnail_asset_id = ?;
  `, [assetId, assetId]);

  if (!row || row.cnt === 0) {
    try {
      await deleteMediaAsset(assetId);
    } catch (e) {
      console.warn('Failed to delete orphan asset', assetId, e);
    }
  }
}
