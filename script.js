const body = document.body;
const door = document.getElementById('door');
const closeBtn = document.getElementById('close-btn');
const photoUpload = document.getElementById('photo-upload');
const rightPageContent = document.getElementById('right-page-content');
const leftPageContent = document.getElementById('left-page-content');
const btnPrev = document.getElementById('prev-page');
const btnNext = document.getElementById('next-page');
const pageIndicator = document.getElementById('page-indicator');
const saveStatus = document.getElementById('save-status');
const book = document.getElementById('book');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings');
const saveSettingsBtn = document.getElementById('save-settings');

// Settings Elements
const bgUpload = document.getElementById('bg-upload');
const resetBgBtn = document.getElementById('reset-bg');
const coverUpload = document.getElementById('cover-upload');
const resetCoverBtn = document.getElementById('reset-cover');
const fontSelect = document.getElementById('font-select');
const fontSizeInput = document.getElementById('font-size');
const fontSizeVal = document.getElementById('font-size-val');
const textColorInput = document.getElementById('text-color');
const highlightColorInput = document.getElementById('highlight-color');
const highlightBtn = document.getElementById('highlight-btn');

let highestZ = 1000;
let isPaging = false;

// Default Settings
const defaultSettings = {
    bgImage: "url('images/hexa_bg.png')",
    coverImage: "url('images/hexa_cover.png')",
    fontFamily: "'Want Woo', 'Caveat', cursive",
    fontSize: "32",
    textColor: "#ffffff",
    highlightColor: "rgba(255, 255, 255, 0.3)"
};

let userSettings = { ...defaultSettings };

let autoSaveTimeout = null;
const AUTO_SAVE_INACTIVITY_DELAY = 3000; // 3 seconds of inactivity
const AUTO_SAVE_PERIODIC_DELAY = 300000; // 5 minutes

// Pagination State
let pages = [
    { text: '', images: [] }, // Page 1
    { text: '', images: [] }  // Page 2
];
let currentLeftPageIndex = 0;
let lastSelectionRange = null;

document.addEventListener('selectionchange', () => {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        let parent = range.commonAncestorContainer;
        if (parent.nodeType !== 1) parent = parent.parentNode;
        if (parent && parent.closest && parent.closest('.writing-area')) {
            lastSelectionRange = range.cloneRange();
        }
    }
});

// --- IndexedDB Storage ---
const DB_NAME = 'DiaryDB';
const DB_VERSION = 1;
const STORE_NAME = 'pages';

function openDB() {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            reject("IndexedDB not supported");
            return;
        }
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function saveDiary() {
    saveCurrentView();
    if (saveStatus) {
        saveStatus.innerText = 'Saving...';
        saveStatus.className = 'save-status saving';
    }
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        await store.put(pages, 'diary_data');
        
        localStorage.setItem('aesthetic_diary_settings', JSON.stringify(userSettings));
        
        if (saveStatus) {
            saveStatus.innerText = 'Saved';
            saveStatus.className = 'save-status saved';
            setTimeout(() => {
                if (saveStatus.innerText === 'Saved') {
                    saveStatus.innerText = '';
                    saveStatus.className = 'save-status';
                }
            }, 2000);
        }
    } catch(e) {
        console.error("Could not save diary to IndexedDB", e);
        if (saveStatus) {
            saveStatus.innerText = 'Error';
            saveStatus.className = 'save-status';
        }
    }
}

function triggerAutoSave() {
    if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(() => {
        saveDiary();
    }, AUTO_SAVE_INACTIVITY_DELAY);
}

// Periodic auto-save every 5 minutes if the book is open
setInterval(() => {
    if (body.classList.contains('is-open')) {
        saveDiary();
    }
}, AUTO_SAVE_PERIODIC_DELAY);

async function loadDiary() {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const saved = await new Promise((resolve) => {
            const req = store.get('diary_data');
            req.onsuccess = () => resolve(req.result);
        });

        if (saved) {
            pages = saved;
        } else {
            // Fallback to localStorage for legacy data
            const legacySaved = localStorage.getItem('aesthetic_diary_data');
            if (legacySaved) {
                pages = JSON.parse(legacySaved);
            }
        }
        
        const savedSettings = localStorage.getItem('aesthetic_diary_settings');
        if (savedSettings) {
            userSettings = { ...defaultSettings, ...JSON.parse(savedSettings) };
        }
        applySettingsToDOM();
    } catch(e) {
        console.error("Could not load diary from IndexedDB", e);
    }
}

