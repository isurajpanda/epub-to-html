// --- START: Embedded toc_and_topbar.js logic ---
// (The 'export' keyword has been removed to work in a single script tag)

function truncateText(text, maxLength = 50) {
    if (!text || text.length <= maxLength) {
        return text;
    }
    
    // Try to cut at a word boundary if possible
    const truncated = text.substring(0, maxLength);
    const lastSpaceIndex = truncated.lastIndexOf(' ');
    
    // If we can find a good word boundary and it's not too short, use it
    if (lastSpaceIndex > maxLength * 0.7) {
        return truncated.substring(0, lastSpaceIndex).trim() + '...';
    }
    
    // Otherwise, just cut at the character limit
    return truncated.trim() + '...';
}

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
    if (title) { 
        const h1 = document.createElement('h1'); 
        h1.textContent = truncateText(title, 60); // Truncate title to 60 characters
        h1.title = title; // Add full title as tooltip
        info.appendChild(h1); 
    }
    if (author) { 
        const p = document.createElement('p'); 
        p.textContent = truncateText(author, 40); // Truncate author to 40 characters
        p.title = author; // Add full author as tooltip
        info.appendChild(p); 
    }
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
            a.textContent = truncateText(item.label, 45); // Truncate TOC labels to 45 characters
            a.title = item.label; // Add full label as tooltip
            a.href = '#';
            a.onclick = e => { e.preventDefault(); if (onTocClick) onTocClick(item); };
            li.appendChild(a);
        } else {
            const span = document.createElement('span');
            span.textContent = truncateText(item.label, 45); // Truncate TOC labels to 45 characters
            span.title = item.label; // Add full label as tooltip
            span.style.color = 'GrayText'; 
            li.appendChild(span);
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

    const APP_DATA = JSON.parse(document.getElementById('app-data').textContent);

    // No redirect - / stays as /
    let isRedirected = false;
    
    // Track TOC panel state for fullscreen transitions
    let wasTocOpenBeforeFullscreen = false;

    // Get DOM elements first
    const appContainer = document.getElementById('app-container');
    const sidebarContainer = document.getElementById('sidebar-container');
    const topbarContainer = document.getElementById('topbar-container');
    const mainContent = document.getElementById('main-content');

    // Dynamic viewport height for mobile browsers
    const setViewportHeight = () => {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    
    // Set initial viewport height and listen for changes
    setViewportHeight();
    window.addEventListener('resize', setViewportHeight);
    window.addEventListener('orientationchange', () => {
        setTimeout(setViewportHeight, 100);
    });

    // Utility function for instant navigation without scrolling
    const scrollToElement = (element, smooth = false) => {
        if (!element) return;
        
        const topbarHeight = topbarContainer.offsetHeight;
        const scrollPosition = Math.max(0, element.offsetTop - topbarHeight);
        
        // Instant scroll without animation
        mainContent.scrollTo(0, scrollPosition);
    };

    const contentIdMapping = APP_DATA.content_id_mapping || {};
    
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
            scrollToElement(targetChapter, false);
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
                // Close TOC panel if open before entering fullscreen
                if (appContainer.classList.contains('sidebar-open')) {
                    wasTocOpenBeforeFullscreen = true;
                    appContainer.classList.remove('sidebar-open');
                } else {
                    wasTocOpenBeforeFullscreen = false;
                }
                
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
                // Failed to enter fullscreen
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
                // Restore TOC panel state if it was open before fullscreen
                if (wasTocOpenBeforeFullscreen) {
                    appContainer.classList.add('sidebar-open');
                }
                setTimeout(handleFullscreenChange, 250);
                setTimeout(handleFullscreenChange, 1000);
            } catch (e) {
                // Failed to exit fullscreen
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
        
        // Extract page ID from href (should now be in format "#page01", "#page02", etc.)
        let pageId = item.href;
        
        // Remove leading # if present
        if (pageId.startsWith('#')) {
            pageId = pageId.substring(1);
        }
        
        // Look for target element with the page ID
        let targetElement = document.getElementById(pageId);
        
        // If not found, try to find the closest chapter
        if (!targetElement) {
            // Try to find any chapter element that might be close
            const chapterElements = document.querySelectorAll('.chapter');
            if (chapterElements.length > 0) {
                // Use the first chapter as fallback
                targetElement = chapterElements[0];
                pageId = targetElement.id;
            }
        }

        if (targetElement) {
            // Update URL hash to show current page
            history.replaceState(null, '', '#' + pageId);
            scrollToElement(targetElement, false);
        } else {
            // Could not find target element
        }
        
        if (window.innerWidth < 768) {
            toggleSidebar();
        }
    };

    // --- Keyboard Controls (optimized) ---
    const handleKeyDown = (event) => {
        // Don't handle keyboard shortcuts when typing in input fields
        if (event.target && (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.contentEditable === 'true')) {
            return;
        }

        const key = (event.key || '').toLowerCase();

        // Prevent default for our handled keys (except scrolling keys)
        if (['a','d','arrowleft','arrowright','f','t'].includes(key)) {
            event.preventDefault();
        }

        switch (key) {
            case 'a': case 'arrowleft':
                navigateChapter('prev');
                break;
            case 'd': case 'arrowright':
                navigateChapter('next');
                break;
            case 'arrowup': case 'w':
                // Allow default scrolling behavior
                return;
            case 'arrowdown': case 's':
                // Allow default scrolling behavior
                return;
            case 'f':
                toggleFullscreen();
                break;
            case 't':
                toggleFontSize();
                break;
        }
    };

    // Add keyboard event listeners
    document.addEventListener('keydown', handleKeyDown, { passive: false });
    
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

    // --- Scrollspy for URL Hash (Minimal) ---
    const scrollTargets = Array.from(mainContent.querySelectorAll('div.chapter[id], h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]'));

    if (scrollTargets.length > 0) {
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
            for (const t of scrollTargets) {
                const rect = t.getBoundingClientRect();
                if (rect.top < window.innerHeight * 0.3) { activeHashId = t.id; break; }
            }
            if (activeHashId) history.replaceState(null, '', '#' + activeHashId);
        }
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

    // Ensure consistent initial scroll position
    const initializeScrollPosition = () => {
        if (window.location.hash) {
            const targetElement = document.querySelector(window.location.hash);
            scrollToElement(targetElement);
        } else {
            // Ensure we start at the top consistently
            mainContent.scrollTo(0, 0);
        }
    };

    // Initialize scroll position
    initializeScrollPosition();
    
    // Focus main content for immediate keyboard scrolling
    mainContent.focus();
});
// --- END: Application Logic ---