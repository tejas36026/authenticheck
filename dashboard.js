const SENTENCES_PER_CHUNK = 15;
let currentSentenceChunkLine = 0;
let currentSentenceChunkBar = 0;
let fullSentenceStatsForPaging = [];

document.addEventListener('DOMContentLoaded', () => {
    const filterStartDateEl = document.getElementById('filterStartDate');
    const filterEndDateEl = document.getElementById('filterEndDate');
    const applyFilterBtn = document.getElementById('applyFilterBtn');
    const resetFilterBtn = document.getElementById('resetFilterBtn');
    const printDashboardBtn = document.getElementById('printDashboardBtn');
    const totalTimeEl = document.getElementById('totalTime');
    const essayTypedWordsEl = document.getElementById('essayTypedWords');
    const essayPastedWordsEl = document.getElementById('essayPastedWords');
    const essayTypedCharsEl = document.getElementById('essayTypedChars');
    const essayPastedCharsEl = document.getElementById('essayPastedChars');
    const essayPasteRatioWordsEl = document.getElementById('essayPasteRatioWords');
    const essayPasteRatioCharsEl = document.getElementById('essayPasteRatioChars');
    const essayPasteEventsCountEl = document.getElementById('essayPasteEventsCount');
    const essayTypingSpeedEl = document.getElementById('essayTypingSpeed');
    const essayBackspaceCountEl = document.getElementById('essayBackspaceCount');
    const essayDeleteCountEl = document.getElementById('essayDeleteCount');
    const jsFocusTimeEl = document.getElementById('jsFocusTime');
    const prevSentenceChunkBtn = document.getElementById('prevSentenceChunkBtn');
    const nextSentenceChunkBtn = document.getElementById('nextSentenceChunkBtn');
    const sentenceChunkIndicator = document.getElementById('sentenceChunkIndicator');
    const prevSentenceBarChunkBtn = document.getElementById('prevSentenceBarChunkBtn');
    const nextSentenceBarChunkBtn = document.getElementById('nextSentenceBarChunkBtn');
    const sentenceBarChunkIndicator = document.getElementById('sentenceBarChunkIndicator');
    const dailyInsightsContainer = document.getElementById('dailyInsightsContainer');
    const refreshDataBtn = document.getElementById('refreshData');
    const analyzedTextContainer = document.getElementById('dashboardHighlightedText');
    const THEME_STORAGE_KEY = 'studentTrackerTheme';

    let allSessionsData = [];
    let charts = {};

    function getThemeColor(variableName, fallback) {
        return getComputedStyle(document.documentElement).getPropertyValue(variableName).trim() || fallback;
    }

    const chartColors = {
        text: () => getThemeColor('--text-secondary', '#666'),
        grid: () => getThemeColor('--border-color', '#ddd'),
        wpm: () => getThemeColor('--color-line-1', 'rgba(54, 162, 235, 0.8)'),
        chars: () => getThemeColor('--color-bar-1', 'rgba(75, 192, 192, 0.7)'),
        delete: () => getThemeColor('--color-error', 'rgba(255, 99, 132, 0.8)'), // Red for pastes/deletes
        focus: () => getThemeColor('--color-primary-01', 'rgba(52, 152, 219, 0.7)'), // Blue for focus
        success: () => getThemeColor('--color-success', 'rgba(46, 204, 113, 0.7)'), // Green for corrections (backspace)
    };

    function loadData() {
        try {
            const storedData = localStorage.getItem('studentTrackingDataAll');
            allSessionsData = storedData ? JSON.parse(storedData) : [];
            if (!Array.isArray(allSessionsData)) allSessionsData = [];
            allSessionsData.sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
        } catch (e) {
            console.error("Error loading data from localStorage:", e);
            allSessionsData = [];
        }
    }

    function formatTime(ms) {
        if (isNaN(ms) || ms < 0) return "00:00:00";
        const totalSeconds = Math.floor(ms / 1000);
        const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
        const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
        const s = String(totalSeconds % 60).padStart(2, '0');
        return `${h}:${m}:${s}`;
    }
    function formatDate(timestamp) {
        if (!timestamp) return 'N/A';
        const date = new Date(timestamp);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }
    function formatDateTime(timestamp) {
        if (!timestamp) return 'N/A';
        return new Date(timestamp).toLocaleString();
    }

    function getFilteredData() {
        let startDate = filterStartDateEl.value ? new Date(filterStartDateEl.value).getTime() : 0;
        let endDate = filterEndDateEl.value ? new Date(filterEndDateEl.value) : null;
        if (endDate) {
            endDate.setHours(23, 59, 59, 999);
            endDate = endDate.getTime();
        } else {
            endDate = Date.now();
        }
        const dataToFilter = Array.isArray(allSessionsData) ? allSessionsData : []; 
        return dataToFilter.filter(session => {
            if (!session || typeof session.startTime === 'undefined') return false;
            const sessionStartTime = session.startTime;
            return sessionStartTime >= startDate && sessionStartTime <= endDate;
        });
    }
    
    function updateDashboard(filteredData) {
        if (!filteredData || filteredData.length === 0) {

            Object.values(charts).forEach(chart => { if (chart && typeof chart.destroy === 'function') chart.destroy(); });
            charts = {};
            essayTypedWordsEl.textContent = '0'; essayPastedWordsEl.textContent = '0';
            essayTypedCharsEl.textContent = '0'; essayPastedCharsEl.textContent = '0';
            essayPasteRatioWordsEl.textContent = '--%'; essayPasteRatioCharsEl.textContent = '--%';
            essayPasteEventsCountEl.textContent = '0'; essayTypingSpeedEl.textContent = '-- WPM';
            essayBackspaceCountEl.textContent = '0'; essayDeleteCountEl.textContent = '0';
            if(sentenceChunkIndicator) sentenceChunkIndicator.textContent = "No sentence data";
            if(prevSentenceChunkBtn) prevSentenceChunkBtn.disabled = true;
            if(nextSentenceChunkBtn) nextSentenceChunkBtn.disabled = true;
            if(sentenceBarChunkIndicator) sentenceBarChunkIndicator.textContent = "No sentence data";
            if(prevSentenceBarChunkBtn) prevSentenceBarChunkBtn.disabled = true;
            if(nextSentenceBarChunkBtn) nextSentenceBarChunkBtn.disabled = true;
            renderQrCodeForReport(null);
            renderPlaceholderChart('textCompositionPieChart', 'pie', 'Text Composition', [], []);
            renderPlaceholderChart('activityChart', 'bar', 'Activity Over Time', [], []);
            renderPlaceholderChart('typingRhythmChart', 'line', 'Typing Rhythm', [], []);
            return;
        }

        let allSentenceStats = [];
        let localAllTypingEvents = [];
        filteredData.forEach(session => {
            if (session.sentenceStats && Array.isArray(session.sentenceStats)) {
                allSentenceStats.push(...session.sentenceStats.map(s => ({ ...s, sessionId: session.sessionId })));
            }
            if (session.typingEvents && Array.isArray(session.typingEvents)) {
                localAllTypingEvents.push(...session.typingEvents);
            }
        });

        if (allSentenceStats.length > 0) {
            allSentenceStats.sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
            allSentenceStats.forEach((s, index) => {
                s.globalNum = index + 1; // Assign 1-based global sentence number
            });
        }
        fullSentenceStatsForPaging = allSentenceStats;
        
        if (localAllTypingEvents.length > 0) localAllTypingEvents.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

        let latestSessionWithTextData = null;
        const dataSourceForLatestText = (filteredData && filteredData.length > 0) ? filteredData : allSessionsData;
        if (dataSourceForLatestText && dataSourceForLatestText.length > 0) {
            for (let i = dataSourceForLatestText.length - 1; i >= 0; i--) {
                if (dataSourceForLatestText[i] && dataSourceForLatestText[i].sentenceStats && dataSourceForLatestText[i].sentenceStats.length > 0) {
                    latestSessionWithTextData = dataSourceForLatestText[i];
                    break;
                }
            }
        }
        function createDashboardSegmentDiv(segmentText, segmentClass, stats) {
            const wrapper = document.createElement('div');
            wrapper.className = 'segment-wrapper';
            const textSpan = document.createElement('span');
            textSpan.className = 'segment-text-content ' + segmentClass;
            textSpan.innerHTML = segmentText.replace(/\n/g, '<br>');
            textSpan.style.whiteSpace = 'pre-wrap';
            const tooltip = document.createElement('div');
            tooltip.className = 'segment-tooltip';
            let tooltipContent = '';
            if (stats.type === 'typed') tooltipContent += `WPM: ${stats.wpm ? stats.wpm.toFixed(0) : 'N/A'}, `;
            else if (stats.type === 'pasted') tooltipContent += `WPM: N/A (Pasted), `;
            else tooltipContent += `WPM: N/A, `;
            if (stats.durationMs !== undefined) tooltipContent += `Duration: ${formatTime(stats.durationMs || 0)}, `;
            tooltipContent += `Chars: ${stats.charCount || 0}`;
            if (stats.edits > 0 && stats.type === 'typed') tooltipContent += `, Edits: ${stats.edits}`;
            tooltip.textContent = tooltipContent;
            wrapper.appendChild(tooltip);
            wrapper.appendChild(textSpan);
            return wrapper;
        }

        if (latestSessionWithTextData && latestSessionWithTextData.sentenceStats && latestSessionWithTextData.sentenceStats.length > 0) {
            latestSessionWithTextData.sentenceStats.forEach(sStat => {
                (sStat.subSegments || []).forEach(subSeg => {
                    if (subSeg.text.trim().length === 0 && !subSeg.text.includes('\n')) return;
                    let subSegClass = subSeg.type === 'pasted' ? 'highlight-red-pasted' : 
                                      (sStat.totalCorrections > 0 ? 'highlight-green-corrected' : 'highlight-yellow-typed');
                    let statsForSubSegTooltip = {
                        type: subSeg.type, category: sStat.category, charCount: subSeg.text.length,
                        durationMs: 0, wpm: null, edits: 0
                    };
                    if (subSeg.type === 'typed') {
                        statsForSubSegTooltip.wpm = sStat.wpm;
                        if (sStat.typedChars > 0 && sStat.typedDurationMs > 0) {
                            statsForSubSegTooltip.durationMs = (subSeg.text.length / sStat.typedChars) * sStat.typedDurationMs;
                        }
                        statsForSubSegTooltip.edits = sStat.totalCorrections || 0;
                    } else {
                        statsForSubSegTooltip.durationMs = 50;
                    }
                    // analyzedTextContainer.appendChild(createDashboardSegmentDiv(subSeg.text, subSegClass, statsForSubSegTooltip));
                });
            });
        } else if (latestSessionWithTextData && latestSessionWithTextData.currentFullText) {
             let fallbackStats = {
                type: 'typed',
                wpm: latestSessionWithTextData.averageWPM || null,
                durationMs: latestSessionWithTextData.totalActiveTimeMs || 0,
                charCount: latestSessionWithTextData.currentFullText.length,
                edits: (latestSessionWithTextData.backspaceCount || 0) + (latestSessionWithTextData.deleteCount || 0) + (latestSessionWithTextData.undoCount || 0)
            };
            analyzedTextContainer.appendChild(createDashboardSegmentDiv(latestSessionWithTextData.currentFullText, 'highlight-yellow-typed', fallbackStats));
        } else {
            analyzedTextContainer.innerHTML = '<p>No text to display from the latest session(s).</p>';
        }
        
        // --- Metrics Aggregation ---
        let totalActiveTime = 0, totalTypedChars = 0, totalPastedChars = 0;
        let totalTypedWordsAgg = 0, totalPastedWordsAgg = 0;
        let totalBackspace = 0, totalDelete = 0, totalPasteEvents = 0;
        let overallSessionTimeAcrossAllData = 0;
        (Array.isArray(allSessionsData) ? allSessionsData : []).forEach(session => {
            overallSessionTimeAcrossAllData += session.totalActiveTimeMs || 0;
        });
        filteredData.forEach(session => {
            totalActiveTime += session.totalActiveTimeMs || 0;
            totalTypedChars += session.typedChars || 0;
            totalPastedChars += session.pastedChars || 0;
            totalBackspace += session.backspaceCount || 0;
            totalDelete += session.deleteCount || 0;
            if (session.pastedSegmentsDetails && Array.isArray(session.pastedSegmentsDetails)) {
                totalPasteEvents += session.pastedSegmentsDetails.length;
                session.pastedSegmentsDetails.forEach(p => { totalPastedWordsAgg += (p.wordCount || 0); });
            }
        });
        totalTypedWordsAgg = allSentenceStats.reduce((sum, s) => sum + (s.typedWords || 0), 0);
        essayTypedWordsEl.textContent = totalTypedWordsAgg;
        essayPastedWordsEl.textContent = totalPastedWordsAgg;
        essayTypedCharsEl.textContent = totalTypedChars;
        essayPastedCharsEl.textContent = totalPastedChars;
        const totalWordsFiltered = totalTypedWordsAgg + totalPastedWordsAgg;
        essayPasteRatioWordsEl.textContent = totalWordsFiltered > 0 ? ((totalPastedWordsAgg / totalWordsFiltered) * 100).toFixed(1) + '%' : '--%';
        const totalCharsFiltered = totalTypedChars + totalPastedChars;
        essayPasteRatioCharsEl.textContent = totalCharsFiltered > 0 ? ((totalPastedChars / totalCharsFiltered) * 100).toFixed(1) + '%' : '--%';
        essayPasteEventsCountEl.textContent = totalPasteEvents;
        const totalTypingDurationSecFiltered = allSentenceStats.reduce((sum, s) => sum + ((s.typedDurationMs || 0) / 1000), 0);
        const overallWPMFiltered = totalTypedWordsAgg > 0 && totalTypingDurationSecFiltered > 0 ?
            Math.round(totalTypedWordsAgg / (totalTypingDurationSecFiltered / 60)) : 0;
        essayTypingSpeedEl.textContent = `${overallWPMFiltered} WPM`;
        essayBackspaceCountEl.textContent = totalBackspace;
        essayDeleteCountEl.textContent = totalDelete;

        // --- Render Charts ---
        currentSentenceChunkLine = 0; currentSentenceChunkBar = 0;
        renderPagedSentenceCharts();
        renderTypingRhythmChart(localAllTypingEvents);
        renderActivityAggregationCharts(filteredData);
        renderOverallActivityChart(filteredData);
        renderTextCompositionPieChart(totalTypedChars, totalPastedChars);
        generateDailyInsights(filteredData);
        renderQrCodeForReport(filteredData);
    }

    function renderPagedSentenceCharts() {
        const totalSentences = fullSentenceStatsForPaging.length;

        // --- 1. Prepare data for Bar Chart (Globally Descending Paging) ---
        let barChartStartGlobalIndex, barChartEndGlobalIndex;
        if (totalSentences > 0) {
            barChartEndGlobalIndex = totalSentences - (currentSentenceChunkBar * SENTENCES_PER_CHUNK);
            barChartStartGlobalIndex = Math.max(0, totalSentences - ((currentSentenceChunkBar + 1) * SENTENCES_PER_CHUNK));
        } else {
            barChartStartGlobalIndex = 0;
            barChartEndGlobalIndex = 0;
        }
        const barChartDataChunk = fullSentenceStatsForPaging.slice(
            barChartStartGlobalIndex,
            barChartEndGlobalIndex
        );

        // --- 2. Prepare data for Line Chart (Ascending Paging, hidden chart) ---
        const lineChartDataChunk = fullSentenceStatsForPaging.slice(
            currentSentenceChunkLine * SENTENCES_PER_CHUNK,
            (currentSentenceChunkLine + 1) * SENTENCES_PER_CHUNK
        );

        // --- 3. Render charts and update controls ---
        renderSentenceSummaryBarChart(barChartDataChunk);
        updateNavControls(
            prevSentenceBarChunkBtn, nextSentenceBarChunkBtn, sentenceBarChunkIndicator,
            currentSentenceChunkBar,
            totalSentences, SENTENCES_PER_CHUNK,
            true // flag to indicate descending paging for indicator text
        );

        renderTypingBehaviorLineChart(lineChartDataChunk); // This is the hidden chart
        updateNavControls(
            prevSentenceChunkBtn, nextSentenceChunkBtn, sentenceChunkIndicator,
            currentSentenceChunkLine, totalSentences, SENTENCES_PER_CHUNK,
            false // Flag for ascending indicator text
        );
    }

    function updateNavControls(prevBtn, nextBtn, indicatorEl, currentChunk, totalItems, itemsPerChunk, isDescendingPaging = false) {
        if (!prevBtn || !nextBtn || !indicatorEl) return;
        const totalChunks = Math.ceil(totalItems / itemsPerChunk);
        
        prevBtn.disabled = currentChunk === 0;
        nextBtn.disabled = currentChunk >= totalChunks - 1 || totalChunks === 0;

        if (totalItems > 0) {
            let startNum, endNum;
            if (isDescendingPaging) {
                endNum = totalItems - (currentChunk * itemsPerChunk);
                const itemsInThisActualChunk = endNum - Math.max(0, totalItems - ((currentChunk + 1) * itemsPerChunk));
                startNum = endNum - itemsInThisActualChunk + 1;
                indicatorEl.textContent = `Sentences ${startNum}-${endNum} of ${totalItems}`;
            } else { // Ascending paging
                startNum = currentChunk * itemsPerChunk + 1;
                endNum = Math.min((currentChunk + 1) * itemsPerChunk, totalItems);
                indicatorEl.textContent = `Sentences ${startNum}-${endNum} of ${totalItems}`;
            }
        } else {
            indicatorEl.textContent = "No sentence data";
        }
    }

    if (prevSentenceChunkBtn) prevSentenceChunkBtn.addEventListener('click', () => { if (currentSentenceChunkLine > 0) { currentSentenceChunkLine--; renderPagedSentenceCharts(); } });
    if (nextSentenceChunkBtn) nextSentenceChunkBtn.addEventListener('click', () => { const tc = Math.ceil(fullSentenceStatsForPaging.length / SENTENCES_PER_CHUNK); if (currentSentenceChunkLine < tc - 1) { currentSentenceChunkLine++; renderPagedSentenceCharts(); } });
    if (prevSentenceBarChunkBtn) prevSentenceBarChunkBtn.addEventListener('click', () => { if (currentSentenceChunkBar > 0) { currentSentenceChunkBar--; renderPagedSentenceCharts(); } });
    if (nextSentenceBarChunkBtn) nextSentenceBarChunkBtn.addEventListener('click', () => { const tc = Math.ceil(fullSentenceStatsForPaging.length / SENTENCES_PER_CHUNK); if (currentSentenceChunkBar < tc - 1) { currentSentenceChunkBar++; renderPagedSentenceCharts(); } });

    function renderTypingRhythmChart(typingEvents) {
        const canvasId = 'typingRhythmChart';
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) { return; }
        if (charts[canvasId]) charts[canvasId].destroy(); charts[canvasId] = null;
        if (!typingEvents || typingEvents.length === 0) { ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); return; }
        const dataPoints = []; let lastTimestamp = typingEvents[0]?.timestamp || 0;
        typingEvents.forEach((event, index) => {
            const eventTime = event.timestamp || 0; const eventDuration = event.durationMs || 0;
            const charDuration = event.type === 'char' ? (event.durationMs || 50) : 0;
            if (event.type === 'pause') {
                if (dataPoints.length > 0 && dataPoints[dataPoints.length -1].y !== 0) dataPoints.push({ x: eventTime -1 , y: 0 });
                else if (dataPoints.length === 0 && index === 0) dataPoints.push({ x: eventTime, y: 0 });
                dataPoints.push({ x: eventTime + eventDuration, y: 0 }); lastTimestamp = eventTime + eventDuration;
            } else if (event.type === 'char') {
                if (eventTime > lastTimestamp + 100) { if(dataPoints.length > 0 && dataPoints[dataPoints.length -1].y !== 0) dataPoints.push({x: lastTimestamp, y: 0}); dataPoints.push({x: eventTime -1, y: 0}); }
                dataPoints.push({ x: eventTime, y: 20 }); dataPoints.push({ x: eventTime + charDuration, y: 0 }); lastTimestamp = eventTime + charDuration;
            }
        });
        if (dataPoints.length === 0 && typingEvents.length > 0) typingEvents.forEach(event => dataPoints.push({x: (event.timestamp || 0), y: event.type === 'char' ? 10 : 0}));
        dataPoints.sort((a, b) => a.x - b.x);
        const finalDataPoints = dataPoints.reduce((acc, current, index, arr) => { if (index > 0 && current.y === 0 && arr[index - 1].y === 0 && current.x === arr[index-1].x) { /* skip */ } else { acc.push(current); } return acc; }, []);
        if(finalDataPoints.length === 0) { ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); return; }
        charts[canvasId] = new Chart(ctx, {
            type: 'line', data: { datasets: [{ label: 'Typing Activity', data: finalDataPoints, borderColor: chartColors.focus(), backgroundColor: chartColors.focus().replace('0.7', '0.1'), borderWidth: 1.5, pointRadius: 0, tension: 0.1, fill: true, stepped: false }] },
            options: { responsive: true, maintainAspectRatio: false,
                scales: { x: { type: 'time', time: { tooltipFormat: 'PP HH:mm:ss', displayFormats: { millisecond: 'HH:mm:ss.SSS', second: 'HH:mm:ss', minute: 'HH:mm', hour: 'HH:mm', day: 'MMM d', month: 'MMM yyyy', year: 'yyyy'}}, title: { display: true, text: 'Time', color: chartColors.text() }, ticks: { source: 'auto', color: chartColors.text(), autoSkip: true, maxTicksLimit: 20 }, grid: { color: chartColors.grid() } },
                          y: { title: { display: true, text: 'Activity Level', color: chartColors.text() }, ticks: { color: chartColors.text(), beginAtZero: true, suggestedMax: 30 }, grid: { color: chartColors.grid() } } },
                plugins: { legend: { display: false }, tooltip: { enabled: true, mode: 'index', intersect: false }, zoom: { pan: { enabled: true, mode: 'x' }, zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' } } }
            }
        });
    }

    function renderTextCompositionPieChart(typedChars, pastedChars) {
        const canvasId = 'textCompositionPieChart';
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) return;
        if (charts[canvasId]) charts[canvasId].destroy();
        if (typedChars === 0 && pastedChars === 0) { ctx.clearRect(0,0,ctx.canvas.width, ctx.canvas.height); return; }
        charts[canvasId] = new Chart(ctx, {
            type: 'pie',
            data: { labels: ['Typed Characters', 'Pasted Characters'], datasets: [{ label: 'Character Source', data: [typedChars, pastedChars], backgroundColor: [chartColors.chars(), chartColors.delete()], borderColor: [getThemeColor('--editor-bg', '#fff'), getThemeColor('--editor-bg', '#fff')], borderWidth: 2 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { color: chartColors.text() } }, title: { display: false }, tooltip: { callbacks: { label: function(context) { let label = context.label || ''; if (label) label += ': '; if (context.parsed !== null) label += context.parsed + ' chars'; return label; } } } } }
        });
    }
    
    function renderSentenceSummaryBarChart(sentenceStatsChunk) {
        const canvasId = 'sentenceSummaryBarChart';
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) { console.warn(`Canvas ID ${canvasId} not found for bar chart.`); return; }
        if (charts[canvasId]) charts[canvasId].destroy();
        if (!sentenceStatsChunk || sentenceStatsChunk.length === 0) { ctx.clearRect(0,0,ctx.canvas.width, ctx.canvas.height); return; }
        
        const reversedChunkForDisplay = [...sentenceStatsChunk].reverse();
        const labels = reversedChunkForDisplay.map(s_rev => `S${s_rev.globalNum}`);
        
        const greenColor = chartColors.success(); 
        const lighterGreenColor = greenColor.replace('0.7', '0.4');
        
        charts[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: { 
                labels: labels, 
                datasets: [
                    { label: 'WPM', data: reversedChunkForDisplay.map(s => s.wpm || 0), backgroundColor: reversedChunkForDisplay.map(s => s.category === 'highlight-anomaly-speed' ? chartColors.delete() : chartColors.wpm()), yAxisID: 'yWPM_bar' },
                    { label: 'Typed Chars', data: reversedChunkForDisplay.map(s => s.typedChars || 0), backgroundColor: chartColors.chars(), yAxisID: 'yChars_bar' },
                    { label: 'Duration (s)', data: reversedChunkForDisplay.map(s => parseFloat(((s.typedDurationMs || 0) / 1000).toFixed(1))), backgroundColor: chartColors.focus(), yAxisID: 'yDuration_bar' },
                    { label: 'Backspaces', data: reversedChunkForDisplay.map(s => s.backspaces || 0), backgroundColor: greenColor, yAxisID: 'yCorrections_bar' },
                    { label: 'Deletes', data: reversedChunkForDisplay.map(s => s.deletes || 0), backgroundColor: lighterGreenColor, yAxisID: 'yCorrections_bar' },
                    { label: 'Paste Influence (Chars)', data: reversedChunkForDisplay.map(s => s.pastedCharsInSentence || 0), backgroundColor: chartColors.delete(), yAxisID: 'yPaste_bar' }
                ]
            },
            options: { 
                responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
                scales: {
                    yWPM_bar: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'WPM', color: chartColors.text()}, ticks: {color: chartColors.text()}, grid: {color: chartColors.grid()} },
                    yChars_bar: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Typed Chars', color: chartColors.text()}, ticks: {color: chartColors.text()}, grid: {drawOnChartArea: false} },
                    yDuration_bar: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Duration (s)', color: chartColors.text()}, ticks: {color: chartColors.text()}, grid: {drawOnChartArea: false} },
                    yCorrections_bar: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'Corrections', color: chartColors.text()}, ticks: {color: chartColors.text(), precision: 0}, grid: {drawOnChartArea: false}, stacked: true },
                    yPaste_bar: { type: 'linear', display: true, position: 'right', title: {display: true, text: 'Pasted Chars', color: chartColors.text()}, ticks: {color: chartColors.text(), precision: 0}, grid: {drawOnChartArea: false}},
                    x: { stacked: false, title: {display: true, text: 'Sentences (Latest First)', color: chartColors.text()}, ticks: {color: chartColors.text()}, grid: {color: chartColors.grid()} }
                },
                plugins: { 
                    legend: { labels: { color: chartColors.text(), usePointStyle: true }, position: 'bottom' }, 
                    tooltip: { 
                        backgroundColor: getThemeColor('--editor-bg', '#fff'), titleColor: chartColors.text(), bodyColor: chartColors.text(), borderColor: chartColors.grid(), borderWidth: 1, 
                        callbacks: { 
                            label: function(context) { 
                                let label = context.dataset.label || ''; if (label) label += ': '; if (context.parsed.y !== null) label += context.parsed.y; return label; 
                            }, 
                            afterTitle: function(context) { 
                                const dataIndexInReversedChunk = context[0]?.dataIndex;
                                if (reversedChunkForDisplay && reversedChunkForDisplay[dataIndexInReversedChunk] !== undefined) {
                                    const sentenceData = reversedChunkForDisplay[dataIndexInReversedChunk];
                                    let catInfo = '';
                                    if (sentenceData.category) {
                                        let cat = sentenceData.category.replace('highlight-', '');
                                        if (cat === 'anomaly-speed') cat = 'Speed Anomaly!';
                                        catInfo = `Category: ${cat}`;
                                    }
                                    return catInfo;
                                } 
                                return ''; 
                            } 
                        } 
                    } 
                }
            }
        });
    }

    function renderOverallActivityChart(filteredData) {
        const canvasId = 'activityChart';
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) { return; }
        if (charts[canvasId]) charts[canvasId].destroy();
        if (!filteredData || filteredData.length === 0) { ctx.clearRect(0,0,ctx.canvas.width, ctx.canvas.height); return; }
        const dailyData = {};
        filteredData.forEach(session => {
            const date = formatDate(session.startTime);
            if (!dailyData[date]) dailyData[date] = { typedWords: 0, activeTimeMinutes: 0, pasteEvents: 0 };
            (session.sentenceStats || []).forEach(s => dailyData[date].typedWords += (s.typedWords || 0));
            dailyData[date].activeTimeMinutes += (session.totalActiveTimeMs || 0) / 60000;
            dailyData[date].pasteEvents += (session.pastedSegmentsDetails || []).length;
        });
        const labels = Object.keys(dailyData).sort((a,b) => new Date(a) - new Date(b));
        charts[canvasId] = new Chart(ctx, {
            type: 'bar', data: { labels: labels, datasets: [
                    { label: 'Words Typed', data: labels.map(d => dailyData[d].typedWords), backgroundColor: chartColors.chars(), yAxisID: 'yPrimary' },
                    { label: 'Active Time (min)', data: labels.map(d => parseFloat(dailyData[d].activeTimeMinutes.toFixed(1))), backgroundColor: chartColors.focus(), yAxisID: 'ySecondary', type: 'line', tension: 0.1, fill:false, borderColor: chartColors.focus() },
                    { label: 'Paste Events', data: labels.map(d => dailyData[d].pasteEvents), backgroundColor: chartColors.delete(), yAxisID: 'yPrimary' }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { yPrimary: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Count', color: chartColors.text()}, ticks: {color: chartColors.text()}, grid: {color: chartColors.grid()} }, ySecondary: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'Minutes', color: chartColors.text()}, ticks: {color: chartColors.text()}, grid: {drawOnChartArea: false} }, x: { title: {display: true, text: 'Date', color: chartColors.text()}, ticks: {color: chartColors.text()}, grid: {color: chartColors.grid()} } }, plugins: { legend: { labels: { color: chartColors.text() } } } }
        });
    }
    
    function renderTypingBehaviorLineChart(sentenceStats) {
        const canvasId = 'typingBehaviorChart';
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) { return; }
        if (charts[canvasId]) charts[canvasId].destroy();
        if (!sentenceStats || sentenceStats.length === 0) { ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); return; }
        const labels = sentenceStats.map((s, i) => `S${currentSentenceChunkLine * SENTENCES_PER_CHUNK + i + 1}`);
        charts[canvasId] = new Chart(ctx, {
            type: 'line', data: { labels: labels, datasets: [
                    { label: 'WPM', data: sentenceStats.map(s => s.wpm || 0), borderColor: chartColors.wpm(), yAxisID: 'yWPM', fill: false, tension: 0.1 },
                    { label: 'Duration (s)', data: sentenceStats.map(s => parseFloat(((s.typedDurationMs || 0) / 1000).toFixed(1))), borderColor: chartColors.focus(), tension: 0.1, yAxisID: 'yDuration', fill: false },
                    { label: 'Backspaces', data: sentenceStats.map(s => s.backspaces || 0), borderColor: chartColors.success(), type: 'bar', yAxisID: 'yCorrections' },
                    { label: 'Deletes', data: sentenceStats.map(s => s.deletes || 0), borderColor: chartColors.success().replace('0.7', '0.4'), type: 'bar', yAxisID: 'yCorrections' },
                    { label: 'Paste Influence (Chars)', data: sentenceStats.map(s => s.pastedCharsInSentence || 0), borderColor: chartColors.delete(), type: 'bar', yAxisID: 'yPaste' }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
                scales: {
                    yWPM: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'WPM', color: chartColors.text() }, ticks: { color: chartColors.text() }, grid: { color: chartColors.grid() } },
                    yDuration: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Duration (s)', color: chartColors.text() }, ticks: { color: chartColors.text() }, grid: { drawOnChartArea: false } },
                    yCorrections: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'Corrections', color: chartColors.text() }, ticks: { color: chartColors.text(), precision: 0 }, grid: { drawOnChartArea: false }, beginAtZero: true },
                    yPaste: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'Pasted Chars', color: chartColors.text() }, ticks: { color: chartColors.text(), precision: 0 }, grid: { drawOnChartArea: false }, beginAtZero: true, suggestedMax: Math.max(...sentenceStats.map(s => s.pastedCharsInSentence || 0), 10) },
                    x: { title: { display: true, text: 'Typed Sentences/Segments', color: chartColors.text() }, ticks: { color: chartColors.text() }, grid: { color: chartColors.grid() } }
                },
                plugins: { legend: { labels: { color: chartColors.text(), usePointStyle: true }, position: 'bottom' }, tooltip: { } }
            }
        });
    }

    function renderPlaceholderChart(canvasId, type, label, labels, data) {
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) return;
        if (charts[canvasId]) charts[canvasId].destroy();
        charts[canvasId] = new Chart(ctx, {
            type: type, data: { labels: labels, datasets: [{ label: label, data: data, backgroundColor: chartColors.grid() }] },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { color: chartColors.text() }, grid: { color: chartColors.grid() } }, x: { ticks: { color: chartColors.text() }, grid: { color: chartColors.grid() } } }, plugins: { legend: { labels: { color: chartColors.text() } } } }
        });
    }

    function renderActivityAggregationCharts(data) {
        if (!data || data.length === 0) {
            const chartIdsToClear = ['hourlyTypingSpeedChart', 'hourlyTypedCharsChart', 'hourlyCorrectionsChart', 'hourlyFocusTimeChart', 'hourlyPasteInfluenceChart', 'dailyTypingSpeedChart', 'dailyTypedCharsChart', 'dailyFocusTimeChart', 'dailyPasteInfluenceChart', 'correctionUndoDailyChart', 'correctionUndoHourlyChart'];
            chartIdsToClear.forEach(id => {
                const ctx = document.getElementById(id)?.getContext('2d');
                if (ctx) { if (charts[id]) charts[id].destroy(); ctx.clearRect(0,0,ctx.canvas.width, ctx.canvas.height); }
            });
            return;
        }
        const hourlyAgg = {}; const dailyAgg = {};
        data.forEach(session => {
            if (!session || typeof session.startTime === 'undefined') return;
            (session.sentenceStats || []).forEach(s => {
                if (!s || typeof s.startTime === 'undefined') return;
                const sentenceDate = new Date(s.startTime);
                const sentenceHourKey = `${sentenceDate.getFullYear()}-${String(sentenceDate.getMonth() + 1).padStart(2, '0')}-${String(sentenceDate.getDate()).padStart(2, '0')}T${String(sentenceDate.getHours()).padStart(2, '0')}`;
                const sentenceDateKey = sentenceHourKey.substring(0, 10);
                if (!hourlyAgg[sentenceHourKey]) hourlyAgg[sentenceHourKey] = { typedChars: 0, typedWords: 0, durationMs: 0, backspaces: 0, deletes: 0, undos: 0, focusTimeMs: 0, pasteChars: 0 };
                if (!dailyAgg[sentenceDateKey]) dailyAgg[sentenceDateKey] = { typedChars: 0, typedWords: 0, durationMs: 0, backspaces: 0, deletes: 0, undos: 0, focusTimeMs: 0, pasteChars: 0 };
                hourlyAgg[sentenceHourKey].typedChars += (s.typedChars || 0); hourlyAgg[sentenceHourKey].typedWords += (s.typedWords || 0); hourlyAgg[sentenceHourKey].durationMs += (s.typedDurationMs || 0);
                hourlyAgg[sentenceHourKey].backspaces += (s.backspaces || 0); hourlyAgg[sentenceHourKey].deletes += (s.deletes || 0); hourlyAgg[sentenceHourKey].undos += (s.undos || 0);
                hourlyAgg[sentenceHourKey].focusTimeMs += (s.typedDurationMs || 0); hourlyAgg[sentenceHourKey].pasteChars += (s.pastedCharsInSentence || 0);
                dailyAgg[sentenceDateKey].typedChars += (s.typedChars || 0); dailyAgg[sentenceDateKey].typedWords += (s.typedWords || 0); dailyAgg[sentenceDateKey].durationMs += (s.typedDurationMs || 0);
                dailyAgg[sentenceDateKey].backspaces += (s.backspaces || 0); dailyAgg[sentenceDateKey].deletes += (s.deletes || 0); dailyAgg[sentenceDateKey].undos += (s.undos || 0);
                dailyAgg[sentenceDateKey].focusTimeMs += (s.typedDurationMs || 0); dailyAgg[sentenceDateKey].pasteChars += (s.pastedCharsInSentence || 0);
            });
            const sessionDateOnly = formatDate(session.startTime);
            const sessionHourKeyOnly = `${sessionDateOnly}T${String(new Date(session.startTime).getHours()).padStart(2, '0')}`;
            if (dailyAgg[sessionDateOnly] && session.undoCount && !session.sentenceStats?.length) {
                dailyAgg[sessionDateOnly].undos += (session.undoCount || 0);
            }
            if (hourlyAgg[sessionHourKeyOnly] && session.undoCount && !session.sentenceStats?.length) {
                 hourlyAgg[sessionHourKeyOnly].undos += (session.undoCount || 0);
            }
        });

        const hourlyLabels = Object.keys(hourlyAgg).sort(); const dailyLabels = Object.keys(dailyAgg).sort();
        
        createBarChart('hourlyTypingSpeedChart', 'Hourly WPM', hourlyLabels, hourlyLabels.map(k => (hourlyAgg[k]?.typedWords || 0) > 0 && (hourlyAgg[k]?.durationMs || 0) > 0 ? Math.round(hourlyAgg[k].typedWords / (hourlyAgg[k].durationMs / 60000)) : 0), chartColors.wpm());
        createBarChart('hourlyTypedCharsChart', 'Hourly Typed Chars', hourlyLabels, hourlyLabels.map(k => hourlyAgg[k]?.typedChars || 0), chartColors.chars());
        createBarChart('hourlyCorrectionsChart', 'Hourly Corrections (BS/Del)', hourlyLabels, [ { label: 'Backspaces', data: hourlyLabels.map(k => hourlyAgg[k]?.backspaces || 0), backgroundColor: chartColors.success() }, { label: 'Deletes', data: hourlyLabels.map(k => hourlyAgg[k]?.deletes || 0), backgroundColor: chartColors.success().replace('0.7','0.4') } ]);
        createBarChart('hourlyFocusTimeChart', 'Hourly Focus (min)', hourlyLabels, hourlyLabels.map(k => parseFloat(((hourlyAgg[k]?.focusTimeMs || 0) / 60000).toFixed(1))), chartColors.focus());
        createBarChart('hourlyPasteInfluenceChart', 'Hourly Pasted Chars', hourlyLabels, hourlyLabels.map(k => hourlyAgg[k]?.pasteChars || 0), chartColors.delete());
        createBarChart('dailyTypingSpeedChart', 'Daily Avg WPM', dailyLabels, dailyLabels.map(k => (dailyAgg[k]?.typedWords || 0) > 0 && (dailyAgg[k]?.durationMs || 0) > 0 ? Math.round(dailyAgg[k].typedWords / (dailyAgg[k].durationMs / 60000)) : 0), chartColors.wpm());
        createBarChart('dailyTypedCharsChart', 'Daily Typed Chars', dailyLabels, dailyLabels.map(k => dailyAgg[k]?.typedChars || 0), chartColors.chars());
        createBarChart('dailyFocusTimeChart', 'Daily Focus (min)', dailyLabels, dailyLabels.map(k => parseFloat(((dailyAgg[k]?.focusTimeMs || 0) / 60000).toFixed(1))), chartColors.focus());
        createBarChart('dailyPasteInfluenceChart', 'Daily Pasted Chars', dailyLabels, dailyLabels.map(k => dailyAgg[k]?.pasteChars || 0), chartColors.delete());
        createBarChart('correctionUndoDailyChart', 'Daily Correction/Undo', dailyLabels, [ { label: 'Backspaces', data: dailyLabels.map(k => dailyAgg[k]?.backspaces || 0), backgroundColor: chartColors.success() }, { label: 'Deletes', data: dailyLabels.map(k => dailyAgg[k]?.deletes || 0), backgroundColor: chartColors.success().replace('0.7','0.4') }, { label: 'Undos', data: dailyLabels.map(k => dailyAgg[k]?.undos || 0), backgroundColor: getThemeColor('--color-primary-03', 'lightblue') } ]);
        createBarChart('correctionUndoHourlyChart', 'Hourly Correction/Undo', hourlyLabels, [ { label: 'Backspaces', data: hourlyLabels.map(k => hourlyAgg[k]?.backspaces || 0), backgroundColor: chartColors.success() }, { label: 'Deletes', data: hourlyLabels.map(k => hourlyAgg[k]?.deletes || 0), backgroundColor: chartColors.success().replace('0.7','0.4') }, { label: 'Undos', data: hourlyLabels.map(k => hourlyAgg[k]?.undos || 0), backgroundColor: getThemeColor('--color-primary-03', 'lightblue') } ]);
    }

    function createBarChart(canvasId, title, labels, datasetsOrDataArray, defaultColorForSingleDataset) {
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) { return; }
        if (charts[canvasId]) charts[canvasId].destroy();
        let finalDatasets;
        if (Array.isArray(datasetsOrDataArray) && datasetsOrDataArray.length > 0 && typeof datasetsOrDataArray[0] === 'object' && datasetsOrDataArray[0] !== null && 'data' in datasetsOrDataArray[0]) {
            finalDatasets = datasetsOrDataArray;
        } else if (Array.isArray(datasetsOrDataArray)) {
            finalDatasets = [{ label: title, data: datasetsOrDataArray, backgroundColor: defaultColorForSingleDataset }];
        } else {
            finalDatasets = [{ label: title, data: [], backgroundColor: defaultColorForSingleDataset || 'grey' }];
        }
        try {
            charts[canvasId] = new Chart(ctx, {
                type: 'bar', data: { labels: labels, datasets: finalDatasets },
                options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: false, text: title, color: chartColors.text() }, legend: { labels: { color: chartColors.text() } } }, scales: { y: { beginAtZero: true, ticks: { color: chartColors.text() }, grid: { color: chartColors.grid() } }, x: { ticks: { color: chartColors.text(), autoSkip: true, maxTicksLimit: labels.length > 24 ? 12 : 24 }, grid: { color: chartColors.grid() } } } }
            });
        } catch (e) { console.error(`Error creating chart ${canvasId}:`, e, { labels, finalDatasets }); }
    }

    function generateDailyInsights(data) { /* ... */ }
    
    function renderQrCodeForReport(filteredData) {
        const qrContainer = document.getElementById('qrCodeContainerDashboard');
        if (!qrContainer) return;
        qrContainer.innerHTML = '';
    
        if (!filteredData || filteredData.length === 0 || typeof kjua === 'undefined') {
            qrContainer.textContent = 'QR code available with data.';
            return;
        }
    
        let qrDetails = "STUDENT TYPING DETAILED REPORT (TEXTUAL)\n";
        qrDetails += `Report Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}\n`;
        qrDetails += "==========================================\n";
    
        let totalActiveTime = 0, totalTypedChars = 0, totalPastedChars = 0,
            totalTypedWordsAgg = 0, totalPastedWordsAgg = 0,
            totalBackspace = 0, totalDelete = 0, totalUndo = 0, totalPasteEvents = 0,
            sessionCount = filteredData.length;
        let allSentenceStatsForQR = [];
        let allTypingEventsForQR = [];
    
        filteredData.forEach(session => {
            totalActiveTime += session.totalActiveTimeMs || 0;
            totalTypedChars += session.typedChars || 0;
            totalPastedChars += session.pastedChars || 0;
            totalBackspace += session.backspaceCount || 0;
            totalDelete += session.deleteCount || 0;
            totalUndo += session.undoCount || 0;
            if (session.pastedSegmentsDetails && Array.isArray(session.pastedSegmentsDetails)) {
                totalPasteEvents += session.pastedSegmentsDetails.length;
                session.pastedSegmentsDetails.forEach(p => { totalPastedWordsAgg += (p.wordCount || 0); });
            }
            if (session.sentenceStats && Array.isArray(session.sentenceStats)) {
                allSentenceStatsForQR.push(...session.sentenceStats);
            }
            if (session.typingEvents && Array.isArray(session.typingEvents)) {
                allTypingEventsForQR.push(...session.typingEvents);
            }
        });
    
        totalTypedWordsAgg = allSentenceStatsForQR.reduce((sum, s) => sum + (s.typedWords || 0), 0);
        const totalTypingDurationSecFiltered = allSentenceStatsForQR.reduce((sum, s) => sum + ((s.typedDurationMs || 0) / 1000), 0);
        const overallWPMFiltered = totalTypedWordsAgg > 0 && totalTypingDurationSecFiltered > 0 ?
            Math.round(totalTypedWordsAgg / (totalTypingDurationSecFiltered / 60)) : 0;
    
        qrDetails += `FILTERED SESSIONS: ${sessionCount}\n`;
        qrDetails += "------------------------------------------\n";
        qrDetails += "ESSAY WRITING ANALYTICS (JS EDITOR):\n";
        qrDetails += `  Total Focus Time (Filtered): ${formatTime(totalActiveTime)}\n`;
        qrDetails += `  Avg. Typing Speed (Filtered): ${overallWPMFiltered} WPM\n`;
        qrDetails += `  Typed Words (Filtered): ${totalTypedWordsAgg}\n`;
        qrDetails += `  Pasted Words (Filtered): ${totalPastedWordsAgg}\n`;
        qrDetails += `  Typed Chars (Filtered): ${totalTypedChars}\n`;
        qrDetails += `  Pasted Chars (Filtered): ${totalPastedChars}\n`;
        const totalWordsFiltered = totalTypedWordsAgg + totalPastedWordsAgg;
        const pasteRatioWords = totalWordsFiltered > 0 ? ((totalPastedWordsAgg / totalWordsFiltered) * 100).toFixed(1) + '%' : "N/A";
        const totalCharsFiltered = totalTypedChars + totalPastedChars;
        const pasteRatioChars = totalCharsFiltered > 0 ? ((totalPastedChars / totalCharsFiltered) * 100).toFixed(1) + '%' : "N/A";
        qrDetails += `  Paste Ratio (Words, Filtered): ${pasteRatioWords}\n`;
        qrDetails += `  Paste Ratio (Chars, Filtered): ${pasteRatioChars}\n`;
        qrDetails += `  Paste Actions (Filtered): ${totalPasteEvents}\n`;
        qrDetails += `  Backspace Presses (Filtered): ${totalBackspace}\n`;
        qrDetails += `  Delete Presses (Filtered): ${totalDelete}\n`;
        qrDetails += `  Undo Actions (Filtered): ${totalUndo}\n`;
        qrDetails += "------------------------------------------\n";
    
        qrDetails += "TIME ALLOCATION:\n";
        qrDetails += `  JS Editor Focus: ${formatTime(totalActiveTime)}\n`;
        qrDetails += "------------------------------------------\n";
    
        if (totalTypedChars > 0 || totalPastedChars > 0) {
            const totalCompositionChars = totalTypedChars + totalPastedChars;
            const typedPercent = ((totalTypedChars / totalCompositionChars) * 100).toFixed(0);
            const pastedPercent = ((totalPastedChars / totalCompositionChars) * 100).toFixed(0);
            qrDetails += "TEXT COMPOSITION (CHARS):\n";
            qrDetails += `  Typed: ${typedPercent}% (${totalTypedChars} chars)\n`;
            qrDetails += `  Pasted: ${pastedPercent}% (${totalPastedChars} chars)\n`;
            qrDetails += "------------------------------------------\n";
        }
    
        qrDetails += "ANALYZED TEXT SAMPLE (LATEST SESSION IN FILTER):\n";
        let latestSessionWithTextData = null;
        if (filteredData && filteredData.length > 0) {
            for (let i = filteredData.length - 1; i >= 0; i--) {
                if (filteredData[i] && filteredData[i].sentenceStats && filteredData[i].sentenceStats.length > 0) {
                    latestSessionWithTextData = filteredData[i];
                    break;
                }
            }
        }
    
        if (latestSessionWithTextData && latestSessionWithTextData.sentenceStats && latestSessionWithTextData.sentenceStats.length > 0) {
            const MAX_TEXT_SAMPLE_CHARS_QR = 250;
            let currentTextSampleCharsInQR = 0;
            let textSampleForQRLimited = false;
    
            for (const sStat of latestSessionWithTextData.sentenceStats) {
                if (textSampleForQRLimited) break;
                for (const subSeg of (sStat.subSegments || [])) {
                    if (textSampleForQRLimited) break;
                    if (subSeg.text.trim().length === 0 && !subSeg.text.includes('\n')) continue;
    
                    let markerStart = "";
                    let markerEnd = "";
                    const cleanText = subSeg.text.replace(/\[/g, "<LSB>").replace(/\]/g, "<RSB>").replace(/\n/g, "<NL> ");
    
                    if (currentTextSampleCharsInQR + cleanText.length + 30 > MAX_TEXT_SAMPLE_CHARS_QR) {
                        qrDetails += "...(Text Sample Truncated for QR)...\n";
                        textSampleForQRLimited = true;
                        break;
                    }
    
                    if (subSeg.type === 'pasted') {
                        markerStart = "[PASTED_RED_MESH]"; markerEnd = "[/PASTED_RED_MESH]";
                    } else {
                        if (sStat.totalCorrections > 0) {
                            markerStart = "[CORRECTED_GREEN]"; markerEnd = "[/CORRECTED_GREEN]";
                        } else {
                            markerStart = "[TYPED_YELLOW]"; markerEnd = "[/TYPED_YELLOW]";
                        }
                    }
                    qrDetails += `${markerStart}${cleanText}${markerEnd} `;
                    currentTextSampleCharsInQR += markerStart.length + cleanText.length + markerEnd.length + 1;
                }
                if (!textSampleForQRLimited) qrDetails += "\n";
            }
            if (!textSampleForQRLimited && latestSessionWithTextData.sentenceStats.length === 0) {
                 qrDetails += "  (No detailed sentence segments found in latest session of filter)\n";
            }
        } else if (latestSessionWithTextData && latestSessionWithTextData.currentFullText) {
            const fullTextSample = latestSessionWithTextData.currentFullText.substring(0, 200).replace(/\[/g, "<LSB>").replace(/\]/g, "<RSB>").replace(/\n/g, " <NL> ");
            qrDetails += `  [TYPED_YELLOW]${fullTextSample}${latestSessionWithTextData.currentFullText.length > 200 ? "..." : ""}[/TYPED_YELLOW]\n`;
        } else {
            qrDetails += "  (No text data available in latest session of filter)\n";
        }
        qrDetails += "------------------------------------------\n";
    
        if (allSentenceStatsForQR.length > 0) {
            qrDetails += "PER SENTENCE SUMMARY (AVERAGES OVER FILTERED SENTENCES):\n";
            let sumWPM = 0, countWPM = 0, avgTypedC = 0, avgDurationS = 0, avgBS = 0, avgDel = 0, avgPasteC = 0;
            allSentenceStatsForQR.forEach(s => {
                if (s.wpm && s.wpm > 0) { sumWPM += s.wpm; countWPM++; }
                avgTypedC += (s.typedChars || 0);
                avgDurationS += ((s.typedDurationMs || 0) / 1000);
                avgBS += (s.backspaces || 0);
                avgDel += (s.deletes || 0);
                avgPasteC += (s.pastedCharsInSentence || 0);
            });
            const numSentences = allSentenceStatsForQR.length;
            qrDetails += `  Avg WPM: ${(countWPM > 0 ? sumWPM / countWPM : 0).toFixed(0)}\n`;
            qrDetails += `  Avg Typed Chars: ${(avgTypedC / numSentences).toFixed(1)}\n`;
            qrDetails += `  Avg Duration (s): ${(avgDurationS / numSentences).toFixed(1)}\n`;
            qrDetails += `  Avg Backspaces: ${(avgBS / numSentences).toFixed(1)}\n`;
            qrDetails += `  Avg Deletes: ${(avgDel / numSentences).toFixed(1)}\n`;
            qrDetails += `  Avg Pasted Chars: ${(avgPasteC / numSentences).toFixed(1)}\n`;
            qrDetails += "------------------------------------------\n";
        }
    
        qrDetails += "TYPING RHYTHM (ACTIVITY PULSES):\n";
        if (allTypingEventsForQR.length > 0) {
            const pauses = allTypingEventsForQR.filter(e => e.type === 'pause' && e.durationMs > 1500);
            const shortPauses = allTypingEventsForQR.filter(e => e.type === 'pause' && e.durationMs > 500 && e.durationMs <= 1500);
            const charsTypedEvents = allTypingEventsForQR.filter(e => e.type === 'char' || e.type === 'chars_block');
            qrDetails += `  Total Recorded Events: ${allTypingEventsForQR.length}\n`;
            qrDetails += `  Significant Pauses (>1.5s): ${pauses.length}\n`;
            qrDetails += `  Short Pauses (0.5-1.5s): ${shortPauses.length}\n`;
            qrDetails += `  Typing Bursts (char/block events): ${charsTypedEvents.length}\n`;
        } else {
            qrDetails += "  (No detailed typing events for rhythm analysis)\n";
        }
        qrDetails += "------------------------------------------\n";
    
        const dailyAggForQR = {};
        filteredData.forEach(session => {
            const date = formatDate(session.startTime);
            if (!dailyAggForQR[date]) { dailyAggForQR[date] = { typedWords: 0, activeTimeMs: 0, pasteEvents: 0, typedChars: 0, pastedChars: 0, backspaces: 0, deletes: 0, undos: 0, focusTimeMs: 0 }; }
            (session.sentenceStats || []).forEach(s => {
                dailyAggForQR[date].typedWords += (s.typedWords || 0);
                dailyAggForQR[date].typedChars += (s.typedChars || 0);
            });
            dailyAggForQR[date].activeTimeMs += (session.totalActiveTimeMs || 0);
            dailyAggForQR[date].focusTimeMs += (session.totalActiveTimeMs || 0);
            dailyAggForQR[date].pasteEvents += (session.pastedSegmentsDetails || []).length;
            dailyAggForQR[date].pastedChars += (session.pastedChars || 0);
            dailyAggForQR[date].backspaces += (session.backspaceCount || 0);
            dailyAggForQR[date].deletes += (session.deleteCount || 0);
            dailyAggForQR[date].undos += (session.undoCount || 0);
        });
    
        const dailyLabelsForQR = Object.keys(dailyAggForQR).sort((a, b) => new Date(a) - new Date(b));
        if (dailyLabelsForQR.length > 0) {
            qrDetails += "DAILY ACTIVITY SUMMARY (SAMPLE OF DAYS):\n";
            const maxDaysToShow = Math.min(dailyLabelsForQR.length, 2);
            for (let i = 0; i < maxDaysToShow; i++) {
                const date = dailyLabelsForQR[i];
                const dayData = dailyAggForQR[date];
                qrDetails += `  ${date}: Words ${dayData.typedWords}, Focus ${formatTime(dayData.focusTimeMs)}, Pastes ${dayData.pasteEvents}\n`;
            }
            if (dailyLabelsForQR.length > maxDaysToShow) qrDetails += "  ... (more days in full report) ...\n";
            qrDetails += "------------------------------------------\n";
        }
    
        qrDetails += "HOURLY & DAILY TRENDS:\n";
        qrDetails += "  (Detailed hourly/daily charts... are available in the interactive dashboard.)\n";
        qrDetails += "  Key daily averages (overall):\n";
        if (dailyLabelsForQR.length > 0) {
            let wpmSum = 0, wpmDays = 0, avgDailyTypedChars = 0, avgDailyFocusMins = 0;
            dailyLabelsForQR.forEach(date => {
                const dayData = dailyAggForQR[date];
                const dayWPM = (dayData.typedWords > 0 && dayData.focusTimeMs > 0) ? Math.round(dayData.typedWords / (dayData.focusTimeMs / 60000)) : 0;
                if (dayWPM > 0) { wpmSum += dayWPM; wpmDays++; }
                avgDailyTypedChars += dayData.typedChars;
                avgDailyFocusMins += (dayData.focusTimeMs / 60000);
            });
            qrDetails += `    Avg. WPM: ${(wpmDays > 0 ? wpmSum/wpmDays : 0).toFixed(0)}\n`;
            qrDetails += `    Avg. Typed Chars/Day: ${(avgDailyTypedChars / dailyLabelsForQR.length).toFixed(0)}\n`;
            qrDetails += `    Avg. Focus Mins/Day: ${(avgDailyFocusMins / dailyLabelsForQR.length).toFixed(1)}\n`;
        } else {
            qrDetails += "    (No daily data for averages)\n";
        }
        qrDetails += "==========================================\n";
    
        const MAX_QR_CHARS = 1200;
        if (qrDetails.length > MAX_QR_CHARS) {
            qrDetails = qrDetails.substring(0, MAX_QR_CHARS - 35) + "\n... (REPORT HEAVILY TRUNCATED)";
        }
        
        const qrEl = kjua({
            text: qrDetails, render: 'svg', crisp: true, size: 320,
            fill: getThemeColor('--text-primary', '#000'), back: getThemeColor('--editor-bg', '#fff'),
            rounded: 30, quiet: 1,
        });
        qrContainer.appendChild(qrEl);
    }

    // Event Listeners
    applyFilterBtn.addEventListener('click', () => updateDashboard(getFilteredData()));
    resetFilterBtn.addEventListener('click', () => { filterStartDateEl.value = ''; filterEndDateEl.value = ''; updateDashboard(allSessionsData); });
    printDashboardBtn.addEventListener('click', () => window.print());
    refreshDataBtn.addEventListener('click', () => { loadData(); const currentFilteredData = getFilteredData(); updateDashboard(currentFilteredData.length > 0 ? currentFilteredData : allSessionsData); });
    
    // Theme handling
    function applyThemeDashboard(themeName, fromMessage = false) {
        document.body.className = ''; document.body.classList.add(`theme-${themeName}`);
        if (!fromMessage) localStorage.setItem(THEME_STORAGE_KEY, themeName);
        const dataForUpdate = getFilteredData();
        updateDashboard(Array.isArray(dataForUpdate) && dataForUpdate.length > 0 ? dataForUpdate : allSessionsData);
    }
    window.addEventListener('message', (event) => { if (event.data && event.data.type === 'SET_THEME') applyThemeDashboard(event.data.theme, true); });
    let initialTheme = (window.location.hash && window.location.hash.startsWith('#theme=')) ? window.location.hash.substring(7) : (localStorage.getItem(THEME_STORAGE_KEY) || 'dark');
    applyThemeDashboard(initialTheme);
    loadData();
    updateDashboard(allSessionsData);
});