// Open the book
door.addEventListener('click', () => {
    if (!body.classList.contains('is-open')) {
        body.classList.add('is-open');
        // Load diary data after the opening animation starts
        loadDiary().then(() => {
            renderPages();
            resizeBook();
        });
    }
});

// Close the book
closeBtn.addEventListener('click', () => {
    saveDiary();
    body.classList.remove('is-open');
    resizeBook();
});

// Open Settings
settingsBtn.addEventListener('click', () => {
    populateSettingsModal();
    settingsModal.classList.remove('hidden');
});

const mainControls = document.getElementById('main-controls');
const toggleUIBtn = document.getElementById('toggle-ui');

// Toggle UI Visibility
toggleUIBtn.addEventListener('click', () => {
    mainControls.classList.toggle('collapsed');
    const icon = toggleUIBtn.querySelector('.toggle-icon');
    if (mainControls.classList.contains('collapsed')) {
        icon.style.transform = 'rotate(180deg)';
    } else {
        icon.style.transform = 'rotate(0deg)';
    }
});

// Auto-collapse on mobile when writing
document.addEventListener('focusin', (e) => {
    if (window.innerWidth <= 768 && e.target.classList.contains('writing-area')) {
        mainControls.classList.add('collapsed');
        const icon = toggleUIBtn.querySelector('.toggle-icon');
        if (icon) icon.style.transform = 'rotate(180deg)';
    }
});

// Close Settings
closeSettingsBtn.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
});

// Populate Settings UI
function populateSettingsModal() {
    fontSelect.value = userSettings.fontFamily;
    fontSizeInput.value = userSettings.fontSize;
    fontSizeVal.innerText = `${userSettings.fontSize}px`;
    textColorInput.value = userSettings.textColor;
    
    // Highlight color needs hex conversion if it's rgba, but let's assume valid formats
    // HTML5 color picker only accepts hex: #RRGGBB
    let hc = userSettings.highlightColor;
    if(hc.startsWith('rgba')) {
        highlightColorInput.value = '#ffffff'; // Fallback for UI visualization
    } else {
        highlightColorInput.value = hc;
    }
}

// Update font size display on change
fontSizeInput.addEventListener('input', (e) => {
    fontSizeVal.innerText = `${e.target.value}px`;
});

// Apply Settings function
function applySettingsToDOM() {
    document.body.style.backgroundImage = userSettings.bgImage;
    const frontCover = document.querySelector('.cover.front');
    if (frontCover) {
        frontCover.style.backgroundImage = userSettings.coverImage;
    }
    document.documentElement.style.setProperty('--highlight-color', userSettings.highlightColor);
}

// Save Settings
saveSettingsBtn.addEventListener('click', () => {
    userSettings.fontFamily = fontSelect.value;
    userSettings.fontSize = fontSizeInput.value;
    userSettings.textColor = textColorInput.value;
    userSettings.highlightColor = highlightColorInput.value;
    
    localStorage.setItem('aesthetic_diary_settings', JSON.stringify(userSettings));
    applySettingsToDOM();
    applyInlineFontStyles();
    settingsModal.classList.add('hidden');
});

function applyInlineFontStyles() {
    if (!lastSelectionRange || !lastSelectionRange.commonAncestorContainer.isConnected) return;
    
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(lastSelectionRange);

    const span = document.createElement('span');
    span.style.fontFamily = userSettings.fontFamily;
    span.style.fontSize = `${userSettings.fontSize}px`;
    span.style.color = userSettings.textColor;

    if (!lastSelectionRange.collapsed) {
        try {
            lastSelectionRange.surroundContents(span);
        } catch(e) {
            const text = lastSelectionRange.extractContents();
            span.appendChild(text);
            lastSelectionRange.insertNode(span);
        }
    } else {
        span.innerHTML = '&#8203;'; // Zero-width space
        lastSelectionRange.insertNode(span);
        
        if (span.firstChild) {
            lastSelectionRange.setStart(span.firstChild, 1);
            lastSelectionRange.collapse(true);
        } else {
            lastSelectionRange.setStart(span, 0);
            lastSelectionRange.collapse(true);
        }
    }
    
    selection.removeAllRanges();
    selection.addRange(lastSelectionRange);
    
    saveCurrentView();
    saveDiary();
}

