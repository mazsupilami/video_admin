/**
 * Dashboard Page Controller
 */
import { requireAuth } from '../core/router-guard.js';
import { initAppShell } from '../core/app-init.js';
import { formatNumber, formatBytes } from '../core/formatters.js';
import {
  getTotalVideos,
  getTotalViews,
  getStorageUsageBytes,
  getTop10Videos,
  getDailyViewsTrend,
  getMonthlyViewsTrend
} from '../db/analytics-repository.js';
import { TopVideosChart } from '../charts/top-videos-chart.js';
import { TrendChart } from '../charts/trend-chart.js';
import { getVideosDatabase } from '../db/sqlite-engine.js';
import { exportDatabaseFile } from '../db/persistence.js';
import { showToast } from '../core/ui-utils.js';

export async function initDashboardPage() {
  const session = requireAuth();
  if (!session) return;

  initAppShell();

  const totalVideosEl = document.getElementById('kpiTotalVideos');
  const totalViewsEl = document.getElementById('kpiTotalViews');
  const storageUsageEl = document.getElementById('kpiStorageUsage');

  const topVideosCanvas = document.getElementById('topVideosCanvas');
  const topVideosSummary = document.getElementById('topVideosSummary');
  const trendCanvas = document.getElementById('trendCanvas');
  const trendSummary = document.getElementById('trendSummary');

  const btnTrendDay = document.getElementById('btnTrendDay');
  const btnTrendMonth = document.getElementById('btnTrendMonth');

  let topChart = null;
  let trendChart = null;
  let dailyData = [];
  let monthlyData = [];
  let currentTrendMode = 'day';

  if (topVideosCanvas) {
    topChart = new TopVideosChart(topVideosCanvas, topVideosSummary);
  }
  if (trendCanvas) {
    trendChart = new TrendChart(trendCanvas, trendSummary);
  }

  async function loadDashboardData() {
    try {
      const [totalVideos, totalViews, storageBytes, top10, daily, monthly] = await Promise.all([
        getTotalVideos(),
        getTotalViews(),
        getStorageUsageBytes(),
        getTop10Videos(),
        getDailyViewsTrend(30),
        getMonthlyViewsTrend(12)
      ]);

      if (totalVideosEl) totalVideosEl.textContent = formatNumber(totalVideos);
      if (totalViewsEl) totalViewsEl.textContent = formatNumber(totalViews);
      if (storageUsageEl) storageUsageEl.textContent = formatBytes(storageBytes);

      if (topChart) {
        topChart.setData(top10);
      }

      dailyData = daily;
      monthlyData = monthly;

      if (trendChart) {
        trendChart.setData(currentTrendMode === 'day' ? dailyData : monthlyData, currentTrendMode);
      }
    } catch (err) {
      console.error('Failed to load dashboard statistics', err);
      showToast('Không thể tải dữ liệu thống kê từ SQLite.', 'error');
    }
  }

  if (btnTrendDay && btnTrendMonth) {
    btnTrendDay.addEventListener('click', () => {
      if (currentTrendMode === 'day') return;
      currentTrendMode = 'day';
      btnTrendDay.classList.add('active');
      btnTrendMonth.classList.remove('active');
      if (trendChart) trendChart.setData(dailyData, 'day');
    });

    btnTrendMonth.addEventListener('click', () => {
      if (currentTrendMode === 'month') return;
      currentTrendMode = 'month';
      btnTrendMonth.classList.add('active');
      btnTrendDay.classList.remove('active');
      if (trendChart) trendChart.setData(monthlyData, 'month');
    });
  }

  // Export DB button if available
  const exportVideosDbBtn = document.getElementById('exportVideosDbBtn');
  if (exportVideosDbBtn) {
    exportVideosDbBtn.addEventListener('click', async () => {
      try {
        const db = await getVideosDatabase();
        await exportDatabaseFile(db, 'videos.db');
        showToast('Đã xuất file videos.db thành công!', 'success');
      } catch (e) {
        showToast('Lỗi khi xuất file database', 'error');
      }
    });
  }

  await loadDashboardData();
}
