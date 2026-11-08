/**
 * Daily and Monthly View Trends Line Chart rendered using Canvas 2D API.
 */
import { formatNumber } from '../core/formatters.js';

export class TrendChart {
  constructor(canvasElement, accessibleContainer) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.accessibleContainer = accessibleContainer;
    this.data = [];
    this.hoverIndex = -1;
    this.mode = 'day'; // 'day' | 'month'

    this.initEvents();
  }

  setData(dataList, mode = 'day') {
    this.data = dataList || [];
    this.mode = mode;
    this.renderAccessibleSummary();
    this.render();
  }

  initEvents() {
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseleave', () => this.handleMouseLeave());
    window.addEventListener('resize', () => this.render());
  }

  handleMouseMove(e) {
    if (!this.points || this.points.length === 0) return;
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    let closestDist = Infinity;
    let closestIdx = -1;

    for (let i = 0; i < this.points.length; i++) {
      const p = this.points[i];
      const dist = Math.abs(mouseX - p.x);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    }

    if (closestDist < 30 && closestIdx !== this.hoverIndex) {
      this.hoverIndex = closestIdx;
      this.render();
    } else if (closestDist >= 30 && this.hoverIndex !== -1) {
      this.hoverIndex = -1;
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
    const width = rect.width || 800;
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
      ctx.fillText('Chưa có dữ liệu xu hướng', width / 2, height / 2);
      return;
    }

    const padding = { top: 30, right: 24, bottom: 45, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const maxVal = Math.max(...this.data.map(d => d.views || 0), 10);
    const yMax = Math.ceil(maxVal * 1.15);

    // Draw horizontal grid lines
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

    // Calculate coordinates
    const count = this.data.length;
    const stepX = count > 1 ? chartWidth / (count - 1) : chartWidth;
    this.points = [];

    for (let i = 0; i < count; i++) {
      const item = this.data[i];
      const x = padding.left + i * stepX;
      const y = padding.top + chartHeight - ((item.views || 0) / yMax) * chartHeight;
      this.points.push({ x, y, item, index: i });
    }

    // Gradient fill under the line
    const grad = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
    grad.addColorStop(0, 'rgba(37, 99, 235, 0.22)');
    grad.addColorStop(1, 'rgba(37, 99, 235, 0.00)');

    ctx.beginPath();
    ctx.moveTo(this.points[0].x, padding.top + chartHeight);
    for (let i = 0; i < count; i++) {
      ctx.lineTo(this.points[i].x, this.points[i].y);
    }
    ctx.lineTo(this.points[count - 1].x, padding.top + chartHeight);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Draw main line
    ctx.beginPath();
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    for (let i = 0; i < count; i++) {
      if (i === 0) {
        ctx.moveTo(this.points[i].x, this.points[i].y);
      } else {
        ctx.lineTo(this.points[i].x, this.points[i].y);
      }
    }
    ctx.stroke();

    // Draw X-axis labels (skip intervals to avoid overlap if 30 days)
    const labelInterval = count > 15 ? 4 : 1;
    ctx.fillStyle = '#64748b';
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let i = 0; i < count; i++) {
      if (i % labelInterval === 0 || i === count - 1) {
        const p = this.points[i];
        ctx.fillText(p.item.label, p.x, padding.top + chartHeight + 10);
      }
    }

    // Draw points (if less than 20 or hovered)
    for (let i = 0; i < count; i++) {
      const p = this.points[i];
      const isHovered = i === this.hoverIndex;

      if (count <= 15 || isHovered) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, isHovered ? 6 : 4, 0, Math.PI * 2);
        ctx.fillStyle = isHovered ? '#1d4ed8' : '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Draw tooltip
    if (this.hoverIndex >= 0 && this.hoverIndex < this.points.length) {
      const p = this.points[this.hoverIndex];

      // Vertical guide line
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x, padding.top);
      ctx.lineTo(p.x, padding.top + chartHeight);
      ctx.stroke();
      ctx.restore();

      const timeText = this.mode === 'day' ? `Ngày ${p.item.label}` : `Tháng ${p.item.label}`;
      const viewsText = `${formatNumber(p.item.views)} lượt xem`;
      const tipFullText = `${timeText}: ${viewsText}`;

      ctx.font = '600 12px Inter, system-ui, sans-serif';
      const tipWidth = ctx.measureText(tipFullText).width + 20;
      const tipHeight = 28;
      let tipX = p.x - tipWidth / 2;
      let tipY = p.y - 38;

      if (tipX < padding.left) tipX = padding.left;
      if (tipX + tipWidth > width - padding.right) tipX = width - padding.right - tipWidth;
      if (tipY < 8) tipY = p.y + 12;

      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(tipX, tipY, tipWidth, tipHeight, 6) : ctx.rect(tipX, tipY, tipWidth, tipHeight);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tipFullText, tipX + tipWidth / 2, tipY + tipHeight / 2);
    }
  }

  renderAccessibleSummary() {
    if (!this.accessibleContainer) return;
    if (!this.data || this.data.length === 0) {
      this.accessibleContainer.innerHTML = '<p>Bảng tóm tắt: Chưa có dữ liệu xu hướng.</p>';
      return;
    }

    const title = this.mode === 'day' ? 'Xu hướng 30 ngày gần nhất' : 'Xu hướng 12 tháng gần nhất';
    let html = `<table><caption>${title}</caption><thead><tr><th>Thời gian</th><th>Lượt xem</th></tr></thead><tbody>`;
    for (const d of this.data) {
      html += `<tr><td>${d.label}</td><td>${formatNumber(d.views)}</td></tr>`;
    }
    html += '</tbody></table>';
    this.accessibleContainer.innerHTML = html;
  }
}
