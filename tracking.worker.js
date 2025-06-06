let currentSession = null;
let allSessionsData = []; // This would be loaded from/synced with localStorage by the main thread or here if allowed
const IDLE_TIMEOUT = 30 * 1000; // 30 seconds for idle
let lastActivityTimestamp = Date.now();
let idleTimer = null;
console.log("worker");
// Helper to count words (simple split by space)
function countWords(str) {
    return str.trim().split(/\s+/).filter(Boolean).length;
}

function initializeSession() {
    lastActivityTimestamp = Date.now();
    return {
        sessionId: 'sess_' + Date.now() + Math.random().toString(16).slice(2),
        startTime: Date.now(),
        endTime: null,
        totalActiveTimeMs: 0,
        lastActiveStartTimestamp: Date.now(),
        isIdle: false,
        typedChars: 0,
        pastedChars: 0,
        pastedSegmentsDetails: [], // { timestamp, text, charCount, wordCount }
        backspaceCount: 0,
        pastedTextJustProcessed: null,
        deleteCount: 0,
        contentSegments: [], // { text: "...", category: "...", details: "..." }
        sentenceStats: [], // { text, wpm, cpm, typedDurationMs, typedChars, typedWords, startTime, endTime, backspaces, deletes }
        currentFullText: "", // Keep track of the full text for analysis
        currentSentenceBuffer: "",
        currentSentenceStartTime: null,
        currentSentenceTypedChars: 0,
        currentSentenceBackspaces: 0,
        undoCount: 0,
        currentSentenceUndos: 0, // <<< ADD THIS LINE

        currentSentenceDeletes: 0,
        typingEvents: [],
        lastCharTimestamp: null,
        overallAverageWPM: 0, // Track evolving average WPM
        sentenceCountForAvg: 0  // How many sentences contributed to the average

    };
}
function updateOverallAverageWPM(newSentenceWPM) {
    if (!currentSession || newSentenceWPM <= 0) return; // Ignore non-positive WPM

    // Weighted average: give more weight to existing average if many sentences contributed
    const existingTotalWPM = currentSession.overallAverageWPM * currentSession.sentenceCountForAvg;
    currentSession.sentenceCountForAvg++;
    currentSession.overallAverageWPM = (existingTotalWPM + newSentenceWPM) / currentSession.sentenceCountForAvg;
}



function updateActiveTime() {
    if (currentSession && !currentSession.isIdle && currentSession.lastActiveStartTimestamp) {
        currentSession.totalActiveTimeMs += Date.now() - currentSession.lastActiveStartTimestamp;
        currentSession.lastActiveStartTimestamp = Date.now(); // Reset for next active period
    }
}

function checkIdle() {
    if (Date.now() - lastActivityTimestamp > IDLE_TIMEOUT) {
        if (currentSession && !currentSession.isIdle) {
            currentSession.isIdle = true;
            updateActiveTime(); // Log time before becoming idle
          console.log("object");
            postMessage({ type: 'STATUS_UPDATE', session: currentSession, isIdle: true });
        }
    } else {
        if (currentSession && currentSession.isIdle) {
            currentSession.isIdle = false;
            currentSession.lastActiveStartTimestamp = Date.now(); // Restart active timing
            console.log("object");

            postMessage({ type: 'STATUS_UPDATE', session: currentSession, isIdle: false });
        }
    }
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(checkIdle, IDLE_TIMEOUT / 2); // Check periodically
}

