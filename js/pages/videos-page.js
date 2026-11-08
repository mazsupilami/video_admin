/**
 * Videos Page Controller: CRUD, Filter, Search, Pagination, Preview, and SQLite Persistence.
 */
import { requireAuth } from '../core/router-guard.js';
import { initAppShell } from '../core/app-init.js';
import {
  getVideos,
  countVideos,
  getVideoById,
  createVideo,
  updateVideo,
  deleteVideo,
  getCategories,
  incrementDailyView,
  syncVideosFromSupabase
} from '../db/videos-repository.js';
import {
  saveMediaAsset,
  getMediaAsset,
  deleteMediaAsset
} from '../db/indexeddb-store.js';
import {
  formatNumber,
  formatDate,
  formatShortId,
  escapeHTML,
  debounce,
  copyToClipboard,
  showToast,
  openModal,
  closeModal
} from '../core/ui-utils.js';
import {
  validateVideoTitle,
  validateVideoDescription,
  validateDirectVideoUrl,
  validateVideoFile,
  validateThumbnailFile
} from '../core/validators.js';
import { getVideosDatabase } from '../db/sqlite-engine.js';
import { exportDatabaseFile } from '../db/persistence.js';

export async function initVideosPage() {
  const session = requireAuth();
  if (!session) return;

  initAppShell();

  // State
  let categories = [];
  let currentPage = 1;
  const itemsPerPage = 10;
  let currentSearch = '';
  let currentCategoryId = '';
  let currentStatus = '';
  let currentSort = 'created_desc';

  let editingVideoId = null;
  let activePreviewBlobUrl = null;
  let previewVideoId = null;
  let hasRegisteredViewThisSession = false;
  let videoToDeleteId = null;
  let isFormDirty = false;

  // DOM Elements
  const videosTableBody = document.getElementById('videosTableBody');
  const searchInput = document.getElementById('searchInput');
  const categoryFilter = document.getElementById('categoryFilter');
  const statusFilter = document.getElementById('statusFilter');
  const sortFilter = document.getElementById('sortFilter');
  const resetFiltersBtn = document.getElementById('resetFiltersBtn');
  const paginationInfo = document.getElementById('paginationInfo');
  const prevPageBtn = document.getElementById('prevPageBtn');
  const nextPageBtn = document.getElementById('nextPageBtn');
  const openAddVideoBtn = document.getElementById('openAddVideoBtn');
  const exportVideosDbBtn = document.getElementById('exportVideosDbBtn');

  // Video Form Modal Elements
  const videoModal = document.getElementById('videoModal');
  const videoModalTitle = document.getElementById('videoModalTitle');
  const videoForm = document.getElementById('videoForm');
  const videoFormAlert = document.getElementById('videoFormAlert');
  const formVideoTitle = document.getElementById('formVideoTitle');
  const formVideoDesc = document.getElementById('formVideoDesc');
  const formStatus = document.getElementById('formStatus');
  const formCategoriesContainer = document.getElementById('formCategoriesContainer');
  const formSourceLocal = document.getElementById('formSourceLocal');
  const formSourceUrl = document.getElementById('formSourceUrl');
  const localFileGroup = document.getElementById('localFileGroup');
  const urlGroup = document.getElementById('urlGroup');
  const formVideoFile = document.getElementById('formVideoFile');
  const formVideoUrl = document.getElementById('formVideoUrl');
  const formThumbnailFile = document.getElementById('formThumbnailFile');
  const formThumbnailUrl = document.getElementById('formThumbnailUrl');
  const saveVideoBtn = document.getElementById('saveVideoBtn');
  const cancelVideoBtn = document.getElementById('cancelVideoBtn');
  const closeVideoModalBtn = document.getElementById('closeVideoModalBtn');

  // Delete Modal Elements
  const deleteModal = document.getElementById('deleteModal');
  const deleteVideoTitle = document.getElementById('deleteVideoTitle');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
  const closeDeleteModalBtn = document.getElementById('closeDeleteModalBtn');

  // Preview Modal Elements
  const previewModal = document.getElementById('previewModal');
  const previewPlayer = document.getElementById('previewPlayer');
  const previewModalTitle = document.getElementById('previewModalTitle');
  const previewVideoMeta = document.getElementById('previewVideoMeta');
  const previewErrorMessage = document.getElementById('previewErrorMessage');
  const closePreviewModalBtn = document.getElementById('closePreviewModalBtn');

  // Load Categories
  try {
    categories = await getCategories();
    populateCategoryDropdowns();
  } catch (err) {
    console.error('Failed to load categories', err);
    showToast('Không thể tải danh mục video.', 'error');
  }

  function populateCategoryDropdowns() {
    if (categoryFilter) {
      categoryFilter.innerHTML = '<option value="">Tất cả danh mục</option>' +
        categories.map(c => `<option value="${escapeHTML(c.id)}">${escapeHTML(c.name)}</option>`).join('');
    }

    if (formCategoriesContainer) {
      formCategoriesContainer.innerHTML = categories.map(c => `
        <label class="category-chip-toggle" data-cat-id="${escapeHTML(c.id)}">
          <input type="checkbox" name="categories" value="${escapeHTML(c.id)}" style="display:none;">
          <span>${escapeHTML(c.name)}</span>
        </label>
      `).join('');

      formCategoriesContainer.querySelectorAll('.category-chip-toggle').forEach(chip => {
        chip.addEventListener('click', () => {
          const cb = chip.querySelector('input');
          cb.checked = !cb.checked;
          chip.classList.toggle('selected', cb.checked);
          isFormDirty = true;
        });
      });
    }
  }

  // Load and Render Videos
  async function loadVideos() {
    if (!videosTableBody) return;

    videosTableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-secondary);">
          Đang tải danh sách video...
        </td>
      </tr>
    `;

    try {
      const [totalCount, videos] = await Promise.all([
        countVideos({
          search: currentSearch,
          categoryId: currentCategoryId,
          status: currentStatus
        }),
        getVideos({
          search: currentSearch,
          categoryId: currentCategoryId,
          status: currentStatus,
          sort: currentSort,
          page: currentPage,
          limit: itemsPerPage
        })
      ]);

      renderTable(videos, totalCount);
      updatePagination(totalCount);
    } catch (err) {
      console.error('Error fetching videos', err);
      videosTableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 30px; color: var(--danger);">
            Lỗi khi truy vấn SQLite: ${escapeHTML(err.message)}
          </td>
        </tr>
      `;
    }
  }

  async function renderTable(videos, totalCount) {
    if (!videosTableBody) return;

    if (!videos || videos.length === 0) {
      videosTableBody.innerHTML = `
        <tr>
          <td colspan="6">
            <div class="empty-state">
              <img src="assets/images/empty-state.svg" alt="Empty" width="120" style="margin-bottom: 12px;" />
              <div class="empty-state-title">Không tìm thấy video nào</div>
              <div class="empty-state-desc">Hãy thử thay đổi điều kiện tìm kiếm hoặc bấm Thêm video mới.</div>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    videosTableBody.innerHTML = '';

    for (const v of videos) {
      const tr = document.createElement('tr');

      // Resolve thumbnail URL / Blob
      let thumbSrc = 'assets/images/placeholder-thumbnail.svg';
      if (v.thumbnail_url) {
        thumbSrc = v.thumbnail_url;
      } else if (v.thumbnail_asset_id) {
        try {
          const asset = await getMediaAsset(v.thumbnail_asset_id);
          if (asset && asset.blob) {
            thumbSrc = URL.createObjectURL(asset.blob);
          }
        } catch (e) {
          console.warn('Error loading thumbnail asset', e);
        }
      }

      // Status Badge
      let statusBadge = '';
      if (v.status === 'published') {
        statusBadge = '<span class="badge badge-published">Công khai</span>';
      } else if (v.status === 'archived') {
        statusBadge = '<span class="badge badge-archived">Lưu trữ</span>';
      } else {
        statusBadge = '<span class="badge badge-draft">Bản nháp</span>';
      }

      // Demo Badge
      const demoBadge = v.is_demo === 1 ? '<span class="badge badge-demo">Demo</span>' : '';

      // Source type label
      const sourceBadge = v.source_type === 'local'
        ? '<span class="badge badge-source">Tệp cục bộ</span>'
        : '<span class="badge badge-source">URL trực tiếp</span>';

      // Categories HTML
      const catTags = (v.categories && v.categories.length > 0)
        ? v.categories.map(c => `<span class="badge" style="background:#f1f5f9;color:#334155;">${escapeHTML(c.name)}</span>`).join(' ')
        : '<span style="color:var(--text-muted);font-size:0.8125rem;">—</span>';

      tr.innerHTML = `
        <td>
          <span class="video-id-badge" title="Bấm để sao chép toàn bộ ID" data-copy-id="${escapeHTML(v.id)}">
            #${escapeHTML(formatShortId(v.id))}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          </span>
        </td>
        <td>
          <div class="video-cell">
            <div class="video-thumb-preview">
              <img src="${escapeHTML(thumbSrc)}" alt="${escapeHTML(v.title)}" loading="lazy" onerror="this.src='assets/images/placeholder-thumbnail.svg'" />
            </div>
            <div class="video-meta-col">
              <div class="video-table-title">${escapeHTML(v.title)}</div>
              <div style="display:flex;gap:6px;align-items:center;">
                ${sourceBadge}
                ${demoBadge}
                <span style="font-size:0.75rem;color:var(--text-secondary);">${escapeHTML(formatDate(v.created_at))}</span>
              </div>
            </div>
          </div>
        </td>
        <td>${catTags}</td>
        <td><strong>${formatNumber(v.views)}</strong></td>
        <td>${statusBadge}</td>
        <td>
          <div class="page-actions" style="gap:4px;">
            <button class="btn btn-icon btn-preview" title="Xem trước video" data-id="${escapeHTML(v.id)}" aria-label="Xem trước video ${escapeHTML(v.title)}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            </button>
            <button class="btn btn-icon btn-edit" title="Chỉnh sửa" data-id="${escapeHTML(v.id)}" aria-label="Chỉnh sửa video ${escapeHTML(v.title)}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
            </button>
            <button class="btn btn-icon danger btn-delete" title="Xóa video" data-id="${escapeHTML(v.id)}" data-title="${escapeHTML(v.title)}" aria-label="Xóa video ${escapeHTML(v.title)}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </td>
      `;

      videosTableBody.appendChild(tr);
    }

    // Attach event listeners for row actions
    videosTableBody.querySelectorAll('.video-id-badge').forEach(badge => {
      badge.addEventListener('click', async () => {
        const fullId = badge.getAttribute('data-copy-id');
        const ok = await copyToClipboard(fullId);
        if (ok) showToast('Đã chép mã ID video vào bộ nhớ tạm!', 'success');
      });
    });

    videosTableBody.querySelectorAll('.btn-preview').forEach(btn => {
      btn.addEventListener('click', () => openPreviewModal(btn.getAttribute('data-id')));
    });

    videosTableBody.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', () => openEditModal(btn.getAttribute('data-id')));
    });

    videosTableBody.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        videoToDeleteId = btn.getAttribute('data-id');
        const title = btn.getAttribute('data-title');
        if (deleteVideoTitle) deleteVideoTitle.textContent = title;
        openModal('deleteModal');
      });
    });
  }

  function updatePagination(totalCount) {
    if (!paginationInfo || !prevPageBtn || !nextPageBtn) return;

    const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));
    const startItem = totalCount === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalCount);

    paginationInfo.textContent = `Hiển thị ${formatNumber(startItem)}–${formatNumber(endItem)} / ${formatNumber(totalCount)} video`;

    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= totalPages;
  }

  // Filter & Search Events
  if (searchInput) {
    searchInput.addEventListener('input', debounce((e) => {
      currentSearch = e.target.value.trim();
      currentPage = 1;
      loadVideos();
    }, 300));
  }

  if (categoryFilter) {
    categoryFilter.addEventListener('change', (e) => {
      currentCategoryId = e.target.value;
      currentPage = 1;
      loadVideos();
    });
  }

  if (statusFilter) {
    statusFilter.addEventListener('change', (e) => {
      currentStatus = e.target.value;
      currentPage = 1;
      loadVideos();
    });
  }

  if (sortFilter) {
    sortFilter.addEventListener('change', (e) => {
      currentSort = e.target.value;
      currentPage = 1;
      loadVideos();
    });
  }

  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener('click', () => {
      currentSearch = '';
      currentCategoryId = '';
      currentStatus = '';
      currentSort = 'created_desc';

      if (searchInput) searchInput.value = '';
      if (categoryFilter) categoryFilter.value = '';
      if (statusFilter) statusFilter.value = '';
      if (sortFilter) sortFilter.value = 'created_desc';

      currentPage = 1;
      loadVideos();
    });
  }

  if (prevPageBtn) {
    prevPageBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        loadVideos();
      }
    });
  }

  if (nextPageBtn) {
    nextPageBtn.addEventListener('click', () => {
      currentPage++;
      loadVideos();
    });
  }

  // Source Type Radio Switch
  function updateSourceTypeUI() {
    const isLocal = formSourceLocal.checked;
    if (localFileGroup) localFileGroup.style.display = isLocal ? 'block' : 'none';
    if (urlGroup) urlGroup.style.display = isLocal ? 'none' : 'block';
  }

  if (formSourceLocal) formSourceLocal.addEventListener('change', updateSourceTypeUI);
  if (formSourceUrl) formSourceUrl.addEventListener('change', updateSourceTypeUI);

  // Add Video Button
  if (openAddVideoBtn) {
    openAddVideoBtn.addEventListener('click', () => {
      editingVideoId = null;
      isFormDirty = false;
      if (videoModalTitle) videoModalTitle.textContent = 'Thêm video mới';
      if (videoForm) videoForm.reset();
      if (videoFormAlert) {
        videoFormAlert.textContent = '';
        videoFormAlert.style.display = 'none';
      }

      // Reset category chips
      if (formCategoriesContainer) {
        formCategoriesContainer.querySelectorAll('.category-chip-toggle').forEach(chip => {
          chip.classList.remove('selected');
          const cb = chip.querySelector('input');
          if (cb) cb.checked = false;
        });
      }

      formSourceUrl.checked = true;
      updateSourceTypeUI();
      openModal('videoModal');
    });
  }

  // Edit Video Modal
  async function openEditModal(videoId) {
    editingVideoId = videoId;
    isFormDirty = false;
    if (videoModalTitle) videoModalTitle.textContent = 'Chỉnh sửa video';
    if (videoFormAlert) {
      videoFormAlert.textContent = '';
      videoFormAlert.style.display = 'none';
    }

    try {
      const video = await getVideoById(videoId);
      if (!video) {
        showToast('Không tìm thấy thông tin video', 'error');
        return;
      }

      formVideoTitle.value = video.title || '';
      formVideoDesc.value = video.description || '';
      formStatus.value = video.status || 'draft';

      if (video.source_type === 'local') {
        formSourceLocal.checked = true;
      } else {
        formSourceUrl.checked = true;
        formVideoUrl.value = video.video_url || '';
      }
      updateSourceTypeUI();

      if (video.thumbnail_url) {
        formThumbnailUrl.value = video.thumbnail_url;
      } else {
        formThumbnailUrl.value = '';
      }

      // Set Categories
      const selectedCatIds = new Set(video.categoryIds || []);
      if (formCategoriesContainer) {
        formCategoriesContainer.querySelectorAll('.category-chip-toggle').forEach(chip => {
          const catId = chip.getAttribute('data-cat-id');
          const isSelected = selectedCatIds.has(catId);
          chip.classList.toggle('selected', isSelected);
          const cb = chip.querySelector('input');
          if (cb) cb.checked = isSelected;
        });
      }

      openModal('videoModal');
    } catch (err) {
      console.error('Error loading video for edit', err);
      showToast('Lỗi khi tải thông tin video', 'error');
    }
  }

  // Dirty state tracking on form inputs
  if (videoForm) {
    videoForm.addEventListener('input', () => { isFormDirty = true; });
  }

  function handleCloseVideoModal() {
    if (isFormDirty) {
      const confirmLeave = confirm('Bạn có thay đổi chưa lưu. Bạn có chắc muốn đóng form?');
      if (!confirmLeave) return;
    }
    isFormDirty = false;
    closeModal('videoModal');
  }

  if (cancelVideoBtn) cancelVideoBtn.addEventListener('click', handleCloseVideoModal);
  if (closeVideoModalBtn) closeVideoModalBtn.addEventListener('click', handleCloseVideoModal);

  // Video Form Submission
  if (videoForm) {
    videoForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (videoFormAlert) {
        videoFormAlert.textContent = '';
        videoFormAlert.style.display = 'none';
      }

      const title = formVideoTitle.value.trim();
      const desc = formVideoDesc.value.trim();
      const status = formStatus.value;
      const sourceType = formSourceLocal.checked ? 'local' : 'url';

      // Validation
      const errTitle = validateVideoTitle(title);
      if (errTitle) {
        showFormError(errTitle);
        formVideoTitle.focus();
        return;
      }

      const errDesc = validateVideoDescription(desc);
      if (errDesc) {
        showFormError(errDesc);
        formVideoDesc.focus();
        return;
      }

      // Selected category IDs
      const selectedCatIds = [];
      if (formCategoriesContainer) {
        formCategoriesContainer.querySelectorAll('.category-chip-toggle.selected').forEach(chip => {
          selectedCatIds.push(chip.getAttribute('data-cat-id'));
        });
      }

      if (status === 'published' && selectedCatIds.length === 0) {
        showFormError('Video ở trạng thái Công khai phải có ít nhất 1 danh mục.');
        return;
      }

      // Source validation
      let videoUrl = null;
      let videoAssetId = null;
      let newVideoAssetCreated = false;

      if (sourceType === 'url') {
        const urlVal = formVideoUrl.value.trim();
        const errUrl = validateDirectVideoUrl(urlVal);
        if (errUrl) {
          showFormError(errUrl);
          formVideoUrl.focus();
          return;
        }
        videoUrl = urlVal;
      } else {
        // Local file
        const file = formVideoFile.files[0];
        if (!file && !editingVideoId) {
          showFormError('Vui lòng chọn tệp video cục bộ.');
          return;
        }

        if (file) {
          const errFile = validateVideoFile(file);
          if (errFile) {
            showFormError(errFile);
            return;
          }

          try {
            videoAssetId = crypto.randomUUID();
            await saveMediaAsset(videoAssetId, file, file.name, file.type);
            newVideoAssetCreated = true;
          } catch (storageErr) {
            showFormError(storageErr.message || 'Lỗi khi lưu trữ tệp vào IndexedDB.');
            return;
          }
        }
      }

      // Thumbnail handling
      let thumbnailUrl = formThumbnailUrl.value.trim() || null;
      let thumbnailAssetId = null;
      let newThumbAssetCreated = false;

      const thumbFile = formThumbnailFile.files[0];
      if (thumbFile) {
        const errThumb = validateThumbnailFile(thumbFile);
        if (errThumb) {
          showFormError(errThumb);
          return;
        }

        try {
          thumbnailAssetId = crypto.randomUUID();
          await saveMediaAsset(thumbnailAssetId, thumbFile, thumbFile.name, thumbFile.type);
          newThumbAssetCreated = true;
          thumbnailUrl = null; // Prioritize local blob
        } catch (storageErr) {
          showFormError(storageErr.message || 'Lỗi khi lưu trữ ảnh bìa.');
          return;
        }
      }

      saveVideoBtn.disabled = true;
      saveVideoBtn.textContent = 'Đang lưu...';

      try {
        if (editingVideoId) {
          // If editing and no new asset chosen, keep existing asset
          const existing = await getVideoById(editingVideoId);
          if (sourceType === 'local' && !videoAssetId) {
            videoAssetId = existing.video_asset_id;
          }
          if (!thumbnailAssetId && !thumbnailUrl) {
            thumbnailAssetId = existing.thumbnail_asset_id;
            thumbnailUrl = existing.thumbnail_url;
          }

          await updateVideo(editingVideoId, {
            title,
            description: desc,
            status,
            sourceType,
            videoUrl,
            videoAssetId,
            thumbnailUrl,
            thumbnailAssetId,
            categoryIds: selectedCatIds
          });
          showToast('Đã cập nhật video thành công!', 'success');
        } else {
          await createVideo({
            title,
            description: desc,
            status,
            sourceType,
            videoUrl,
            videoAssetId,
            thumbnailUrl,
            thumbnailAssetId,
            categoryIds: selectedCatIds,
            isDemo: false
          });
          showToast('Đã thêm video mới thành công!', 'success');
        }

        isFormDirty = false;
        closeModal('videoModal');
        await loadVideos();
      } catch (err) {
        console.error('Failed to save video', err);
        // Best effort cleanup if insert/persist failed
        if (newVideoAssetCreated && videoAssetId) {
          try { await deleteMediaAsset(videoAssetId); } catch (e) {}
        }
        if (newThumbAssetCreated && thumbnailAssetId) {
          try { await deleteMediaAsset(thumbnailAssetId); } catch (e) {}
        }
        showFormError('Lỗi khi ghi dữ liệu SQLite: ' + err.message);
      } finally {
        saveVideoBtn.disabled = false;
        saveVideoBtn.textContent = 'Lưu video';
      }
    });
  }

  function showFormError(msg) {
    if (videoFormAlert) {
      videoFormAlert.textContent = msg;
      videoFormAlert.style.display = 'block';
    } else {
      showToast(msg, 'error');
    }
  }

  // Delete Video Modal
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', async () => {
      if (!videoToDeleteId) return;

      confirmDeleteBtn.disabled = true;
      confirmDeleteBtn.textContent = 'Đang xóa...';

      try {
        await deleteVideo(videoToDeleteId);
        showToast('Đã xóa video thành công!', 'success');
        closeModal('deleteModal');

        // Check if we need to adjust page
        const count = await countVideos({
          search: currentSearch,
          categoryId: currentCategoryId,
          status: currentStatus
        });
        const maxPages = Math.max(1, Math.ceil(count / itemsPerPage));
        if (currentPage > maxPages) {
          currentPage = maxPages;
        }

        await loadVideos();
      } catch (err) {
        console.error('Error deleting video', err);
        showToast('Lỗi khi xóa video: ' + err.message, 'error');
      } finally {
        confirmDeleteBtn.disabled = false;
        confirmDeleteBtn.textContent = 'Xóa video';
        videoToDeleteId = null;
      }
    });
  }

  if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener('click', () => closeModal('deleteModal'));
  }
  if (closeDeleteModalBtn) {
    closeDeleteModalBtn.addEventListener('click', () => closeModal('deleteModal'));
  }

  // Preview Video Modal
  async function openPreviewModal(videoId) {
    previewVideoId = videoId;
    hasRegisteredViewThisSession = false;

    if (activePreviewBlobUrl) {
      URL.revokeObjectURL(activePreviewBlobUrl);
      activePreviewBlobUrl = null;
    }

    if (previewErrorMessage) previewErrorMessage.style.display = 'none';
    if (previewPlayer) {
      previewPlayer.src = '';
      previewPlayer.load();
    }

    try {
      const video = await getVideoById(videoId);
      if (!video) {
        showToast('Không tìm thấy thông tin video', 'error');
        return;
      }

      if (previewModalTitle) previewModalTitle.textContent = video.title;
      if (previewVideoMeta) {
        const catNames = (video.categories || []).map(c => c.name).join(', ') || 'Chưa phân loại';
        previewVideoMeta.textContent = `Danh mục: ${catNames} · Lượt xem: ${formatNumber(video.views)}`;
      }

      let playableSrc = null;

      if (video.source_type === 'local') {
        const asset = await getMediaAsset(video.video_asset_id);
        if (asset && asset.blob) {
          activePreviewBlobUrl = URL.createObjectURL(asset.blob);
          playableSrc = activePreviewBlobUrl;
        } else {
          throw new Error('Tệp video cục bộ không tồn tại trong IndexedDB.');
        }
      } else {
        if (!video.video_url) {
          throw new Error('Video demo chưa có nguồn phát.');
        }
        playableSrc = video.video_url;
      }

      if (previewPlayer && playableSrc) {
        previewPlayer.src = playableSrc;
        previewPlayer.style.display = 'block';
      }

      openModal('previewModal');
    } catch (err) {
      console.warn('Error launching preview player', err);
      if (previewErrorMessage) {
        previewErrorMessage.textContent = err.message || 'Không thể phát video này.';
        previewErrorMessage.style.display = 'block';
      }
      if (previewPlayer) previewPlayer.style.display = 'none';
      openModal('previewModal');
    }
  }

  // Handle first 'playing' event for local view count registration
  if (previewPlayer) {
    previewPlayer.addEventListener('playing', async () => {
      if (!hasRegisteredViewThisSession && previewVideoId) {
        hasRegisteredViewThisSession = true;
        try {
          await incrementDailyView(previewVideoId);
          console.log(`Registered local view for video ${previewVideoId}`);
          // Update meta
          const updated = await getVideoById(previewVideoId);
          if (updated && previewVideoMeta) {
            const catNames = (updated.categories || []).map(c => c.name).join(', ') || 'Chưa phân loại';
            previewVideoMeta.textContent = `Danh mục: ${catNames} · Lượt xem: ${formatNumber(updated.views)}`;
          }
        } catch (err) {
          console.warn('Failed to increment daily view', err);
        }
      }
    });

    previewPlayer.addEventListener('error', (e) => {
      console.warn('Video playback error', e);
      if (previewErrorMessage) {
        previewErrorMessage.textContent = 'Trình duyệt không thể phát video từ nguồn này (codec không hỗ trợ hoặc lỗi đường truyền).';
        previewErrorMessage.style.display = 'block';
      }
    });
  }

  function handleClosePreviewModal() {
    if (previewPlayer) {
      previewPlayer.pause();
      previewPlayer.src = '';
    }
    if (activePreviewBlobUrl) {
      URL.revokeObjectURL(activePreviewBlobUrl);
      activePreviewBlobUrl = null;
    }
    previewVideoId = null;
    closeModal('previewModal');
    // Refresh table to reflect any new views
    loadVideos();
  }

  if (closePreviewModalBtn) {
    closePreviewModalBtn.addEventListener('click', handleClosePreviewModal);
  }

  // Export DB button
  if (exportVideosDbBtn) {
    exportVideosDbBtn.addEventListener('click', async () => {
      try {
        const db = await getVideosDatabase();
        await exportDatabaseFile(db, 'videos.db');
        showToast('Đã xuất file videos.db thành công!', 'success');
      } catch (err) {
        showToast('Lỗi khi xuất file database: ' + err.message, 'error');
      }
    });
  }

  // Initial Load
  await loadVideos();

  // Sync latest updates from Supabase in background
  syncVideosFromSupabase().then(updated => {
    if (updated) loadVideos();
  }).catch(e => console.warn('[Supabase Sync initial error]', e));
}