// Background Upload handler
bgUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            userSettings.bgImage = `url('${e.target.result}')`;
        };
        reader.readAsDataURL(file);
    }
});

resetBgBtn.addEventListener('click', () => {
    userSettings.bgImage = defaultSettings.bgImage;
});

// Cover Upload handler
coverUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            userSettings.coverImage = `url('${e.target.result}')`;
        };
        reader.readAsDataURL(file);
    }
});

resetCoverBtn.addEventListener('click', () => {
    userSettings.coverImage = defaultSettings.coverImage;
});

function getNewPage() {
    return { text: '', images: [] };
}

function saveCurrentView() {
    if (!body.classList.contains('is-open')) return;
    const leftTextarea = leftPageContent.querySelector('.writing-area');
    if (leftTextarea && currentLeftPageIndex < pages.length) {
        pages[currentLeftPageIndex].text = leftTextarea.innerHTML;
    }
    const rightTextarea = rightPageContent.querySelector('.writing-area');
    if (rightTextarea && currentLeftPageIndex + 1 < pages.length) {
        pages[currentLeftPageIndex + 1].text = rightTextarea.innerHTML;
    }
}

function renderPages() {
    while (pages.length <= currentLeftPageIndex + 1) pages.push(getNewPage());
    renderSinglePage(leftPageContent, currentLeftPageIndex, "Continue writing...");
    renderSinglePage(rightPageContent, currentLeftPageIndex + 1, currentLeftPageIndex === 0 ? "Dear Diary..." : "Continue writing...");
    pageIndicator.innerText = `Page ${currentLeftPageIndex + 1}-${currentLeftPageIndex + 2}`;
    btnPrev.disabled = currentLeftPageIndex === 0;
}

function renderSinglePage(container, pageIndex, placeholder) {
    container.innerHTML = '';
    const pageData = pages[pageIndex];
    const textarea = document.createElement('div');
    textarea.className = 'writing-area';
    textarea.contentEditable = 'true';
    textarea.spellcheck = false;
    textarea.setAttribute('data-placeholder', placeholder);
    textarea.innerHTML = pageData.text;
    
    textarea.addEventListener('input', (e) => {
        pages[pageIndex].text = textarea.innerHTML;
        checkPageOverflow(textarea, pageIndex, e);
        triggerAutoSave();
    });

    textarea.addEventListener('keydown', (e) => {
        if (isPaging) e.preventDefault();
    });

    // Re-attach drag events to photos
    textarea.querySelectorAll('.inline-photo').forEach(photo => {
        photo.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/html', photo.outerHTML);
            e.dataTransfer.effectAllowed = 'move';
            setTimeout(() => {
                photo.classList.add('is-dragging');
            }, 0);
        });

        photo.addEventListener('dragend', (e) => {
            photo.classList.remove('is-dragging');
            document.querySelectorAll('.is-dragging').forEach(el => el.classList.remove('is-dragging'));
            saveCurrentView();
            triggerAutoSave();
        });
    });
    
    container.appendChild(textarea);
    
}

document.addEventListener('click', (e) => {
    // Permanent Highlights
    if (e.target.classList.contains('permanent-highlight')) {
        const text = document.createTextNode(e.target.textContent);
        e.target.parentNode.replaceChild(text, e.target);
        saveCurrentView();
        triggerAutoSave();
    }
    
    // Delete Photo
    if (e.target.classList.contains('delete-photo-btn')) {
        const photoEl = e.target.closest('.inline-photo');
        if (photoEl) {
            photoEl.remove();
            saveCurrentView();
            triggerAutoSave();
        }
    }
    
    // Toggle float
    if (e.target.classList.contains('toggle-float-btn')) {
        const photoEl = e.target.closest('.inline-photo');
        if (photoEl) {
            photoEl.classList.toggle('float-right');
            saveCurrentView();
            triggerAutoSave();
        }
    }
});

