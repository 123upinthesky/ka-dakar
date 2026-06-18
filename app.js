const source = window.AUTO_RU_REPORT_DATA;
const months = source.months;
const reportDealer = source.reportDealer;
const brandData = source.brandData;
const brandNames = Object.keys(brandData);

let activeBrand = brandNames[0];

const rub = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

function activeDealerName(data) {
  return data.dealer || reportDealer;
}

function activeDealerAliases(data) {
  return [data.dealer, ...(data.dealerAliases || []), reportDealer].filter(Boolean);
}

function isReportDealer(name, dealerName) {
  const aliases = Array.isArray(dealerName) ? dealerName : [dealerName, reportDealer].filter(Boolean);
  const normalizedName = name.toLowerCase();
  return aliases.some((alias) => name === alias || normalizedName.includes(alias.toLowerCase()));
}

function sortedRows(rows) {
  return [...rows].sort((a, b) => b.value - a.value);
}

function displayRows(rows, dealerName, limit = 12) {
  const sorted = sortedRows(rows);
  const head = sorted.slice(0, limit);
  const dealerRows = sorted.filter((row) => isReportDealer(row.name, dealerName));
  for (const row of dealerRows) {
    if (!head.some((item) => item.name === row.name)) head.push(row);
  }
  return head;
}

function dealerMetricByMonth(rowsByMonth, dealerName) {
  return months.map((_, index) =>
    (rowsByMonth[index] || []).reduce((sum, row) => (isReportDealer(row.name, dealerName) ? sum + row.value : sum), 0),
  );
}

function makeBarDistribution(title, rows, unit, dealerName) {
  const height = 470;
  const padding = { top: 28, right: 34, bottom: 96, left: 54 };
  const labelLines = rows.map((row) => wrapDealerName(row.name));
  const baseSlotWidths = labelLines.map((lines) => {
    const longestLine = Math.max(...lines.map((line) => line.length), 1);
    return Math.max(112, longestLine * 6.4 + 24);
  });
  const minimumInnerWidth = 620 - padding.left - padding.right;
  const baseInnerWidth = baseSlotWidths.reduce((sum, slotWidth) => sum + slotWidth, 0);
  const extraSlotWidth = rows.length ? Math.max(0, (minimumInnerWidth - baseInnerWidth) / rows.length) : 0;
  const slotWidths = baseSlotWidths.map((slotWidth) => slotWidth + extraSlotWidth);
  const width = Math.max(620, padding.left + padding.right + slotWidths.reduce((sum, slotWidth) => sum + slotWidth, 0));
  const values = rows.map((row) => row.value);
  const max = Math.max(1, ...values) * 1.12;
  const plotBottom = height - padding.bottom;
  const barWidth = 64;
  const y = (value) => padding.top + (height - padding.top - padding.bottom) * (1 - value / max);
  let slotOffset = padding.left;
  const bars = rows
    .map((row, index) => {
      const slotWidth = slotWidths[index];
      const labelX = slotOffset + slotWidth / 2;
      const barX = labelX - barWidth / 2;
      const barY = y(row.value);
      const barHeight = plotBottom - barY;
      const isDealer = isReportDealer(row.name, dealerName);
      slotOffset += slotWidth;
      return `
        <rect class="${isDealer ? "bar-red" : "bar-black"}" x="${barX}" y="${barY}" width="${barWidth}" height="${barHeight}" rx="4"></rect>
        <text class="dealer-label" x="${labelX}" y="${plotBottom + 24}" text-anchor="middle"><title>${escapeSvg(row.name)}</title>${svgWrappedName(labelLines[index], labelX)}</text>
        <text class="value-label" x="${labelX}" y="${barY - 9}" text-anchor="middle">${rub.format(row.value)}</text>
      `;
    })
    .join("");

  return `
    <article class="chart-card">
      <div class="chart-title">${title}<span>${unit}</span></div>
      <div class="bar-chart-scroll">
        <svg class="bar-chart" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="width: ${width}px" role="img" aria-label="${title}">
          ${grid(width, height, padding)}
          ${bars}
        </svg>
      </div>
    </article>
  `;
}

