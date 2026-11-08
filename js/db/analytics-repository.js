/**
 * Repository for Dashboard Analytics and Reporting.
 */
import { getVideosDatabase, queryAll, queryOne } from './sqlite-engine.js';
import { getAllReferencedAssetIds } from './videos-repository.js';
import { calculateStorageForAssets } from './indexeddb-store.js';

export async function getTotalVideos() {
  const db = await getVideosDatabase();
  const row = queryOne(db, 'SELECT COUNT(*) AS total_videos FROM videos;');
  return row ? row.total_videos : 0;
}

export async function getTotalViews() {
  const db = await getVideosDatabase();
  const row = queryOne(db, 'SELECT COALESCE(SUM(view_count), 0) AS total_views FROM video_daily_views;');
  return row ? row.total_views : 0;
}

export async function getStorageUsageBytes() {
  const assetIdSet = await getAllReferencedAssetIds();
  return calculateStorageForAssets(assetIdSet);
}

export async function getTop10Videos() {
  const db = await getVideosDatabase();
  return queryAll(db, `
    SELECT v.id, v.title,
           COALESCE(SUM(d.view_count), 0) AS views
    FROM videos v
    LEFT JOIN video_daily_views d ON d.video_id = v.id
    GROUP BY v.id, v.title
    ORDER BY views DESC, v.title ASC, v.id ASC
    LIMIT 10;
  `);
}

export async function getDailyViewsTrend(days = 30) {
  const db = await getVideosDatabase();
  const today = new Date();

  // Generate 30 date strings
  const dateMap = new Map();
  const dateList = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const displayLabel = `${dd}/${mm}`;

    dateMap.set(dateStr, {
      date: dateStr,
      label: displayLabel,
      views: 0
    });
    dateList.push(dateStr);
  }

  const startDate = dateList[0];
  const endDate = dateList[dateList.length - 1];

  const rows = queryAll(db, `
    SELECT view_date, SUM(view_count) AS views
    FROM video_daily_views
    WHERE view_date BETWEEN ? AND ?
    GROUP BY view_date
    ORDER BY view_date ASC;
  `, [startDate, endDate]);

  for (const r of rows) {
    if (dateMap.has(r.view_date)) {
      dateMap.get(r.view_date).views = Number(r.views) || 0;
    }
  }

  return Array.from(dateMap.values());
}

export async function getMonthlyViewsTrend(months = 12) {
  const db = await getVideosDatabase();
  const today = new Date();

  const monthMap = new Map();
  const monthList = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const monthKey = `${yyyy}-${mm}`;
    const displayLabel = `T${d.getMonth() + 1}/${yyyy}`;

    monthMap.set(monthKey, {
      month: monthKey,
      label: displayLabel,
      views: 0
    });
    monthList.push(monthKey);
  }

  const startMonth = monthList[0];
  const endMonth = monthList[monthList.length - 1];

  const rows = queryAll(db, `
    SELECT substr(view_date, 1, 7) AS view_month,
           SUM(view_count) AS views
    FROM video_daily_views
    WHERE substr(view_date, 1, 7) BETWEEN ? AND ?
    GROUP BY substr(view_date, 1, 7)
    ORDER BY view_month ASC;
  `, [startMonth, endMonth]);

  for (const r of rows) {
    if (monthMap.has(r.view_month)) {
      monthMap.get(r.view_month).views = Number(r.views) || 0;
    }
  }

  return Array.from(monthMap.values());
}