function processSentenceCompletion(fullSentenceText) {
    if (!currentSession || !currentSession.currentSentenceStartTime || currentSession.currentSentenceTypedChars === 0) {
        // Reset and return if sentence is not valid for processing
        currentSession.currentSentenceBuffer = "";
        currentSession.currentSentenceTypedChars = 0;
        currentSession.currentSentenceStartTime = null;
        currentSession.currentSentenceBackspaces = 0;
        currentSession.currentSentenceDeletes = 0;
       
        currentSession.currentSentenceUndos = 0; // Reset undos
        return;
    }

    const endTime = Date.now();
    const durationMs = endTime - currentSession.currentSentenceStartTime;
   
   
    if (durationMs < 100) { // Sentence too short
        currentSession.currentSentenceBuffer = "";
        currentSession.currentSentenceTypedChars = 0;
        currentSession.currentSentenceStartTime = null;
        currentSession.currentSentenceBackspaces = 0;
        currentSession.currentSentenceDeletes = 0;
        currentSession.currentSentenceUndos = 0; // Reset undos
        return;
    }


    const durationSec = durationMs / 1000;
    const typedWords = countWords(fullSentenceText);
    const wpm = typedWords > 0 ? Math.round((typedWords / durationSec) * 60) : 0;
    const cpm = currentSession.currentSentenceTypedChars > 0 ? Math.round((currentSession.currentSentenceTypedChars / durationSec) * 60) : 0;

    let pasteInfluence = 0;
    if (currentSession.pastedSegmentsDetails.length > 0) {
        const lastPaste = currentSession.pastedSegmentsDetails[currentSession.pastedSegmentsDetails.length - 1];
        if (lastPaste.timestamp >= currentSession.currentSentenceStartTime && lastPaste.timestamp <= endTime) {
            if (fullSentenceText.includes(lastPaste.text)) {
                 pasteInfluence = lastPaste.charCount;
            }
        }
    }

    let category = 'highlight-typed'; // Default
    const backspaces = currentSession.currentSentenceBackspaces;
    const deletes = currentSession.currentSentenceDeletes;
    const undos = currentSession.currentSentenceUndos || 0;
    const avgWPM = currentSession.overallAverageWPM;
    const hasCorrections = backspaces > 0 || deletes > 0 || undos > 0;
    const canCompareSpeed = avgWPM > 10; 
    const speedFactorNormalSlow = 1.2; 
    const speedFactorFast = 1.3;       // above 1.3x average WPM
    const speedFactorVeryFastAnomaly = 1.7; // above 1.7x average WPM
    const isLikelyPasted = pasteInfluence > 0 && (pasteInfluence >= (fullSentenceText.length * 0.5) || (typedWords < 5 && pasteInfluence > 0));
    if (isLikelyPasted) {
        category = 'highlight-pasted';
        console.log("pasted");
    }
    else if (hasCorrections) {
        if (canCompareSpeed && wpm > avgWPM * speedFactorFast) {
            // Corrections + Fast Speed (Yellow)
            category = 'highlight-corrected-fast';
            console.log("fast speed corrections + yellow color ");

        } else {
            // Corrections + Normal/Slow Speed (Green)
            // This covers WPM <= avgWPM * speedFactorFast (i.e. less than or equal to 1.3x avg)
            category = 'highlight-corrected';
            console.log("slow speed corrections + yellow color ");

        }
    }
    // Rules 4, 5, 6: Sentences WITHOUT Corrections
    else if (!hasCorrections && wpm > 0) { // Only apply if WPM is meaningful
        if (canCompareSpeed && wpm >= avgWPM * speedFactorVeryFastAnomaly && currentSession.sentenceCountForAvg >= 3) {
            // Very Fast Anomaly (Red Text/Light Red BG)
            category = 'highlight-anomaly-speed';
            console.log("very fast speed corrections + red color ");

        } else if (canCompareSpeed && wpm >= avgWPM * speedFactorNormalSlow) { // Changed from 1.3 to 1.2 for this rule
            // No Corrections + Fast-ish Speed (but not anomaly) (Yellow for fast, clean)
            // This covers speed from 1.2x up to (but not including) 1.7x avg WPM
            category = 'highlight-fast-no-mistake';
            console.log(" no correction + fast speed  yellow ");

        } else if (wpm < avgWPM * speedFactorNormalSlow || !canCompareSpeed) { // Added !canCompareSpeed for early sentences
            // No Corrections + Normal/Slow Speed (Yellow for normal, clean)
            // This covers speed below 1.2x avg WPM OR if avgWPM is not yet reliable
            category = 'highlight-no-mistake';
            console.log("no corections + slow speed yellow");
        }
        // else it remains 'highlight-typed' if none of these specific conditions are met
    }
    // Rule 7: Default 'highlight-typed' if none of the above (e.g., wpm is 0, no paste, no corrections and not caught by above)

    // Debugging log to see how categories are assigned
    // console.log(`SENTENCE: "${fullSentenceText.substring(0,20)}..." | WPM: ${wpm}, AvgWPM: ${avgWPM.toFixed(1)}, Corrects: ${hasCorrections}, PasteInf: ${pasteInfluence} | CATEGORY: ${category}`);

    currentSession.sentenceStats.push({
        text: fullSentenceText,
        wpm: wpm,
        cpm: cpm,
        typedDurationMs: durationMs,
        typedChars: currentSession.currentSentenceTypedChars,
        typedWords: typedWords,
        startTime: currentSession.currentSentenceStartTime,
        endTime: endTime,
        backspaces: backspaces,
        deletes: deletes,
        undos: undos,
        pasteInfluence: pasteInfluence,
        category: category
    });


    // if (pasteInfluence > 0 && typedWords < 5) {
    //     category = 'highlight-pasted'; // Red for pasted
    // }
    // // Priority 2: Corrections (Backspace, Delete, or Undo within the sentence)
    // else if (backspaces > 0 || deletes > 0 || undos > 0) {
    //     category = 'highlight-corrected'; // Green for corrections
    // }
    // // Priority 3: WPM-based categories (only if not pasted and no corrections)
    // else if (wpm > 0) {
    //     if (currentSession.sentenceCountForAvg >= 3 && avgWPM > 10 && wpm > avgWPM * 1.7) {
    //         category = 'highlight-anomaly-speed'; // Red for speed anomaly
    //     } else if (avgWPM > 10 && wpm > avgWPM * 1.3) { // No corrections, hence no (backspaces === 0 && deletes === 0) check needed here
    //         category = 'highlight-fast-no-mistake'; // Yellow
    //     } else if (currentSession.overallAverageWPM > 10 && wpm < currentSession.overallAverageWPM * 0.6) {
    //         category = 'highlight-slow'; // Green for slow (thinking) - uses same green bg
    //     } else { // Normal typing, no mistakes, not exceptionally fast or slow
    //         category = 'highlight-no-mistake'; // Yellow (normal, clean typing)
    //     }
    // }


    // currentSession.sentenceStats.push({
    //     text: fullSentenceText,
    //     wpm: wpm,
    //     cpm: cpm,
    //     typedDurationMs: durationMs,
    //     typedChars: currentSession.currentSentenceTypedChars, // This is chars typed *for this sentence*
    //     typedWords: typedWords,
    //     startTime: currentSession.currentSentenceStartTime,
    //     endTime: endTime,
    //     backspaces: backspaces, 
        
    //     undos: undos, // Optionally store undos per sentence if needed for stats
    //     deletes: deletes,     // from currentSentenceDeletes
    //     pasteInfluence: pasteInfluence,
    //     category: category
    // });

    if (wpm > 0) { // Only update average WPM if the current sentence WPM is positive
        updateOverallAverageWPM(wpm);
    }


    // Reset for next sentence
    currentSession.currentSentenceBuffer = "";
    currentSession.currentSentenceTypedChars = 0;
    currentSession.currentSentenceStartTime = null;
    currentSession.currentSentenceBackspaces = 0;
    currentSession.currentSentenceDeletes = 0;
    currentSession.currentSentenceUndos = 0; // <<< RESET THIS

}