function makeComboCplChart(title, costValues, countValues, lineClass) {
  const width = 620;
  const height = 500;
  const padding = { top: 54, right: 30, bottom: 30, left: 48 };
  const safe = 18;
  const costPlot = { top: 88, bottom: 242 };
  const countPlot = { top: 322, bottom: 470 };
  const costs = costValues.map((value) => value || 0);
  const counts = countValues.map((value) => value || 0);
  const maxCost = Math.max(1, ...costs) * 1.12;
  const maxCount = Math.max(1, ...counts) * 1.18;
  const stepX = months.length > 1 ? (width - padding.left - padding.right) / (months.length - 1) : 0;
  const x = (index) => padding.left + index * stepX;
  const yCost = (value) => costPlot.top + (costPlot.bottom - costPlot.top) * (1 - value / maxCost);
  const yCount = (value) => countPlot.top + (countPlot.bottom - countPlot.top) * (1 - value / maxCount);
  const costPoints = costs.map((value, index) => `${x(index)},${yCost(value)}`).join(" ");
  const countPoints = counts.map((value, index) => `${x(index)},${yCount(value)}`).join(" ");
  const plotRight = width - padding.right;
  const costAxis = [0, 0.5, 1]
    .map((ratio) => {
      const axisY = costPlot.top + (costPlot.bottom - costPlot.top) * (1 - ratio);
      return `
        <text class="tick" x="${padding.left - 10}" y="${axisY + 4}" text-anchor="end">${rub.format(maxCost * ratio)}</text>
        <line class="grid-line" x1="${padding.left}" x2="${plotRight}" y1="${axisY}" y2="${axisY}"></line>
      `;
    })
    .join("");
  const countAxis = [0, 0.5, 1]
    .map((ratio) => {
      const axisY = countPlot.top + (countPlot.bottom - countPlot.top) * (1 - ratio);
      return `
        <text class="tick" x="${padding.left - 10}" y="${axisY + 4}" text-anchor="end">${rub.format(maxCount * ratio)}</text>
        <line class="grid-line" x1="${padding.left}" x2="${plotRight}" y1="${axisY}" y2="${axisY}"></line>
      `;
    })
    .join("");
  const pointLabel = ({ text, xValue, yValue, plot, className, index, total }) => {
    let labelX = xValue;
    let labelY = yValue - 16;
    let anchor = "middle";
    if (yValue - 20 < plot.top + safe) labelY = yValue + 22;
    if (labelY > plot.bottom - safe) labelY = yValue - 18;
    if (xValue < padding.left + 72) {
      labelX = xValue + 14;
      anchor = "start";
    } else if (xValue > plotRight - 72) {
      labelX = xValue - 14;
      anchor = "end";
    } else {
      labelX = xValue + (index % 2 === 0 ? -12 : 12);
      labelY += index % 2 === 0 ? -4 : 4;
    }
    if (total > 2 && index > 0 && index < total - 1) labelY += index % 2 === 0 ? -14 : 14;
    labelY = Math.max(plot.top + safe, Math.min(plot.bottom - safe, labelY));
    return `<text class="${className}" x="${labelX}" y="${labelY}" text-anchor="${anchor}">${text}</text>`;
  };
  const labels = months
    .map((month, index) => {
      const pointX = x(index);
      const cost = costs[index];
      const count = counts[index];
      const costY = yCost(cost);
      const countY = yCount(count);
      return `
        <text class="tick" x="${pointX}" y="${height - 20}" text-anchor="middle">${month.replace(" 2026", "")}</text>
        ${pointLabel({ text: `${rub.format(cost)} ₽`, xValue: pointX, yValue: costY, plot: costPlot, className: "value-label", index, total: months.length })}
        ${pointLabel({ text: `${rub.format(count)} лид.`, xValue: pointX, yValue: countY, plot: countPlot, className: "count-label", index: index + 1, total: months.length })}
        <circle class="${lineClass === "series-red" ? "point-red" : "point-black"}" cx="${pointX}" cy="${costY}" r="6"></circle>
        <circle class="point-green" cx="${pointX}" cy="${countY}" r="6"></circle>
      `;
    })
    .join("");

  return `
    <article class="combo-card">
      <div class="chart-title">${title}<span>средняя стоимость лида с аукционом и количество лидов</span></div>
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${title}">
        <line class="axis" x1="${padding.left}" x2="${padding.left}" y1="${costPlot.top}" y2="${costPlot.bottom}"></line>
        <line class="axis" x1="${padding.left}" x2="${padding.left}" y1="${countPlot.top}" y2="${countPlot.bottom}"></line>
        <text class="chart-note" x="${padding.left}" y="${costPlot.top - 18}">Плоскость 1: средняя стоимость лида</text>
        <text class="chart-note" x="${padding.left}" y="${countPlot.top - 18}">Плоскость 2: количество лидов</text>
        ${costAxis}
        ${countAxis}
        <circle class="${lineClass === "series-red" ? "point-red" : "point-black"}" cx="${padding.left}" cy="16" r="5"></circle>
        <text class="chart-note" x="${padding.left + 12}" y="20">средняя стоимость лида</text>
        <circle class="point-green" cx="${padding.left + 206}" cy="16" r="5"></circle>
        <text class="chart-note" x="${padding.left + 218}" y="20">количество лидов</text>
        <polyline class="${lineClass}" points="${costPoints}"></polyline>
        <polyline class="series-green" points="${countPoints}"></polyline>
        ${labels}
      </svg>
    </article>
  `;
}