// Highlight logic
highlightBtn.addEventListener('click', () => {
    if (!body.classList.contains('is-open')) return;
    
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    
    if (selection.toString().trim() === "") return;

    const range = selection.getRangeAt(0);
    // Ensure we are inside a writing area
    let parent = range.commonAncestorContainer;
    if (parent.nodeType !== 1) parent = parent.parentNode;
    if (!parent.closest('.writing-area')) return;

    const span = document.createElement('span');
    span.className = 'permanent-highlight';
    span.textContent = selection.toString();
    
    range.deleteContents();
    range.insertNode(span);
    
    // Remove selection 
    selection.removeAllRanges();
    
    saveCurrentView();
    saveDiary();
});

// Flipper Logic
function turnPage(direction) {
    if (isPaging) return;
    if (direction === -1 && currentLeftPageIndex === 0) return;
    isPaging = true;
    saveDiary();
    
    const flipper = document.createElement('div');
    flipper.className = 'flipper-layer';
    const front = document.createElement('div');
    front.className = 'page front right-page ruled-paper';
    const back = document.createElement('div');
    back.className = 'page back left-page ruled-paper';
    
    let targetLeftIndex = currentLeftPageIndex + (direction * 2);
    while (pages.length <= targetLeftIndex + 1) pages.push(getNewPage());

    const oldRightClone = rightPageContent.cloneNode(true);
    const oldLeftClone = leftPageContent.cloneNode(true);
    [oldRightClone, oldLeftClone].forEach(c => {
        const t = c.querySelector('.writing-area');
        if(t) t.contentEditable = 'false';
    });

    if (direction === 1) {
        flipper.style.transform = 'rotateY(0deg)';
        front.appendChild(oldRightClone);
        let newLeftContainer = document.createElement('div');
        newLeftContainer.className = 'page-content';
        renderSinglePage(newLeftContainer, targetLeftIndex, "...");
        newLeftContainer.querySelector('.writing-area').contentEditable = 'false';
        back.appendChild(newLeftContainer);
        flipper.appendChild(front);
        flipper.appendChild(back);
        book.appendChild(flipper);
        
        currentLeftPageIndex = targetLeftIndex;
        renderSinglePage(rightPageContent, currentLeftPageIndex + 1, "...");
        
        requestAnimationFrame(() => {
            requestAnimationFrame(() => { flipper.style.transform = 'rotateY(-180deg)'; });
        });
        setTimeout(() => {
            renderPages();
            flipper.remove();
            isPaging = false;
        }, 800);
    } else {
        flipper.style.transform = 'rotateY(-180deg)';
        let newRightContainer = document.createElement('div');
        newRightContainer.className = 'page-content';
        renderSinglePage(newRightContainer, targetLeftIndex + 1, "...");
        newRightContainer.querySelector('.writing-area').contentEditable = 'false';
        front.appendChild(newRightContainer);
        back.appendChild(oldLeftClone);
        flipper.appendChild(front);
        flipper.appendChild(back);
        book.appendChild(flipper);
        
        currentLeftPageIndex = targetLeftIndex;
        renderSinglePage(leftPageContent, currentLeftPageIndex, "...");
        requestAnimationFrame(() => {
            requestAnimationFrame(() => { flipper.style.transform = 'rotateY(0deg)'; });
        });
        setTimeout(() => {
            renderPages();
            flipper.remove();
            isPaging = false;
        }, 800);
    }
}

btnPrev.addEventListener('click', () => turnPage(-1));
btnNext.addEventListener('click', () => turnPage(1));

