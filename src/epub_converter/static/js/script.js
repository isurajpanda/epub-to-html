// --- START: Embedded toc_and_topbar.js logic ---
// (The 'export' keyword has been removed to work in a single script tag)
function createTocPanel({ coverUrl, title, author, tocItems = [], onTocClick } = {}) {
    const sideBar = document.createElement('div');
    sideBar.className = 'toc-sidebar';
    const header = document.createElement('div');
    header.className = 'toc-sidebar-header';
    if (coverUrl) {
        const cover = document.createElement('img');
        cover.src = coverUrl; cover.alt = 'Book cover'; header.appendChild(cover);
    }
    const info = document.createElement('div');
    if (title) { const h1 = document.createElement('h1'); h1.textContent = title; info.appendChild(h1); }
    if (author) { const p = document.createElement('p'); p.textContent = author; info.appendChild(p); }
    header.appendChild(info); sideBar.appendChild(header);

    const tocView = document.createElement('div');
    tocView.className = 'toc-view';
    tocView.appendChild(buildTocList(tocItems, onTocClick));
    sideBar.appendChild(tocView);
    return sideBar;
}
function buildTocList(items, onTocClick) {
    const ul = document.createElement('ul');
    for (const item of items) {
        const li = document.createElement('li');
        if (item.href) {
            const a = document.createElement('a');
            a.textContent = item.label; a.href = '#';
            a.onclick = e => { e.preventDefault(); if (onTocClick) onTocClick(item); };
            li.appendChild(a);
        } else {
            const span = document.createElement('span');
            span.textContent = item.label; span.style.color = 'GrayText'; li.appendChild(span);
        }
        if (item.children && item.children.length) {
            li.appendChild(buildTocList(item.children, onTocClick));
        }
        ul.appendChild(li);
    }
    return ul;
}
function createTopBar({ onSidebar, onPrev, onNext, onFontSize, onDownload, onFullscreen, onViewMode } = {}) {
    const bar = document.createElement('div'); bar.className = 'top-toolbar';
    const left = document.createElement('div');
    left.className = 'top-left-controls';
    left.appendChild(makeIconButton('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-list" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5"/></svg>', 'Show sidebar', onSidebar));
    left.appendChild(makeIconButton('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-left-short" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M12 8a.5.5 0 0 1-.5.5H5.707l2.147 2.146a.5.5 0 0 1-.708.708l-3-3a.5.5 0 0 1 0-.708l3-3a.5.5 0 1 1 .708.708L5.707 7.5H11.5a.5.5 0 0 1 .5.5"/></svg>', 'Previous Chapter', onPrev));
    left.appendChild(makeIconButton('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-right-short" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M4 8a.5.5 0 0 1 .5-.5h5.793L8.146 5.354a.5.5 0 1 1 .708-.708l3 3a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708-.708L10.293 8.5H4.5A.5.5 0 0 1 4 8"/></svg>', 'Next Chapter', onNext));
    bar.appendChild(left);
    const right = document.createElement('div');
    right.className = 'top-right-controls';
    right.appendChild(makeIconButton('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" fill="currentColor"><path d="M12.19 8.84a1.45 1.45 0 0 0-1.4-1h-.12a1.46 1.46 0 0 0-1.42 1L1.14 26.56a1.29 1.29 0 0 0-.14.59 1 1 0 0 0 1 1 1.12 1.12 0 0 0 1.08-.77l2.08-4.65h11l2.08 4.59a1.24 1.24 0 0 0 1.12.83 1.08 1.08 0 0 0 1.08-1.08 1.64 1.64 0 0 0-.14-.57ZM6.08 20.71l4.59-10.22 4.6 10.22Z"/><path d="M32.24 14.78A6.35 6.35 0 0 0 27.6 13.2a11.36 11.36 0 0 0-4.7 1 1 1 0 0 0-.58.89 1 1 0 0 0 .94.92 1.23 1.23 0 0 0 .39-.08 8.87 8.87 0 0 1 3.72-.81c2.7 0 4.28 1.33 4.28 3.92v.5a15.29 15.29 0 0 0-4.42-.61c-3.64 0-6.14 1.61-6.14 4.64v.05c0 2.95 2.7 4.48 5.37 4.48a6.29 6.29 0 0 0 5.19-2.48v1.01a1 1 0 0 0 1 1 1 1 0 0 0 1-1.06V19a5.71 5.71 0 0 0-1.41-4.22Zm-.56 7.7c0 2.28-2.17 3.89-4.81 3.89-1.94 0-3.61-1.06-3.61-2.86v-.06c0-1.8 1.5-3 4.2-3a15.2 15.2 0 0 1 4.22.61Z"/></svg>', 'Toggle font size', onFontSize));
    right.appendChild(makeIconButton('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-fullscreen" viewBox="0 0 16 16"><path d="M1.5 1a.5.5 0 0 0-.5.5v4a.5.5 0 0 1-1 0v-4A1.5 1.5 0 0 1 1.5 0h4a.5.5 0 0 1 0 1zM10 .5a.5.5 0 0 1 .5-.5h4A1.5 1.5 0 0 1 16 1.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 1-.5-.5M.5 10a.5.5 0 0 1 .5.5v4a.5.5 0 0 0 .5.5h4a.5.5 0 0 1 0 1h-4A1.5 1.5 0 0 1 0 14.5v-4a.5.5 0 0 1 .5-.5m15 0a.5.5 0 0 1 .5.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a.5.5 0 0 1 0-1h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 1 .5-.5"/></svg>', 'Toggle fullscreen', onFullscreen));
    bar.appendChild(right);
    return bar;
}
function makeIconButton(icon, label, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.title = label; btn.setAttribute('aria-label', label);
    btn.innerHTML = icon; btn.onclick = onClick || null;
    return btn;
}
// --- END: Embedded toc_and_topbar.js logic ---