function makeCplCharts(data, dealerName) {
  const dealerLeadCounts = data.dealerAuctionCount || dealerMetricByMonth(data.leads, dealerName);
  return [
    makeComboCplChart("Рынок", data.cplMarket, data.marketAuctionCount, "series-black"),
    makeComboCplChart("Дилер", data.cplDealer, dealerLeadCounts, "series-red"),
  ].join("");
}

function grid(width, height, padding) {
  const innerHeight = height - padding.top - padding.bottom;
  return [0, 0.25, 0.5, 0.75, 1]
    .map((ratio) => {
      const y = padding.top + innerHeight * ratio;
      return `<line class="grid-line" x1="${padding.left}" x2="${width - padding.right}" y1="${y}" y2="${y}"></line>`;
    })
    .join("");
}

function shortName(name, dealerName, max = 14) {
  return name;
}
function escapeSvg(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function wrapDealerName(name, maxLines = 3, targetLength = 18) {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [""];

  const totalLength = words.reduce((sum, word) => sum + word.length, 0) + words.length - 1;
  const lineCount = Math.min(maxLines, words.length, Math.max(1, Math.ceil(totalLength / targetLength)));
  const lines = [];
  let wordIndex = 0;

  for (let lineIndex = 0; lineIndex < lineCount; lineIndex += 1) {
    const remainingLines = lineCount - lineIndex;
    const remainingWords = words.slice(wordIndex);
    const remainingLength =
      remainingWords.reduce((sum, word) => sum + word.length, 0) + Math.max(0, remainingWords.length - 1);
    const target = Math.ceil(remainingLength / remainingLines);
    const lineWords = [];
    let lineLength = 0;

    while (wordIndex < words.length) {
      const wordsNeededForRemainingLines = remainingLines - 1;
      const wordsLeftAfterCurrent = words.length - (wordIndex + 1);
      const nextWord = words[wordIndex];
      const nextLength = lineLength + (lineWords.length ? 1 : 0) + nextWord.length;
      if (lineWords.length && nextLength > target && wordsLeftAfterCurrent >= wordsNeededForRemainingLines) break;
      lineWords.push(nextWord);
      lineLength = nextLength;
      wordIndex += 1;
    }

    lines.push(lineWords.join(" "));
  }

  if (wordIndex < words.length) lines[lines.length - 1] += ` ${words.slice(wordIndex).join(" ")}`;
  return lines;
}

function svgWrappedName(lines, x) {
  return lines
    .map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : 13}">${escapeSvg(line)}</tspan>`)
    .join("");
}

function periodLabel() {
  if (months.length === 1) return months[0];
  return `${months[0]} - ${months.at(-1)}`;
}

function renderTabs() {
  const tabs = document.querySelector("#brandTabs");
  tabs.innerHTML = brandNames
    .map((brand) => `<button class="tab ${brand === activeBrand ? "active" : ""}" type="button" data-brand="${brand}">${brand}</button>`)
    .join("");
}

function render() {
  const data = brandData[activeBrand];
  const dealerName = activeDealerAliases(data);
  document.querySelector("#brandTitle").textContent = activeBrand;
  document.querySelector("#dealerName").textContent = reportDealer;
  document.querySelector(".period").textContent = periodLabel();

  document.querySelector("#leadCharts").innerHTML = months
    .map((month, index) => makeBarDistribution(month, displayRows(data.leads[index] || [], dealerName), "звонки", dealerName))
    .join("");

  document.querySelector("#listingCharts").innerHTML = months
    .map((month, index) => makeBarDistribution(month, displayRows(data.listings[index] || [], dealerName), "объявления", dealerName))
    .join("");

  document.querySelector("#cplChart").innerHTML = makeCplCharts(data, dealerName);
}

function toast(message) {
  const node = document.querySelector("#toast");
  node.textContent = message;
  node.classList.add("show");
  window.setTimeout(() => node.classList.remove("show"), 2800);
}

async function downloadPdf() {
  const report = document.querySelector("#report");
  const fileName = `auto-ru-${activeBrand.toLowerCase()}-dealer-report.pdf`;

  if (!window.html2canvas || !window.jspdf) {
    toast("Библиотека PDF не загрузилась. Открою печать в PDF.");
    window.print();
    return;
  }

  toast("Готовлю PDF по активной марке...");
  const canvas = await window.html2canvas(report, {
    scale: 2,
    backgroundColor: "#f2f7fb",
    useCORS: true,
  });
  const imgData = canvas.toDataURL("image/png");
  const pdf = new window.jspdf.jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(fileName);
  toast("PDF скачан.");
}

document.addEventListener("click", (event) => {
  const tab = event.target.closest("[data-brand]");
  if (!tab) return;
  activeBrand = tab.dataset.brand;
  renderTabs();
  render();
});

document.querySelector("#downloadPdf").addEventListener("click", downloadPdf);

renderTabs();
render();
