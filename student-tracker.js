document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const textInput = document.getElementById('textInput'); // Assume your HTML has this textarea
    const analysisReportDiv = document.getElementById('analysisReport');
    const reportContentDiv = document.getElementById('reportContent');
    const highlightedOutputDiv = document.getElementById('highlightedOutput');
    const analyzeBtn = document.getElementById('analyzeBtn'); // Your "Analyze" button
    const printBtn = document.getElementById('printBtn');     // Your "Print" button

    const themeLightBtn = document.getElementById('themeLightBtn'); // Button for Light Theme
    const themeDarkBtn = document.getElementById('themeDarkBtn');   // Button for Dark Theme
    const themeBlueNeonBtn = document.getElementById('themeBlueNeonBtn'); // Button for Blue Neon

    const historyContentDiv = document.getElementById('historyContent');
    const historyFilterDate = document.getElementById('historyFilterDate');
    const historyFilterHour = document.getElementById('historyFilterHour');
    const loadHistoryBtn = document.getElementById('loadHistoryBtn');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');

    const qrCanvas = document.getElementById('qrCanvas');

    // Chart instances (will be initialized later)
    let typingSpeedChartInstance, charActionsChartInstance, keyPressChartInstance, dailyActivityChartInstance;

    // --- State Variables ---
    let sessionData = resetSessionData();
    let charEvents = []; // To store detailed character events (timestamp, type, char, etc.)
    let sentenceTimings = []; // [{text, startTime, endTime, typedChars}]

    const TRACKING_STORAGE_KEY = 'studentTypingHistory';
    const THEME_KEY = 'studentTrackerTheme';

    // --- Core Logic ---

    function resetSessionData() {
        return {
            startTime: null,
            endTime: null,
            typedChars: 0,
            pastedChars: 0,
            pastedWords: 0, // Count of words in pasted text
            backspaceCount: 0,
            deleteCount: 0,
            rawText: '',
        };
    }

    textInput.addEventListener('focus', () => {
        if (!sessionData.startTime) {
            sessionData.startTime = Date.now();
            console.log("Session started at:", new Date(sessionData.startTime).toLocaleTimeString());
        }
    });

    textInput.addEventListener('paste', (e) => {
        const pastedText = (e.clipboardData || window.clipboardData).getData('text');
        sessionData.pastedChars += pastedText.length;
        sessionData.pastedWords += countWords(pastedText);

        const selectionStart = textInput.selectionStart;
        charEvents.push({
            type: 'paste',
            text: pastedText,
            start: selectionStart,
            end: selectionStart + pastedText.length,
            timestamp: Date.now()
        });
        console.log(`Pasted: ${pastedText.length} chars, ${countWords(pastedText)} words`);
    });

    textInput.addEventListener('input', (e) => {
        if (!sessionData.startTime) sessionData.startTime = Date.now();

        // For differentiating typed vs pasted, we rely on keydown for typed chars
        // and the paste event for pasted chars. 'input' is more for overall text change.
    });

    textInput.addEventListener('keydown', (e) => {
        if (!sessionData.startTime) sessionData.startTime = Date.now();
        const currentTime = Date.now();

        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) { // Regular typed character
            sessionData.typedChars++;
            charEvents.push({
                type: 'type',
                char: e.key,
                position: textInput.selectionStart,
                timestamp: currentTime
            });
        } else if (e.key === 'Backspace') {
            sessionData.backspaceCount++;
            charEvents.push({ type: 'backspace', position: textInput.selectionStart, timestamp: currentTime });
        } else if (e.key === 'Delete') {
            sessionData.deleteCount++;
            charEvents.push({ type: 'delete', position: textInput.selectionStart, timestamp: currentTime });
        }
        // Detecting start/end of sentences for speed calculation is complex here.
        // A simpler approach for per-sentence speed: analyze after session.
    });

    analyzeBtn.addEventListener('click', analyzeCurrentSession);
    printBtn.addEventListener('click', () => window.print());

    // --- Analysis and Reporting ---
    function analyzeCurrentSession() {
        if (!sessionData.startTime || textInput.value.trim() === "") {
            alert("Please type some text or ensure the session has started.");
            return;
        }
        sessionData.endTime = Date.now();
        sessionData.rawText = textInput.value;

        const totalSessionTimeMs = sessionData.endTime - sessionData.startTime;
        const totalSessionTimeMinutes = totalSessionTimeMs / 60000;

        // Approximate Average WPM (based on typed chars only)
        const averageWPM = totalSessionTimeMinutes > 0 ?
            ((sessionData.typedChars / 5) / totalSessionTimeMinutes) : 0;

        // Sentence analysis (Simplified)
        const sentences = splitTextIntoSentences(sessionData.rawText);
        sentenceTimings = analyzeSentenceSpeeds(sentences, charEvents, sessionData.startTime);

        // --- Build Report ---
        let reportHTML = `<p><strong>Session Duration:</strong> ${formatTimeDuration(totalSessionTimeMs)}</p>`;
        reportHTML += `<p><strong>Total Characters (Final Text):</strong> ${sessionData.rawText.length}</p>`;
        reportHTML += `<p><strong>Characters Typed:</strong> ${sessionData.typedChars}</p>`;
        reportHTML += `<p><strong>Characters Pasted:</strong> ${sessionData.pastedChars}</p>`;
        reportHTML += `<p><strong>Words Pasted:</strong> ${sessionData.pastedWords}</p>`;
        reportHTML += `<p><strong>Backspace Presses:</strong> ${sessionData.backspaceCount}</p>`;
        reportHTML += `<p><strong>Delete Presses:</strong> ${sessionData.deleteCount}</p>`;
        reportHTML += `<p><strong>Overall Average Typing Speed:</strong> ${averageWPM.toFixed(1)} WPM</p>`;

        reportHTML += `<h3>Sentence Typing Speeds:</h3><ul>`;
        sentenceTimings.forEach((s, index) => {
            reportHTML += `<li>Sentence ${index + 1} (${s.text.length} chars): ${s.wpm.toFixed(1)} WPM (Typed: ${s.typedChars})</li>`;
        });
        reportHTML += `</ul>`;

        reportContentDiv.innerHTML = reportHTML;
        analysisReportDiv.style.display = 'block';
        printBtn.style.display = 'inline-block';

        // --- Generate Charts ---
        generateAllCharts(averageWPM, sentenceTimings, sessionData);

        // --- Highlight Text ---
        highlightOutputText(sessionData.rawText, charEvents, sentenceTimings, averageWPM);

        // --- QR Code ---
        const reportSummaryForQR = {
            sessionTime: formatTimeDuration(totalSessionTimeMs),
            typedChars: sessionData.typedChars,
            pastedChars: sessionData.pastedChars,
            avgWPM: averageWPM.toFixed(1),
            backspaces: sessionData.backspaceCount,
            timestamp: new Date().toISOString() // For uniqueness
        };
        generateQRCode(JSON.stringify(reportSummaryForQR));

        // --- Save to History ---
        saveSessionToHistory({
            timestamp: sessionData.startTime, // Use session start as the main timestamp
            endTime: sessionData.endTime,
            durationMs: totalSessionTimeMs,
            typedChars: sessionData.typedChars,
            pastedChars: sessionData.pastedChars,
            pastedWords: sessionData.pastedWords,
            backspaceCount: sessionData.backspaceCount,
            deleteCount: sessionData.deleteCount,
            avgWPM: parseFloat(averageWPM.toFixed(1)),
            sentenceDetails: sentenceTimings.map(s => ({ len: s.text.length, wpm: s.wpm, typed: s.typedChars }))
        });

        // --- Reset for next session ---
        // textInput.value = ''; // Optional: clear input for next use
        // sessionData = resetSessionData();
        // charEvents = [];
        // sentenceTimings = [];
        // highlightedOutputDiv.innerHTML = ''; // Clear highlights

        // Refresh history view and filters
        populateHistoryFilters();
        loadAndDisplayHistory();
    }

    function countWords(text) {
        if (!text || typeof text !== 'string') return 0;
        return text.trim().split(/\s+/).filter(Boolean).length;
    }

    function formatTimeDuration(ms) {
        if (ms === null || ms < 0) return "N/A";
        let seconds = Math.floor(ms / 1000);
        let minutes = Math.floor(seconds / 60);
        let hours = Math.floor(minutes / 60);
        seconds = seconds % 60;
        minutes = minutes % 60;
        return `${hours > 0 ? hours + "h " : ""}${minutes > 0 ? minutes + "m " : ""}${seconds}s`;
    }

    function splitTextIntoSentences(text) {
        // Basic sentence splitter. More robust NLP is complex.
        return text.match(/[^.!?]+[.!?]+/g) || [text]; // Returns array of sentences
    }

    function analyzeSentenceSpeeds(sentences, allCharEvents, sessionStartTime) {
        let analyzedSentences = [];
        let currentTextPosition = 0;
        let lastEventTime = sessionStartTime;

        sentences.forEach(sentenceText => {
            const sentenceStartPos = sessionData.rawText.indexOf(sentenceText, currentTextPosition);
            const sentenceEndPos = sentenceStartPos + sentenceText.length;

            let sentenceTypedChars = 0;
            let sentenceStartTime = lastEventTime; // Approx start time
            let sentenceEndTime = lastEventTime;   // Approx end time

            let firstCharTime = null;
            let lastCharTime = null;

            // Filter events relevant to this sentence's character range
            allCharEvents.forEach(event => {
                if (event.timestamp >= lastEventTime && event.position >= sentenceStartPos && event.position < sentenceEndPos) {
                    if (event.type === 'type') {
                        sentenceTypedChars++;
                        if (!firstCharTime) firstCharTime = event.timestamp;
                        lastCharTime = event.timestamp;
                    }
                    // Note: Pasted characters within a sentence are harder to isolate perfectly
                    // without complex diffing against the paste events.
                    // For simplicity, we're focusing on WPM of *typed* portions.
                    sentenceEndTime = Math.max(sentenceEndTime, event.timestamp);
                }
            });

            if(firstCharTime === null && sentenceTypedChars === 0) { // Likely fully pasted sentence
                firstCharTime = lastEventTime; // Assume it appeared at the time of the last event before it
                lastCharTime = lastEventTime + 100; // Arbitrary small duration if fully pasted
            } else if (firstCharTime === null && sentenceTypedChars > 0){
                 firstCharTime = lastEventTime; // Fallback if type events didn't capture start well
            }


            const durationMs = (lastCharTime && firstCharTime) ? (lastCharTime - firstCharTime) : (sentenceTypedChars > 0 ? 1000 : 0); // Avoid division by zero
            const durationMinutes = durationMs / 60000;
            const wpm = (durationMinutes > 0 && sentenceTypedChars > 0) ?
                        ((sentenceTypedChars / 5) / durationMinutes) : 0;

            analyzedSentences.push({
                text: sentenceText,
                typedChars: sentenceTypedChars,
                wpm: isFinite(wpm) ? wpm : 0,
                startTime: firstCharTime || sentenceStartTime,
                endTime: lastCharTime || sentenceEndTime,
                durationMs: durationMs
            });

            lastEventTime = Math.max(lastEventTime, sentenceEndTime); // Update for next sentence's start
            currentTextPosition = sentenceEndPos;
        });
        return analyzedSentences;
    }


    function highlightOutputText(fullText, events, sentenceDetails, overallAvgWPM) {
        highlightedOutputDiv.innerHTML = '';
        let currentTextIndex = 0;
        const VERY_FAST_WPM_THRESHOLD = overallAvgWPM * 1.30; // 30% faster than average
        const LOW_WPM_THRESHOLD = overallAvgWPM * 0.70; // Example for "slow"

        // Create segments based on paste events first
        let segments = [];
        events.filter(e => e.type === 'paste').sort((a,b) => a.start - b.start).forEach(pasteEvent => {
            // Text before this paste (if any)
            if (pasteEvent.start > currentTextIndex) {
                segments.push({
                    text: fullText.substring(currentTextIndex, pasteEvent.start),
                    type: 'typed'
                });
            }
            // The pasted text
            segments.push({
                text: pasteEvent.text,
                type: 'pasted'
            });
            currentTextIndex = pasteEvent.end;
        });

        // Any remaining text after the last paste
        if (currentTextIndex < fullText.length) {
            segments.push({ text: fullText.substring(currentTextIndex), type: 'typed' });
        }

        // Now, iterate through segments and apply highlighting based on sentence WPMs
        let textPointer = 0;
        segments.forEach(segment => {
            const span = document.createElement('span');
            span.textContent = segment.text;

            if (segment.type === 'pasted') {
                span.className = 'highlight-red'; // Red for pasted
            } else { // Typed segment
                // Find which sentence this typed segment (or part of it) belongs to
                let appliedClass = 'highlight-green'; // Default to green
                let segmentFullyProcessed = false;

                for (const sentence of sentenceDetails) {
                    const sentenceStartInFullText = sessionData.rawText.indexOf(sentence.text);
                    const sentenceEndInFullText = sentenceStartInFullText + sentence.text.length;

                    // Check if the current typed segment overlaps with this sentence
                    const segmentStartInFullText = textPointer;
                    const segmentEndInFullText = textPointer + segment.text.length;

                    if (Math.max(segmentStartInFullText, sentenceStartInFullText) < Math.min(segmentEndInFullText, sentenceEndInFullText)) {
                        // Overlap exists
                        if (sentence.typedChars === 0 && sentence.text.length > 0) { // Sentence fully pasted (or no typed chars recorded)
                            // This case should ideally be caught by the 'pasted' segment type,
                            // but if a sentence analysis identifies it as 0 typed chars, treat as red.
                            // appliedClass = 'highlight-red';
                        } else if (sentence.wpm > VERY_FAST_WPM_THRESHOLD) {
                            appliedClass = 'highlight-yellow'; // Yellow for very fast
                        } else if (sentence.wpm < LOW_WPM_THRESHOLD && sentence.wpm > 0) {
                            // Green can also cover slow typing if desired, or make another class
                            appliedClass = 'highlight-green'; // Green for made corrections or slow
                        } else {
                            appliedClass = 'highlight-green'; // Normal speed, likely with some corrections
                        }
                        span.className = appliedClass;
                        segmentFullyProcessed = true;
                        break; // Found the sentence, apply its class
                    }
                }
                 if (!segmentFullyProcessed) { // Fallback for typed segments not aligning with sentence WPM (e.g. partial sentences)
                    span.className = 'highlight-green';
                }
            }
            highlightedOutputDiv.appendChild(span);
            textPointer += segment.text.length;
        });
    }

    // --- Charting ---
    function generateAllCharts(averageWPM, sentenceTimings, sessionStats) {
        // 1. Typing Speed per Sentence (Line Chart)
        if (typingSpeedChartInstance) typingSpeedChartInstance.destroy();
        const speedCtx = document.getElementById('typingSpeedChart').getContext('2d');
        typingSpeedChartInstance = new Chart(speedCtx, {
            type: 'line',
            data: {
                labels: sentenceTimings.map((s, i) => `S${i + 1} (${s.text.length}c)`),
                datasets: [{
                    label: 'WPM per Sentence',
                    data: sentenceTimings.map(s => s.wpm.toFixed(1)),
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    tension: 0.1,
                    fill: true
                }]
            },
            options: { scales: { y: { beginAtZero: true, title: { display: true, text: 'WPM' } } } }
        });

        // 2. Character Actions (Pie Chart: Typed vs Pasted)
        if (charActionsChartInstance) charActionsChartInstance.destroy();
        const charActionsCtx = document.getElementById('charActionsChart').getContext('2d');
        charActionsChartInstance = new Chart(charActionsCtx, {
            type: 'pie',
            data: {
                labels: ['Typed Characters', 'Pasted Characters'],
                datasets: [{
                    data: [sessionStats.typedChars, sessionStats.pastedChars],
                    backgroundColor: ['rgb(54, 162, 235)', 'rgb(255, 99, 132)'],
                }]
            },
            options: { plugins: { title: { display: true, text: 'Typed vs. Pasted Characters' } } }
        });

        // 3. Key Presses (Bar Chart: Backspace, Delete)
        if (keyPressChartInstance) keyPressChartInstance.destroy();
        const keyPressCtx = document.getElementById('keyPressChart').getContext('2d');
        keyPressChartInstance = new Chart(keyPressCtx, {
            type: 'bar',
            data: {
                labels: ['Backspace', 'Delete'],
                datasets: [{
                    label: 'Correction Key Presses',
                    data: [sessionStats.backspaceCount, sessionStats.deleteCount],
                    backgroundColor: ['rgb(255, 159, 64)', 'rgb(255, 205, 86)'],
                }]
            },
            options: { scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
        });

        // 4. Daily Activity Chart is updated by loadAndDisplayHistory()
        updateDailyActivityChart();
    }

    function updateDailyActivityChart() {
        if (dailyActivityChartInstance) dailyActivityChartInstance.destroy();
        const history = getHistoryData(); // Get all history
        if (!history || history.length === 0) return;

        const dailyData = {}; // { 'YYYY-MM-DD': { typedChars: X, durationMs: Y, sessions: Z } }
        history.forEach(item => {
            const itemDate = new Date(item.timestamp).toISOString().slice(0, 10);
            if (!dailyData[itemDate]) {
                dailyData[itemDate] = { typedChars: 0, durationMs: 0, sessions: 0, wpmSum: 0, wpmCount: 0 };
            }
            dailyData[itemDate].typedChars += item.typedChars || 0;
            dailyData[itemDate].durationMs += item.durationMs || 0;
            dailyData[itemDate].sessions++;
            if (item.avgWPM) {
                dailyData[itemDate].wpmSum += item.avgWPM;
                dailyData[itemDate].wpmCount++;
            }
        });

        const sortedDates = Object.keys(dailyData).sort();
        const chartLabels = sortedDates;
        const typedCharsData = sortedDates.map(date => dailyData[date].typedChars);
        const avgWPMData = sortedDates.map(date => dailyData[date].wpmCount > 0 ? (dailyData[date].wpmSum / dailyData[date].wpmCount) : 0);
        const durationData = sortedDates.map(date => (dailyData[date].durationMs / 60000).toFixed(1)); // Duration in minutes

        const dailyCtx = document.getElementById('dailyActivityChart').getContext('2d');
        dailyActivityChartInstance = new Chart(dailyCtx, {
            type: 'bar',
            data: {
                labels: chartLabels,
                datasets: [
                    {
                        label: 'Total Characters Typed',
                        data: typedCharsData,
                        backgroundColor: 'rgba(75, 192, 192, 0.7)',
                        yAxisID: 'yChars',
                    },
                    {
                        label: 'Average WPM',
                        data: avgWPMData,
                        backgroundColor: 'rgba(153, 102, 255, 0.7)',
                        type: 'line', // Overlay as a line
                        yAxisID: 'yWPM',
                        tension: 0.1,
                        borderColor: 'rgba(153, 102, 255, 1)',
                    },
                ]
            },
            options: {
                responsive: true, maintainAspectRatio:false,
                plugins: { title: { display: true, text: 'Daily Typing Activity' } },
                scales: {
                    x: { title: { display: true, text: 'Date' } },
                    yChars: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Characters Typed' }, beginAtZero: true },
                    yWPM: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'Avg WPM' }, grid: { drawOnChartArea: false }, beginAtZero: true }
                }
            }
        });
    }


    // --- QR Code ---
    function generateQRCode(dataString) {
        QRCode.toCanvas(qrCanvas, dataString, { width: 180, errorCorrectionLevel: 'L' }, function (error) {
            if (error) console.error("QR Code Error:", error);
            else console.log('QR code generated for report summary.');
        });
    }

    // --- History Management ---
    function getHistoryData() {
        return JSON.parse(localStorage.getItem(TRACKING_STORAGE_KEY)) || [];
    }

    function saveSessionToHistory(sessionSummary) {
        let history = getHistoryData();
        history.unshift(sessionSummary); // Add to the beginning
        if (history.length > 100) history.pop(); // Limit history size
        localStorage.setItem(TRACKING_STORAGE_KEY, JSON.stringify(history));
    }

    function populateHistoryFilters() {
        const history = getHistoryData();
        const dates = new Set();
        const hours = new Set();

        history.forEach(item => {
            const d = new Date(item.timestamp);
            dates.add(d.toISOString().slice(0,10));
            hours.add(d.getHours().toString().padStart(2, '0'));
        });

        // Populate Date Filter
        historyFilterDate.innerHTML = '<option value="">All Dates</option>';
        Array.from(dates).sort().reverse().forEach(date => {
            const option = document.createElement('option');
            option.value = date; option.textContent = date;
            historyFilterDate.appendChild(option);
        });

        // Populate Hour Filter
        historyFilterHour.innerHTML = '<option value="">All Hours</option>';
        Array.from(hours).sort((a,b) => parseInt(a) - parseInt(b)).forEach(hour => {
            const option = document.createElement('option');
            option.value = hour; option.textContent = `${hour}:00 - ${hour}:59`;
            historyFilterHour.appendChild(option);
        });
    }

    function loadAndDisplayHistory() {
        let history = getHistoryData();
        const filterDateVal = historyFilterDate.value;
        const filterHourVal = historyFilterHour.value;

        const filteredHistory = history.filter(item => {
            const itemDate = new Date(item.timestamp);
            const itemDateStr = itemDate.toISOString().slice(0, 10);
            const itemHourStr = itemDate.getHours().toString().padStart(2, '0');

            const dateMatch = !filterDateVal || (itemDateStr === filterDateVal);
            const hourMatch = !filterHourVal || (itemHourStr === filterHourVal);
            return dateMatch && hourMatch;
        });

        historyContentDiv.innerHTML = '';
        if (filteredHistory.length === 0) {
            historyContentDiv.innerHTML = '<p>No matching history records found.</p>';
        } else {
            const ul = document.createElement('ul');
            ul.style.listStyleType = 'none';
            ul.style.paddingLeft = '0';
            filteredHistory.forEach(item => {
                const li = document.createElement('li');
                li.style.marginBottom = '10px';
                li.style.padding = '8px';
                li.style.border = '1px solid #ccc';
                li.style.borderRadius = '4px';
                const itemDateTime = new Date(item.timestamp).toLocaleString();
                li.innerHTML = `<strong>${itemDateTime}</strong> - ${formatTimeDuration(item.durationMs)}<br>
                                Typed: ${item.typedChars}, Pasted: ${item.pastedChars}, Avg WPM: ${item.avgWPM}<br>
                                Backspace: ${item.backspaceCount}, Delete: ${item.deleteCount}`;
                ul.appendChild(li);
            });
            historyContentDiv.appendChild(ul);
        }
        updateDailyActivityChart(); // Update chart with potentially filtered data scope
    }
    
    if(loadHistoryBtn) loadHistoryBtn.addEventListener('click', loadAndDisplayHistory);
    if(clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', () => {
            if (confirm("Are you sure you want to clear all tracking history?")) {
                localStorage.removeItem(TRACKING_STORAGE_KEY);
                loadAndDisplayHistory(); // Refresh view (will show no history)
                populateHistoryFilters(); // Clear filters
                if (dailyActivityChartInstance) dailyActivityChartInstance.destroy(); // Clear daily chart too
            }
        });
    }

    // --- Theme Management ---
    function applySelectedTheme(themeName) {
        document.body.classList.remove('theme-light', 'theme-dark', 'theme-blue-neon');
        if (themeName) {
            document.body.classList.add(themeName);
        }
        localStorage.setItem(THEME_KEY, themeName);
    }

    if (themeLightBtn) themeLightBtn.addEventListener('click', () => applySelectedTheme('theme-light'));
    if (themeDarkBtn) themeDarkBtn.addEventListener('click', () => applySelectedTheme('theme-dark'));
    if (themeBlueNeonBtn) themeBlueNeonBtn.addEventListener('click', () => applySelectedTheme('theme-blue-neon'));

    // --- Initial Setup ---
    const savedTheme = localStorage.getItem(THEME_KEY);
    applySelectedTheme(savedTheme || 'theme-light'); // Default to light or saved theme

    populateHistoryFilters();
    loadAndDisplayHistory();
});