function analyzeAndSegmentText(fullText, lastAction) {
    currentSession.contentSegments = []; // Reset/initialize contentSegments
    if (!fullText) return;

    // DECLARE THE events ARRAY HERE:
    const events = []; // <--- FIX: Declare the events array

    (currentSession.pastedSegmentsDetails || []).forEach(paste => {
        events.push({
            type: 'paste',
            text: paste.text,
            timestamp: paste.timestamp,
            charCount: paste.charCount,
            wordCount: paste.wordCount
        });
    });


    console.log('events :>> ', events);
    
    // Populate events from sentenceStats
    (currentSession.sentenceStats || []).forEach(sentence => {
        events.push({
            type: 'typed_sentence',
            text: sentence.text,
            category: sentence.category,
            wpm: sentence.wpm,
            backspaces: sentence.backspaces,
            deletes: sentence.deletes,
            startTime: sentence.startTime, // Primary sorting key
            endTime: sentence.endTime,
            pasteInfluence: sentence.pasteInfluence
        });
    });

    events.sort((a, b) => (a.startTime || a.timestamp) - (b.startTime || b.timestamp));

    let processedTextLength = 0; // Tracks how much of fullText has been accounted for
 
    let lastSegmentTextEnd = 0; // Keep track of where the previous segment ended in fullText

    events.forEach(event => {
        let startIndexInFullText = -1;
        let eventTextLength = 0;


        events.forEach((event, index) => {
            console.log(`analyzeAndSegmentText: Processing event ${index + 1}/${events.length}`, event);
            // ... (rest of the loop logic) ...
            if (event.type === 'paste') {
                console.log(">>> Pushing PASTE segment:", event.text.substring(0,10), "Category:", 'highlight-pasted');
            } else if (event.type === 'typed_sentence') {
                console.log(">>> Pushing TYPED_SENTENCE segment:", event.text.substring(0,10), "Category:", event.category);
            }
        });


        if (event.text) {
            // Try to find event.text starting from where the last segment ended
            // This is still naive for complex edits but better than from processedTextLength alone.
            startIndexInFullText = fullText.indexOf(event.text, lastSegmentTextEnd);
            eventTextLength = event.text.length;
        }


        if (startIndexInFullText === -1) {
            // Fallback: try searching from the beginning of where we *think* unassigned text might be
            startIndexInFullText = fullText.indexOf(event.text, processedTextLength);
            if (startIndexInFullText === -1) {
                // console.warn(`SEGMENTER: Could not place event. Type: ${event.type}, Text: '${event.text ? event.text.substring(0, 20) + "..." : "N/A"}'`);
                return; // Skip this event if unplaceable
            }
        }


        // Add any preceding text as a generic 'typed' (or unclassified) segment
        if (startIndexInFullText > lastSegmentTextEnd) {
            const precedingText = fullText.substring(lastSegmentTextEnd, startIndexInFullText);
            if (precedingText.trim().length > 0) {
                currentSession.contentSegments.push({
                    text: precedingText,
                    category: 'highlight-typed', // Default for untracked typing
                    details: 'Unclassified typed segment (interstitial)'
                });
            }
        }

        if (event.type === 'paste') {
            currentSession.contentSegments.push({
                text: event.text,
                category: 'highlight-pasted',
                details: `Pasted: ${event.charCount} chars, ${event.wordCount} words`
            });
        } else if (event.type === 'typed_sentence') {
            currentSession.contentSegments.push({
                text: event.text,
                category: event.category || 'highlight-typed',
                details: `WPM: ${event.wpm}, BS: ${event.backspaces}, DEL: ${event.deletes}, PI: ${event.pasteInfluence}`
            });
        }
        lastSegmentTextEnd = startIndexInFullText + eventTextLength;
        processedTextLength = lastSegmentTextEnd; // Update general processed length as well

    });


    if (lastSegmentTextEnd < fullText.length) {
        const trailingText = fullText.substring(lastSegmentTextEnd);
        if (trailingText.trim().length > 0) {
            currentSession.contentSegments.push({
                text: trailingText,
                category: 'highlight-typed',
                details: 'Trailing typed segment'
            });
        }
    }


    // Add any remaining text at the end of fullText
    if (processedTextLength < fullText.length) {
        const trailingText = fullText.substring(processedTextLength);
        if (trailingText.trim().length > 0) {
            currentSession.contentSegments.push({
                text: trailingText,
                category: 'highlight-typed', // Or based on current typing buffer if any
                details: 'Trailing typed segment'
            });
        }
    }
    
    // Fallback: If, after all processing, no segments were created but there's text
    // (e.gv., all typed, no sentences completed, no pastes, or all events unmatchable)
    if (currentSession.contentSegments.length === 0 && fullText.trim().length > 0) {
        currentSession.contentSegments.push({
            text: fullText,
            category: 'highlight-typed',
            details: 'Initial or unsegmented typing'
        });
    }

    // The old logic for lastAction and refining typed segments is now largely handled
    // by the event-based segmentation using sentence.category.
    // The `currentSession.contentSegments.forEach(segment => { ... });` block
    // for re-categorizing 'typed' segments can probably be removed or significantly simplified
    // if the sentence-level categorization is robust enough.
    // For now, let's remove it to avoid conflicting logic.
}

