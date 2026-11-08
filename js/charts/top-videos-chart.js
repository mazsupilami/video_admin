/**
 * Top 10 Videos Vertical Column Bar Chart rendered using Canvas 2D API.
 */
import { formatNumber, truncateText } from '../core/formatters.js';

export class TopVideosChart {
  constructor(canvasElement, accessibleContainer) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.accessibleContainer = accessibleContainer;
    this.data = [];
    this.hoverIndex = -1;
    this.tooltip = null;

    this.initEvents();
  }

  setData(videosList) {
    this.data = videosList || [];
    this.renderAccessibleSummary();
    this.render();
  }

  initEvents() {
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseleave', () => this.handleMouseLeave());
    window.addEventListener('resize', () => this.render());
  }

  handleMouseMove(e) {
    if (!this.data || this.data.length === 0) return;
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    let foundIndex = -1;
    if (this.bars) {
      for (let i = 0; i < this.bars.length; i++) {
        const b = this.bars[i];
        if (mouseX >= b.x && mouseX <= b.x + b.w && mouseY >= b.y && mouseY <= b.y + b.h) {
          foundIndex = i;
          break;
        }
      }
    }

    if (foundIndex !== this.hoverIndex) {
      this.hoverIndex = foundIndex;
      this.render();
    }
  }

  handleMouseLeave() {
    if (this.hoverIndex !== -1) {
      this.hoverIndex = -1;
      this.render();
    }
  }

  render() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width || 600;
    const height = 320;

    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.ctx.resetTransform();
    this.ctx.scale(dpr, dpr);

    const ctx = this.ctx;
    ctx.clearRect(0, 0, width, height);

    if (!this.data || this.data.length === 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = '14px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Chưa có dữ liệu lượt xem video', width / 2, height / 2);
      return;
    }

    const padding = { top: 30, right: 20, bottom: 60, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Find max value
    const maxVal = Math.max(...this.data.map(d => d.views || 0), 10);
    const yMax = Math.ceil(maxVal * 1.15);

    // Draw Y grid lines and labels
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    const gridSteps = 4;
    for (let i = 0; i <= gridSteps; i++) {
      const val = Math.round((yMax / gridSteps) * i);
      const y = padding.top + chartHeight - (val / yMax) * chartHeight;

      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      ctx.fillText(formatNumber(val), padding.left - 10, y);
    }

    // Bars
    const barCount = this.data.length;
    const slotWidth = chartWidth / barCount;
    const barWidth = Math.min(48, Math.max(16, slotWidth * 0.55));
    this.bars = [];

    for (let i = 0; i < barCount; i++) {
      const item = this.data[i];
      const val = item.views || 0;
      const bHeight = Math.max(2, (val / yMax) * chartHeight);
      const bX = padding.left + i * slotWidth + (slotWidth - barWidth) / 2;
      const bY = padding.top + chartHeight - bHeight;

      this.bars.push({
        x: bX,
        y: bY,
        w: barWidth,
        h: bHeight,
        item
      });

      const isHovered = i === this.hoverIndex;

      // Bar fill with rounded top
      ctx.fillStyle = isHovered ? '#1d4ed8' : '#2563eb';
      drawRoundedRect(ctx, bX, bY, barWidth, bHeight, 6);

      // Value label on top of bar if space allows
      if (bHeight > 20) {
        ctx.fillStyle = '#475569';
        ctx.font = '600 11px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(formatNumber(val), bX + barWidth / 2, bY - 8);
      }

      // X Axis Label
      ctx.save();
      ctx.translate(bX + barWidth / 2, padding.top + chartHeight + 14);
      ctx.fillStyle = isHovered ? '#0f172a' : '#64748b';
      ctx.font = isHovered ? '600 11px Inter, system-ui, sans-serif' : '11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      const label = truncateText(item.title, 12);
      ctx.fillText(label, 0, 0);
      ctx.restore();
    }

    // Tooltip for hovered item
    if (this.hoverIndex >= 0 && this.hoverIndex < this.bars.length) {
      const b = this.bars[this.hoverIndex];
      const tooltipText = `${b.item.title}: ${formatNumber(b.item.views)} lượt xem`;

      ctx.font = '600 12px Inter, system-ui, sans-serif';
      const textMetrics = ctx.measureText(tooltipText);
      const tipWidth = textMetrics.width + 20;
      const tipHeight = 28;
      let tipX = b.x + b.w / 2 - tipWidth / 2;
      let tipY = b.y - 36;

      if (tipX < padding.left) tipX = padding.left;
      if (tipX + tipWidth > width - padding.right) tipX = width - padding.right - tipWidth;
      if (tipY < 10) tipY = b.y + 10;

      // Tooltip background
      ctx.fillStyle = '#0f172a';
      drawRoundedRect(ctx, tipX, tipY, tipWidth, tipHeight, 6);

      // Tooltip text
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tooltipText, tipX + tipWidth / 2, tipY + tipHeight / 2);
    }
  }

  renderAccessibleSummary() {
    if (!this.accessibleContainer) return;
    if (!this.data || this.data.length === 0) {
      this.accessibleContainer.innerHTML = '<p>Bảng tóm tắt: Chưa có dữ liệu video.</p>';
      return;
    }

    let html = '<table><caption>Top 10 video xem nhiều nhất</caption><thead><tr><th>Video</th><th>Lượt xem</th></tr></thead><tbody>';
    for (const v of this.data) {
      html += `<tr><td>${v.title}</td><td>${formatNumber(v.views)}</td></tr>`;
    }
    html += '</tbody></table>';
    this.accessibleContainer.innerHTML = html;
  }
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height);
  ctx.lineTo(x, y + height);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}