// --- START: Application Logic ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM content loaded");

    const APP_DATA = JSON.parse(document.getElementById('app-data').textContent);
    console.log("APP_DATA:", APP_DATA);

    const contentIdMapping = APP_DATA.content_id_mapping || {};

    const appContainer = document.getElementById('app-container');
    const sidebarContainer = document.getElementById('sidebar-container');
    const topbarContainer = document.getElementById('topbar-container');
    const mainContent = document.getElementById('main-content');
    
    // --- Handlers ---
    const toggleSidebar = () => appContainer.classList.toggle('sidebar-open');
    
    const navigateChapter = (direction) => {
        const chapters = Array.from(document.querySelectorAll('.chapter'));
        if (chapters.length === 0) return;
        
        const currentScroll = mainContent.scrollTop;
        const topbarHeight = topbarContainer.offsetHeight;
        const viewportHeight = mainContent.clientHeight;
        let targetChapter = null;

        if (direction === 'next') {
            // Find the next chapter that is not currently visible
            for(const chapter of chapters) {
                const chapterTop = chapter.offsetTop;
                const chapterBottom = chapterTop + chapter.offsetHeight;
                const visibleBottom = currentScroll + viewportHeight;
                
                // If this chapter is below the current viewport, navigate to it
                if (chapterTop >= visibleBottom) {
                    targetChapter = chapter;
                    break;
                }
            }
            
            // If no chapter found below viewport, go to the last chapter
            if (!targetChapter) {
                targetChapter = chapters[chapters.length - 1];
            }
        } else { // 'prev'
            // Find the previous chapter that is not currently visible
            for(let i = chapters.length - 1; i >= 0; i--) {
                const chapter = chapters[i];
                const chapterTop = chapter.offsetTop;
                const visibleTop = currentScroll;
                
                // If this chapter is above the current viewport, navigate to it
                if (chapterTop < visibleTop) {
                    targetChapter = chapter;
                    break;
                }
            }
            
            // If no chapter found above viewport, go to the first chapter
            if (!targetChapter) {
                targetChapter = chapters[0];
            }
        }
        
        if (targetChapter) {
            // Scroll to chapter position minus top bar height plus some padding
            mainContent.scrollTo(0, targetChapter.offsetTop - topbarHeight - 10);
        }
    };

    const FONT_SIZES = ['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl'];
    let currentFontIndex = 2; // Start with 'text-base'
    const toggleFontSize = () => {
        const contentBody = document.querySelector('.content-body');
        if (!contentBody) return;

        const oldClass = FONT_SIZES[currentFontIndex];
        contentBody.classList.remove(oldClass);
        currentFontIndex = (currentFontIndex + 1) % FONT_SIZES.length;
        const newClass = FONT_SIZES[currentFontIndex];
        contentBody.classList.add(newClass);
        console.log(`Removed class: ${oldClass}, Added class: ${newClass}`);
    };

    const toggleFullscreen = () => {
        const topbarContainer = document.getElementById('topbar-container');
        const mainContent = document.getElementById('main-content');
        
        // Use async-friendly fullscreen requests and rely on the
        // fullscreenchange event for final state; set classes proactively
        // so UI updates immediately on success. Use feature-detection and
        // vendor fallbacks where necessary.
        const appContainer = document.getElementById('app-container');
        const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);

        const enter = async () => {
            try {
                const el = document.documentElement;
                if (el.requestFullscreen) await el.requestFullscreen();
                else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
                else if (el.mozRequestFullScreen) await el.mozRequestFullScreen();
                else if (el.msRequestFullscreen) await el.msRequestFullscreen();
                // optimistic UI update — the fullscreenchange handler will ensure final state
                appContainer.classList.add('is-fullscreen');
                // add class to the actual toolbar element (child) so CSS selector matches
                const topToolbar = topbarContainer.querySelector('.top-toolbar');
                if (topToolbar) topToolbar.classList.add('fullscreen-hidden');
                // start a polling fallback for mobile/webview to detect exit
                startFullscreenPoll();
                // safety: ensure final state sync after short delays (mobile browsers
                // can be flaky with fullscreenchange events)
                setTimeout(handleFullscreenChange, 250);
                setTimeout(handleFullscreenChange, 1000);
            } catch (e) {
                console.warn('Failed to enter fullscreen', e);
            }
        };

        const exit = async () => {
            try {
                if (document.exitFullscreen) await document.exitFullscreen();
                else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
                else if (document.mozCancelFullScreen) await document.mozCancelFullScreen();
                else if (document.msExitFullscreen) await document.msExitFullscreen();
                // optimistic UI update
                appContainer.classList.remove('is-fullscreen');
                const topToolbar = topbarContainer.querySelector('.top-toolbar');
                if (topToolbar) topToolbar.classList.remove('fullscreen-hidden');
                // stop polling if we were polling
                stopFullscreenPoll();
                setTimeout(handleFullscreenChange, 250);
                setTimeout(handleFullscreenChange, 1000);
            } catch (e) {
                console.warn('Failed to exit fullscreen', e);
            }
        };

        if (!isFs) enter(); else exit();
    };

    // Handle fullscreen change events
    const handleFullscreenChange = () => {
        const topbarContainer = document.getElementById('topbar-container');
        const appContainer = document.getElementById('app-container');
        const isFullscreen = !!(document.fullscreenElement || 
                                      document.webkitFullscreenElement || 
                                      document.mozFullScreenElement || 
                                      document.msFullscreenElement);

        const topToolbar = topbarContainer && topbarContainer.querySelector('.top-toolbar');

        if (isFullscreen) {
            appContainer.classList.add('is-fullscreen');
            if (topToolbar) topToolbar.classList.add('fullscreen-hidden');
        } else {
            appContainer.classList.remove('is-fullscreen');
            if (topToolbar) topToolbar.classList.remove('fullscreen-hidden');
            // ensure any polling is stopped when we detect exit
            stopFullscreenPoll();
        }
        // The CSS handles padding/layout for .is-fullscreen, avoid inline styles
        // Force a reflow to ensure the UI updates correctly, especially on mobile.
        if (topToolbar) {
            topToolbar.style.display = 'none';
            topToolbar.offsetHeight; // Trigger a reflow
            topToolbar.style.display = '';
        }
    };

    // Polling fallback for mobile/webview where fullscreenchange may not fire
    let _fullscreenPollId = null;
    let _fullscreenPollTimeout = null;
    const startFullscreenPoll = () => {
        if (_fullscreenPollId) return;
        _fullscreenPollId = setInterval(() => {
            const isFsNow = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
            if (!isFsNow) {
                // exited fullscreen, sync state and stop polling
                handleFullscreenChange();
                clearInterval(_fullscreenPollId);
                _fullscreenPollId = null;
                if (_fullscreenPollTimeout) { clearTimeout(_fullscreenPollTimeout); _fullscreenPollTimeout = null; }
            }
        }, 300);
        // Safety timeout: stop polling after 10s to avoid leaks
        _fullscreenPollTimeout = setTimeout(() => {
            if (_fullscreenPollId) { clearInterval(_fullscreenPollId); _fullscreenPollId = null; }
            _fullscreenPollTimeout = null;
        }, 10000);
    };
    const stopFullscreenPoll = () => {
        if (_fullscreenPollId) { clearInterval(_fullscreenPollId); _fullscreenPollId = null; }
        if (_fullscreenPollTimeout) { clearTimeout(_fullscreenPollTimeout); _fullscreenPollTimeout = null; }
    };

    // Add event listeners for all fullscreen change events
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    // Mobile/browser quirks: listen to visibility, orientation and resize events
    // to recover toolbar state when fullscreenchange might not fire.
    document.addEventListener('visibilitychange', () => { if (!document.hidden) handleFullscreenChange(); });
    window.addEventListener('orientationchange', handleFullscreenChange);
    window.addEventListener('resize', handleFullscreenChange);
    window.addEventListener('focus', handleFullscreenChange);
    window.addEventListener('resize', handleFullscreenChange);

    const handleTocClick = (item) => {
        if (!item.href) return;
        const [filePart, fragment] = item.href.split('#');
        
        let targetElement = null;
        if (fragment) {
            targetElement = document.getElementById(fragment);
        }
        
        if (!targetElement && filePart) {
            const fileName = filePart.split('/').pop();
            const chapterId = contentIdMapping[item.href] || contentIdMapping[filePart] || contentIdMapping[fileName];
            if (chapterId) {
                targetElement = document.getElementById(chapterId);
            }
        }

        if (targetElement) {
            // Use mainContent for scrolling with proper top bar offset
            const topbarHeight = topbarContainer.offsetHeight;
            mainContent.scrollTo(0, targetElement.offsetTop - topbarHeight - 10);
        }
        if (window.innerWidth < 768) {
            toggleSidebar();
        }
    };

    // --- Keyboard Controls (optimized) ---
    let scrollAnimation = null;
    let isKeyHeld = false;
    const scrollSpeed = 25; // pixels per RAF frame for continuous scroll
    const scrollAmount = 300; // Pixels to scroll per key press
    let topbarHeight = topbarContainer.offsetHeight;

    // Update topbar height on resize (responsive)
    const handleResize = () => { topbarHeight = topbarContainer.offsetHeight; };
    window.addEventListener('resize', handleResize, { passive: true });

    // Prefer native smooth scroll when available (offloads to browser compositor)
    const supportsNativeSmooth = 'scrollBehavior' in document.documentElement.style;

    const smoothScrollTo = (targetY, duration = 300) => {
        // Use native smooth scroll where possible - it's usually smoother and less janky
        if (supportsNativeSmooth) {
            try {
                mainContent.scrollTo({ top: targetY, behavior: 'smooth' });
                return;
            } catch (e) {
                /* fall through to JS animation if unsupported */
            }
        }

        if (scrollAnimation) cancelAnimationFrame(scrollAnimation);
        const startY = mainContent.scrollTop;
        const distance = targetY - startY;
        const startTime = performance.now();

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            mainContent.scrollTop = startY + (distance * easeOutQuart);
            if (progress < 1) scrollAnimation = requestAnimationFrame(animate);
        };

        scrollAnimation = requestAnimationFrame(animate);
    };

    const smoothScrollBy = (deltaY) => smoothScrollTo(mainContent.scrollTop + deltaY);

    // Continuous scrolling using requestAnimationFrame with time-based delta for smoothness
    let continuousScrollRunning = false;
    let continuousDirection = null;
    let lastRAF = null;
    const speedPerSecond = 600; // pixels per second - tuned for smoothness

    const continuousStep = (timestamp) => {
        if (!continuousScrollRunning) { lastRAF = null; return; }
        if (!lastRAF) lastRAF = timestamp;
        const delta = timestamp - lastRAF;
        lastRAF = timestamp;
        const pixels = Math.round((speedPerSecond * delta) / 1000);
        if (continuousDirection === 'up') mainContent.scrollBy(0, -pixels);
        else mainContent.scrollBy(0, pixels);
        requestAnimationFrame(continuousStep);
    };

    const startContinuousScroll = (direction) => {
        if (continuousScrollRunning) return;
        continuousDirection = direction;
        continuousScrollRunning = true;
        lastRAF = null;
        requestAnimationFrame(continuousStep);
    };

    const stopContinuousScroll = () => { continuousScrollRunning = false; isKeyHeld = false; lastRAF = null; };

    const handleKeyDown = (event) => {
        // Don't handle keyboard shortcuts when typing in input fields
        if (event.target && (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.contentEditable === 'true')) {
            return;
        }

        const key = (event.key || '').toLowerCase();

        // Prevent default for our handled keys
        if (['w','s','a','d','f','t',' ','arrowup','arrowdown','arrowleft','arrowright','pageup','pagedown','home','end'].includes(key)) {
            event.preventDefault();
        }

        if (isKeyHeld) return;
        isKeyHeld = true;

        switch (key) {
            case 'w': case 'arrowup':
                smoothScrollBy(-scrollAmount);
                startContinuousScroll('up');
                break;
            case 's': case 'arrowdown':
                smoothScrollBy(scrollAmount);
                startContinuousScroll('down');
                break;
            case 'a': case 'arrowleft':
                navigateChapter('prev');
                break;
            case 'd': case 'arrowright':
                navigateChapter('next');
                break;
            case 'f':
                toggleFullscreen();
                break;
            case 't':
                toggleFontSize();
                break;
            case ' ': // Spacebar for page down
                smoothScrollBy(mainContent.clientHeight * 0.8);
                break;
            case 'pageup':
                smoothScrollBy(-mainContent.clientHeight * 0.8);
                break;
            case 'pagedown':
                smoothScrollBy(mainContent.clientHeight * 0.8);
                break;
            case 'home':
                smoothScrollTo(0);
                break;
            case 'end':
                smoothScrollTo(mainContent.scrollHeight);
                break;
        }
    };

    const handleKeyUp = (event) => {
        const key = (event.key || '').toLowerCase();
        if (['w','s','arrowup','arrowdown'].includes(key)) stopContinuousScroll();
        if (['a','d','f','t',' ','arrowleft','arrowright','pageup','pagedown','home','end'].includes(key)) isKeyHeld = false;
    };

    // Add keyboard event listeners
    document.addEventListener('keydown', handleKeyDown, { passive: false });
    document.addEventListener('keyup', handleKeyUp, { passive: true });

    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
        if (scrollAnimation) cancelAnimationFrame(scrollAnimation);
        continuousScrollRunning = false;
    });
    
    // --- UI Initialization ---
    const tocPanel = createTocPanel({
        coverUrl: APP_DATA.cover_image_url,
        title: APP_DATA.title,
        author: APP_DATA.author,
        tocItems: APP_DATA.toc,
        onTocClick: handleTocClick
    });
    sidebarContainer.appendChild(tocPanel);

    const topBar = createTopBar({
        onSidebar: toggleSidebar,
        onPrev: () => navigateChapter('prev'),
        onNext: () => navigateChapter('next'),
        onFontSize: toggleFontSize,
        onFullscreen: toggleFullscreen
    });
    topbarContainer.appendChild(topBar);

    // Close sidebar when clicking on main content area if open
    mainContent.addEventListener('click', () => {
        if (appContainer.classList.contains('sidebar-open')) {
            toggleSidebar();
        }
    });

    // --- Scrollspy for URL Hash (IntersectionObserver with scroll fallback) ---
    const scrollTargets = Array.from(mainContent.querySelectorAll('div.chapter[id], h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]'));

    if (scrollTargets.length === 0) return; // nothing to observe

    let activeHashId = null;

    if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver((entries) => {
            // Pick the entry with the largest intersectionRatio that's intersecting
            let candidates = entries.filter(e => e.isIntersecting && e.target.id);
            if (candidates.length === 0) return;
            candidates.sort((a, b) => b.intersectionRatio - a.intersectionRatio);
            const best = candidates[0].target.id;
            if (best && best !== activeHashId) {
                activeHashId = best;
                history.replaceState(null, '', '#' + best);
            }
        }, {
            root: mainContent,
            rootMargin: '0px 0px -60% 0px',
            threshold: [0, 0.25, 0.5, 0.75, 1]
        });

        scrollTargets.forEach(t => io.observe(t));

        // Prime the hash to the first visible target quickly
        // find first target that intersects initial viewport
        for (const t of scrollTargets) {
            const rect = t.getBoundingClientRect();
            if (rect.top < window.innerHeight * 0.3) { activeHashId = t.id; break; }
        }
        if (activeHashId) history.replaceState(null, '', '#' + activeHashId);
    } else {
        // Fallback: debounced rAF-based scroll handler to avoid layout thrash
        let rafPending = false;
        const doUpdateHash = () => {
            rafPending = false;
            const buffer = window.innerHeight * 0.3;
            let closestTarget = null;
            for (let i = scrollTargets.length - 1; i >= 0; i--) {
                if (scrollTargets[i].getBoundingClientRect().top < buffer) {
                    closestTarget = scrollTargets[i];
                    break;
                }
            }
            if (!closestTarget && scrollTargets.length > 0) closestTarget = scrollTargets[0];
            if (closestTarget && location.hash !== '#' + closestTarget.id) {
                history.replaceState(null, '', '#' + closestTarget.id);
            }
        };

        const onScroll = () => {
            if (rafPending) return;
            rafPending = true;
            requestAnimationFrame(doUpdateHash);
        };

        mainContent.addEventListener('scroll', onScroll, { passive: true });
        // initial
        doUpdateHash();
    }

    // --- Image lazy-loading improvements ---
    function enableLazyLoadingImages() {
        try {
            const imgs = Array.from(mainContent.querySelectorAll('.content-body img'));
            if (imgs.length === 0) return;
            imgs.forEach(img => {
                // Prefer native browser lazy-loading
                try { img.decoding = 'async'; } catch (e) {}
                try { img.setAttribute('fetchpriority', 'low'); } catch (e) {}
                if ('loading' in HTMLImageElement.prototype) {
                    try { img.loading = 'lazy'; } catch (e) {}
                }
            });
        } catch (e) {
            // noop
        }
    }

    enableLazyLoadingImages();
});
// --- END: Application Logic ---