function calculateOverallAverageWPM() {
    if (!currentSession || currentSession.sentenceStats.length === 0) return 0;
    let totalWords = 0;
    let totalDurationSec = 0;
    currentSession.sentenceStats.forEach(s => {
        totalWords += s.typedWords;
        totalDurationSec += (s.typedDurationMs / 1000);
    });
    return totalWords > 0 && totalDurationSec > 0 ? Math.round((totalWords / totalDurationSec) * 60) : 0;
}


self.onmessage = function(e) {
    const { type, data } = e.data;
    console.log("worker");
    lastActivityTimestamp = Date.now();

    if (!currentSession && type !== 'LOAD_SESSIONS') {
        currentSession = initializeSession();
        checkIdle();
    } else if (currentSession && currentSession.isIdle && type !== 'LOAD_SESSIONS') {
        currentSession.isIdle = false;
        currentSession.lastActiveStartTimestamp = Date.now();
    }



    let lastActionForSegmentation = null;

    switch (type) {
        case 'UNDO_ACTION': {
            updateActiveTime();
            if (!currentSession) break; // Should not happen if UI is active
            currentSession.undoCount = (currentSession.undoCount || 0) + 1;
            currentSession.currentFullText = data.textAfterUndo; // Sync text state
        
            currentSession.typingEvents.push({ type: 'control_action', action: 'undo', timestamp: data.timestamp, durationMs: 0 }); // Add to rhythm
            currentSession.lastCharTimestamp = data.timestamp;
        
            lastActionForSegmentation = { type: 'undo', data: { textReduced: data.textBeforeUndo.length > data.textAfterUndo.length } };
            console.log("WORKER: Undo processed. Count:", currentSession.undoCount);
            
            // An 'input' event will follow, triggering TEXT_INPUT.
            // That TEXT_INPUT needs to be aware this was an undo.
            // Set a flag to be checked in TEXT_INPUT:
            currentSession.lastActionWasUndo = true;
            break;
        }
        
        case 'UNDO_DETECTED': {
            const { textBeforeUndo, textAfterUndo } = data;
            console.log("WORKER: UNDO_DETECTED. Before:", textBeforeUndo.length, "After:", textAfterUndo.length);
            currentSession.currentFullText = textAfterUndo; // Sync full text
            // Now, the hard part: trying to adjust counts.
            // This requires a diff between textBeforeUndo and textAfterUndo
            // and knowledge of how `contentSegments` were originally formed.
            // For now, we can log it as an "undo event" but not perfectly adjust stats.
            currentSession.typingEvents.push({ type: 'undo', timestamp: data.timestamp, UndoneLength: textBeforeUndo.length - textAfterUndo.length });
            lastActionForSegmentation = { type: 'undo', data };
            // The subsequent 'input' event will still fire, sending a TEXT_INPUT.
            // The TEXT_INPUT handler needs to be aware if an UNDO_DETECTED just happened.
            // Maybe set a flag: currentSession.undoJustOccurred = true;
            break;
        }
        
        case 'TEXT_INPUT': {
            updateActiveTime();
            const newText = data.text;
            const oldFullText = currentSession.currentFullText || "";
            // let changeInText = newText.substring(oldFullText.length); // What was added
            let lengthDifference = newText.length - oldFullText.length;

            let typedCharCountThisEvent = 0;
            if (currentSession.lastActionWasUndo) {
                console.log("WORKER: TEXT_INPUT is related to a previous UNDO. Length diff:", lengthDifference);
                if (lengthDifference < 0) { // Text was removed due to undo, considered a "correction" for the sentence
                    currentSession.currentSentenceUndos = (currentSession.currentSentenceUndos || 0) + 1;
                    console.log("WORKER: UNDO resulted in text reduction. currentSentenceUndos:", currentSession.currentSentenceUndos);
                }
                lastActionForSegmentation = { type: 'undo_text_update', data: { textReduced: lengthDifference < 0 } };
                currentSession.lastActionWasUndo = false; // Reset flag: this TEXT_INPUT handled the undo's text change
            }
            // DEBUG
            // console.log("WORKER: TEXT_INPUT received. New text length:", newText.length, "Old text length:", oldFullText.length);
            // console.log("WORKER: pastedTextJustProcessed:", currentSession.pastedTextJustProcessed);

            else if (currentSession.pastedTextJustProcessed && lengthDifference > 0) {
                const pastedText = currentSession.pastedTextJustProcessed;
                if (lengthDifference === pastedText.length && newText.endsWith(pastedText)) {
                    lastActionForSegmentation = { type: 'paste', data: { text: pastedText, charCount: pastedText.length, wordCount: countWords(pastedText) } };
                } else {
                    typedCharCountThisEvent = Math.max(0, lengthDifference - pastedText.length);
                    if (typedCharCountThisEvent > 0) {
                        lastActionForSegmentation = { type: 'type_after_paste', data: { text: newText.slice(-typedCharCountThisEvent) } };
                    } else {
                         lastActionForSegmentation = { type: 'paste_modified', data: { text: pastedText } };
                    }
                }
                currentSession.pastedTextJustProcessed = null; // Consume the flag
          
            } else if (lengthDifference > 0) {
                // Standard typing (no recent paste flagged)
                typedCharCountThisEvent = lengthDifference;
                const changeInText = newText.substring(oldFullText.length); // Calculate changeInText here
                lastActionForSegmentation = { type: 'type', data: { text: changeInText } };
        
            } else if (lengthDifference < 0) {
                // Deletion, handled by CORRECTION_KEY, but update full text
                // console.log("WORKER: TEXT_INPUT detected deletion (lengthDifference < 0).");
                lastActionForSegmentation = { type: 'deletion_via_input', data: { oldLength: oldFullText.length, newLength: newText.length } };
       
       
            }


            if (typedCharCountThisEvent > 0) {
                currentSession.typedChars += typedCharCountThisEvent;
                // currentSession.currentSentenceTypedChars += typedCharCountThisEvent;
                currentSession.currentSentenceBuffer += newText.slice(oldFullText.length, oldFullText.length + typedCharCountThisEvent); // Append only newly typed
                const nowForEvents = Date.now();
                const newlyTypedChars = newText.slice(oldFullText.length, oldFullText.length + typedCharCountThisEvent);
                currentSession.currentSentenceBuffer += newlyTypedChars;

            
                if (!currentSession.currentSentenceStartTime) {
                    currentSession.currentSentenceStartTime = Date.now() - (typedCharCountThisEvent * 50); // Approximate
                }

                // Granular event tracking for sine graph (if enabled)
                if (currentSession.lastCharTimestamp && (nowForEvents - currentSession.lastCharTimestamp > 250)) {
                    const pauseEvent = { type: 'pause', timestamp: currentSession.lastCharTimestamp, durationMs: nowForEvents - currentSession.lastCharTimestamp };
                    currentSession.typingEvents.push(pauseEvent);
                    // console.log("WORKER: Pushed Pause Event:", pauseEvent);
                }
                
                const charsJustTyped = newText.slice(oldFullText.length, oldFullText.length + typedCharCountThisEvent);
                for (let i = 0; i < newlyTypedChars.length; i++) {
                    const charEvent = { type: 'char', char: newlyTypedChars[i], timestamp: nowForEvents - ((newlyTypedChars.length - 1 - i) * 15), durationMs: 30 };
                    currentSession.typingEvents.push(charEvent);
                }
            
                currentSession.lastCharTimestamp = nowForEvents;
           
            }


            currentSession.currentFullText = newText; // Always update to the latest full text

            const sentenceEndings = /[.!?]\s*$/;
            if (sentenceEndings.test(currentSession.currentSentenceBuffer)) {
                processSentenceCompletion(currentSession.currentSentenceBuffer.trim());
            }


            break;
        }

        

        case 'PASTE_INPUT': {
            updateActiveTime();
            const pastedText = data.text;
            const charCount = pastedText.length;
            const wordCount = countWords(pastedText);

            // console.log("WORKER: PASTE_INPUT received. Text:", pastedText, "Char count:", charCount);

            currentSession.pastedChars += charCount; // Increment here
            currentSession.pastedSegmentsDetails.push({
                timestamp: Date.now(),
                text: pastedText,
                charCount: charCount,
                wordCount: wordCount
            });
            
            // Set the flag for the next TEXT_INPUT
            currentSession.pastedTextJustProcessed = pastedText;
            currentSession.lastCharTimestamp = Date.now(); // Update last activity to prevent immediate pause detection

            // The actual change to currentFullText and sentence buffer will happen
            // when the 'input' event triggers a 'TEXT_INPUT' message.
            // For segmentation, we note that a paste happened. analyzeAndSegmentText will use pastedSegmentsDetails.
            lastActionForSegmentation = { type: 'paste', data: { text: pastedText, charCount, wordCount } };
            console.log("object");

            // Send an update immediately to reflect pastedChars count
            postMessage({ type: 'STATUS_UPDATE', session: {...currentSession, averageWPM: calculateOverallAverageWPM() } });
            break;
        }
        case 'CORRECTION_KEY': {
            updateActiveTime();
            if (data.key === 'Backspace') {
                currentSession.backspaceCount++;
                if (currentSession.currentSentenceBuffer.length > 0) currentSession.currentSentenceBackspaces++;
            } else if (data.key === 'Delete') {
                currentSession.deleteCount++;
                 if (currentSession.currentSentenceBuffer.length > 0) currentSession.currentSentenceDeletes++;
            }
            
            // The actual text update (currentFullText) will come via the TEXT_INPUT event
            // that follows a backspace/delete if it changes the textarea content.
            // So, we mainly just count the key presses here.
            // However, to be safe, update currentFullText if provided.
            if(data.currentTextAfterCorrection !== undefined) { // Check for undefined explicitly
                currentSession.currentFullText = data.currentTextAfterCorrection;
            }
            currentSession.lastCharTimestamp = Date.now(); // Update last activity
            lastActionForSegmentation = { type: 'correction', data };
            break;
        }


        case 'FOCUS_CHANGE':
            if (data.focused) {
                if (currentSession && currentSession.isIdle) { // Resuming from idle
                    currentSession.isIdle = false;
                    currentSession.lastActiveStartTimestamp = Date.now();
                } else if (currentSession) { // general focus, ensure active start is set
                     currentSession.lastActiveStartTimestamp = currentSession.lastActiveStartTimestamp || Date.now();
                }
            } else { // Blurred
                if (currentSession && !currentSession.isIdle) {
                    updateActiveTime(); // Log time before blur potentially leads to idle
                    // Don't mark as idle immediately on blur, wait for timeout
                }
                 if (currentSession && currentSession.currentSentenceBuffer.length > 0 && currentSession.currentSentenceStartTime) {
                    processSentenceCompletion(currentSession.currentSentenceBuffer.trim()); // Process sentence on blur
                }
            }
            break;
        case 'FINALIZE_SESSION':
            if (currentSession) {
                updateActiveTime();
                if (currentSession.currentSentenceBuffer.length > 0 && currentSession.currentSentenceStartTime) {
                    processSentenceCompletion(currentSession.currentSentenceBuffer.trim()); // Process any remaining sentence
                }
                currentSession.endTime = Date.now();
             
             
                console.log("object");

                analyzeAndSegmentText(currentSession.currentFullText, null); // Final analysis
                postMessage({ type: 'SESSION_FINALIZED', sessionData: currentSession });
                currentSession = null; // Ready for a new session if page stays open
                if(idleTimer) clearTimeout(idleTimer);
            }
            break;
         case 'REQUEST_SAVE': // Main thread asks worker to provide current data for saving
            if (currentSession) {
                updateActiveTime();
                 // Process any remaining sentence before providing data
                if (currentSession.currentSentenceBuffer.length > 0 && currentSession.currentSentenceStartTime) {
                    processSentenceCompletion(currentSession.currentSentenceBuffer.trim());
                }
             
                console.log("object");
                analyzeAndSegmentText(currentSession.currentFullText, lastActionForSegmentation);
                postMessage({ type: 'SAVE_DATA_TO_LS', sessionData: { ...currentSession, averageWPM: calculateOverallAverageWPM() } });
            }
            break;
    }
    if (currentSession && type !== 'FINALIZE_SESSION' && type !== 'FOCUS_CHANGE') {
        // The lastActionForSegmentation passed here is what just happened.
        // analyzeAndSegmentText should use currentSession.pastedSegmentsDetails and currentSession.sentenceStats
        // to build its segments, rather than relying too much on this single 'lastAction'.
       
        console.log("object");
        analyzeAndSegmentText(currentSession.currentFullText, lastActionForSegmentation);
        postMessage({ type: 'STATUS_UPDATE', session: {...currentSession, averageWPM: calculateOverallAverageWPM() } });
    }

};  