function insertInlinePhoto(src) {
    const selection = window.getSelection();
    let range;
    let targetArea;
    
    if (lastSelectionRange && lastSelectionRange.commonAncestorContainer.isConnected) {
        range = lastSelectionRange.cloneRange();
        let parent = range.commonAncestorContainer;
        if (parent.nodeType !== 1) parent = parent.parentNode;
        targetArea = parent ? parent.closest('.writing-area') : null;
    } 
    
    if (!targetArea && selection.rangeCount > 0) {
        let tempRange = selection.getRangeAt(0);
        if (tempRange.commonAncestorContainer.isConnected) {
            let parent = tempRange.commonAncestorContainer;
            if (parent.nodeType !== 1) parent = parent.parentNode;
            let closestArea = parent ? parent.closest('.writing-area') : null;
            if (closestArea) {
                range = tempRange;
                targetArea = closestArea;
            }
        }
    }
    
    // Fallback if no valid text area found
    if (!targetArea) {
        // Find best target area
        const leftArea = leftPageContent.querySelector('.writing-area');
        const rightArea = rightPageContent.querySelector('.writing-area');
        
        if (leftArea && rightArea) {
            targetArea = (leftArea.innerText.length < rightArea.innerText.length) ? leftArea : rightArea;
        } else {
            targetArea = rightArea || leftArea;
        }
        
        if(!targetArea) return;
        
        range = document.createRange();
        range.selectNodeContents(targetArea);
        range.collapse(false); // End of area
    }

    const container = document.createElement('div');
    container.className = 'inline-photo';
    container.contentEditable = 'false'; // IMPORTANT: prevents text editing inside the photo wrapper
    container.draggable = true;
    const rotContainer = Math.random();
    const rotTape = Math.random();
    container.style.setProperty('--random-rotation', rotContainer);
    
    const tape = document.createElement('div');
    tape.className = 'cello-tape';
    tape.style.setProperty('--random-rotation', rotTape);
    
    const img = document.createElement('img');
    img.src = src;
    img.className = 'photo-img';
    
    // Add delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-photo-btn';
    deleteBtn.innerHTML = '&times;';
    deleteBtn.title = 'Delete Photo';
    
    // Add flip alignment button
    const flipBtn = document.createElement('button');
    flipBtn.className = 'toggle-float-btn';
    flipBtn.innerHTML = '&#8646;';
    flipBtn.title = 'Switch alignment';

    container.appendChild(flipBtn);
    container.appendChild(deleteBtn);
    container.appendChild(tape);
    container.appendChild(img);
    
    // Drag data setup
    container.addEventListener('dragstart', (e) => {
        // Just required for Firefox mostly to allow drag, content tracking is native
        e.dataTransfer.setData('text/html', container.outerHTML);
        e.dataTransfer.effectAllowed = 'move';
        
        // Slight delay so the visual dragging element appears before we hide the original
        setTimeout(() => {
            container.classList.add('is-dragging');
        }, 0);
    });

    container.addEventListener('dragend', (e) => {
        container.classList.remove('is-dragging');
        
        // Clean up any remnants and save
        document.querySelectorAll('.is-dragging').forEach(el => el.classList.remove('is-dragging'));
        saveCurrentView();
        saveDiary();
    });

    try {
        // Insert into text
        range.insertNode(container);
        
        // Add an empty text node after it so user can keep typing
        const space = document.createTextNode(' \u200B'); // Zero-width space helps selection
        container.parentNode.insertBefore(space, container.nextSibling);
        
        // Collapse range to end
        range.setStartAfter(space);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        
        lastSelectionRange = range.cloneRange();
    } catch (e) {
        console.error("Error inserting photo at range, appending to targetArea instead", e);
        targetArea.appendChild(container);
        const space = document.createTextNode(' \u200B');
        targetArea.appendChild(space);
        
        range = document.createRange();
        range.selectNodeContents(targetArea);
        range.collapse(false);
        lastSelectionRange = range.cloneRange();
    }
    
    const writingArea = container.closest('.writing-area') || targetArea;
    
    saveCurrentView();
    // Use setTimeout so DOM settles before checking overflow
    setTimeout(() => {
        if (writingArea) {
            writingArea.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }, 100);
}

function handleImageFiles(files) {
    for (let file of files) {
        if (!file.type.startsWith('image/')) continue;
        const reader = new FileReader();
        reader.onload = (e) => {
            insertInlinePhoto(e.target.result);
        };
        reader.readAsDataURL(file);
    }
}

photoUpload.addEventListener('change', (e) => {
    if (!body.classList.contains('is-open')) return;
    handleImageFiles(e.target.files);
    e.target.value = '';
});

document.addEventListener('paste', (e) => {
    if (!body.classList.contains('is-open')) return;
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    const files = [];
    for (const item of items) {
        if (item.type.indexOf('image') !== -1) files.push(item.getAsFile());
    }
    
    if (files.length > 0) {
        e.preventDefault(); // Prevent default paste behavior if it's an image
        handleImageFiles(files);
    }
});

function checkPageOverflow(textarea, pageIndex, e) {
    // Basic threshold to avoid jitter
    if (textarea.scrollHeight <= textarea.clientHeight + 5) return;
    
    let nextIndex = pageIndex + 1;
    while (pages.length <= nextIndex) pages.push(getNewPage());
    
    let overflowHTML = "";
    let safety = 1000;
    
    // If there is an image that is huge and causing the immediate overflow, 
    // it needs to be pushed to the next page entirely.
    while (textarea.scrollHeight > textarea.clientHeight + 5 && textarea.childNodes.length > 0 && safety > 0) {
        safety--;
        let last = textarea.lastChild;
        if (!last) break;
        
        if (last.nodeType === Node.TEXT_NODE) {
            let text = last.nodeValue;
            let movedText = "";
            while (textarea.scrollHeight > textarea.clientHeight + 5 && text.length > 0) {
                movedText = text.slice(-1) + movedText;
                text = text.slice(0, -1);
                last.nodeValue = text;
            }
            if (text.length === 0) textarea.removeChild(last);
            overflowHTML = movedText + overflowHTML;
        } else if (last.nodeType === Node.ELEMENT_NODE) {
            // Whole element (like a photo) gets moved to next page
            let tempHtml = last.outerHTML;
            textarea.removeChild(last);
            overflowHTML = tempHtml + overflowHTML;
        }
    }
    
    pages[pageIndex].text = textarea.innerHTML;
    pages[nextIndex].text = overflowHTML + pages[nextIndex].text;
    
    saveDiary();
    
    if (pageIndex === currentLeftPageIndex) {
        renderSinglePage(rightPageContent, nextIndex, "Continue writing...");
        let rightArea = rightPageContent.querySelector('.writing-area');
        if (rightArea) {
            placeCaretAtEnd(rightArea);
        }
    } else if (pageIndex === currentLeftPageIndex + 1 && !isPaging) {
        turnPage(1);
        setTimeout(() => {
            let newLeftArea = leftPageContent.querySelector('.writing-area');
            if (newLeftArea) {
                placeCaretAtEnd(newLeftArea);
            }
        }, 850);
    }
}

function placeCaretAtEnd(el) {
    el.focus();
    if (typeof window.getSelection !== "undefined" && typeof document.createRange !== "undefined") {
        var range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    }
}

let maxKnownHeight = window.innerHeight;

function resizeBook() {
    const bookContainer = document.querySelector('.book-container');
    if (!bookContainer) return;
    
    const screenWidth = window.innerWidth;
    let screenHeight = window.innerHeight;
    
    // Track maximum height to detect mobile keyboard opening
    if (screenHeight > maxKnownHeight) {
        maxKnownHeight = screenHeight;
    }
    
    const isMobile = screenWidth <= 768;
    
    // If height drops significantly on mobile, assume keyboard is open
    // and use max height to prevent the book from shrinking drastically
    if (isMobile && screenHeight < maxKnownHeight * 0.8) {
        screenHeight = maxKnownHeight;
    }
    
    const targetWidth = document.body.classList.contains('is-open') ? 940 : 500;
    let scale = screenWidth / targetWidth;
    
    const targetHeight = isMobile ? 850 : 750;
    const scaleY = screenHeight / targetHeight;
    
    scale = Math.min(scale, scaleY);
    scale = Math.min(scale, 1.2); // Cap maximum scale
    
    bookContainer.style.transform = `scale(${scale})`;
}

window.addEventListener('resize', resizeBook);
// Initial sizing
resizeBook();
