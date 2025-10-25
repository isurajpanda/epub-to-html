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
// --- END: Embedded toc_and_topbar.js logic ---

// --- START: Application Logic ---

// Define handlers that work immediately
const toggleSidebar = () => {
    const appContainer = document.getElementById('app-container');
    if (appContainer) {
        appContainer.classList.toggle('sidebar-open');
    }
};

const navigateChapter = (direction) => {
    const chapters = Array.from(document.querySelectorAll('.chapter'));
    if (chapters.length === 0) {
        console.log('Chapters not loaded yet');
        return;
    }
    
    const mainContent = document.getElementById('main-content');
    const topbarContainer = document.getElementById('topbar-container');
    if (!mainContent || !topbarContainer) return;
    
    const currentScroll = mainContent.scrollTop;
    const topbarHeight = topbarContainer.offsetHeight;
    const viewportHeight = mainContent.clientHeight;
    let targetChapter = null;

    if (direction === 'next') {
        // Find the next chapter that is not currently visible
        for(const chapter of chapters) {
            const chapterTop = chapter.offsetTop;
            const chapterBottom = chapterTop + chapter.offsetHeight;
            const visibleTop = currentScroll + topbarHeight;
            const visibleBottom = currentScroll + viewportHeight;
            
            // If chapter is below the visible area, it's our target
            if (chapterTop > visibleBottom) {
                targetChapter = chapter;
                break;
            }
        }
    } else if (direction === 'prev') {
        // Find the previous chapter
        for(let i = chapters.length - 1; i >= 0; i--) {
            const chapter = chapters[i];
            const chapterTop = chapter.offsetTop;
            const visibleTop = currentScroll + topbarHeight;
            
            // If chapter is above the visible area, it's our target
            if (chapterTop < visibleTop) {
                targetChapter = chapter;
                break;
            }
        }
    }

    if (targetChapter) {
        const scrollPosition = Math.max(0, targetChapter.offsetTop - topbarHeight);
        mainContent.scrollTo(0, scrollPosition);
    }
};

const toggleFontSize = () => {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;
    
    const currentSize = mainContent.style.fontSize || '';
    const sizes = ['', '0.875rem', '1rem', '1.125rem', '1.25rem'];
    const currentIndex = sizes.indexOf(currentSize);
    const nextIndex = (currentIndex + 1) % sizes.length;
    mainContent.style.fontSize = sizes[nextIndex];
};

const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.log('Error attempting to enable fullscreen:', err);
        });
    } else {
        document.exitFullscreen();
    }
};

// Add event delegation for immediate button functionality
document.addEventListener('click', (event) => {
    const target = event.target.closest('button');
    if (!target) return;
    
    switch(target.id) {
        case 'sidebar-toggle':
            event.preventDefault();
            // Only allow toggle if not in loading state
            if (!target.classList.contains('button-loading')) {
                toggleSidebar();
            }
            break;
        case 'prev-chapter':
            event.preventDefault();
            navigateChapter('prev');
            break;
        case 'next-chapter':
            event.preventDefault();
            navigateChapter('next');
            break;
        case 'font-size-toggle':
            event.preventDefault();
            toggleFontSize();
            break;
        case 'fullscreen-toggle':
            event.preventDefault();
            toggleFullscreen();
            break;
    }
});

document.addEventListener('DOMContentLoaded', () => {

    const APP_DATA = JSON.parse(document.getElementById('app-data').textContent);
    
    // Remove loading state from TOC button
    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (sidebarToggle) {
        sidebarToggle.classList.remove('button-loading');
        sidebarToggle.classList.remove('loading-spinner');
        sidebarToggle.title = 'Show sidebar';
        sidebarToggle.setAttribute('aria-label', 'Show sidebar');
        // Remove loading spinner class from SVG
        const svg = sidebarToggle.querySelector('svg');
        if (svg) {
            svg.classList.remove('loading-spinner');
        }
    }

    // No redirect - / stays as /
    let isRedirected = false;
    
    // Track TOC panel state for fullscreen transitions
    let wasTocOpenBeforeFullscreen = false;

    // Get DOM elements first
    const appContainer = document.getElementById('app-container');
    const sidebarContainer = document.getElementById('sidebar-container');
    const topbarContainer = document.getElementById('topbar-container');
    const mainContent = document.getElementById('main-content');

    // Utility function for instant navigation without scrolling
    const scrollToElement = (element, smooth = false) => {
        if (!element) return;
        
        // Use CSS scroll-padding-top instead of manual calculation
        // The CSS already handles the topbar offset with scroll-padding-top
        const scrollPosition = Math.max(0, element.offsetTop);
        
        // Instant scroll without animation
        mainContent.scrollTo(0, scrollPosition);
    };

    const contentIdMapping = APP_DATA.content_id_mapping || {};
    
    // --- Handlers ---
    
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
            // Find the previous chapter by looking for the last chapter that starts before the current scroll position
            for(let i = chapters.length - 1; i >= 0; i--) {
                const chapter = chapters[i];
                const chapterTop = chapter.offsetTop;
                const chapterBottom = chapterTop + chapter.offsetHeight;
                const visibleTop = currentScroll;
                
                // If this chapter is completely above the current viewport, it's a valid previous chapter
                if (chapterBottom < visibleTop) {
                    targetChapter = chapter;
                    break;
                }
            }
            
            // If no previous chapter found, go to the first chapter
            if (!targetChapter) {
                targetChapter = chapters[0];
            }
        }
        
        if (targetChapter) {
            scrollToElement(targetChapter, false);
        }
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
                setTimeout(handleFullscreenChange, 300);
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
                setTimeout(handleFullscreenChange, 300);
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
    // Populate TOC sidebar with data
    const bookCover = document.getElementById('book-cover');
    const bookTitle = document.getElementById('book-title');
    const bookAuthor = document.getElementById('book-author');
    const tocList = document.getElementById('toc-list');

    // Set book cover
    if (APP_DATA.cover_image_url && bookCover) {
        bookCover.src = APP_DATA.cover_image_url;
        bookCover.style.display = 'block';
    }

    // Set book title
    if (APP_DATA.title && bookTitle) {
        bookTitle.textContent = truncateText(APP_DATA.title, 60);
        bookTitle.title = APP_DATA.title; // Add full title as tooltip
        bookTitle.style.display = 'block';
    }

    // Set book author
    if (APP_DATA.author && bookAuthor) {
        bookAuthor.textContent = truncateText(APP_DATA.author, 40);
        bookAuthor.title = APP_DATA.author; // Add full author as tooltip
        bookAuthor.style.display = 'block';
    }

    // Populate TOC list
    if (APP_DATA.toc && tocList) {
        tocList.appendChild(buildTocList(APP_DATA.toc, handleTocClick));
    }


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
        let isProgrammaticScroll = false; // Guard flag

        if ('IntersectionObserver' in window) {
            const io = new IntersectionObserver((entries) => {
                // Don't update hash during programmatic scrolling
                if (isProgrammaticScroll) return;
                
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
        }

        // Override scrollToElement to set the guard flag
        const originalScrollToElement = scrollToElement;
        scrollToElement = (element, smooth = false) => {
            isProgrammaticScroll = true;
            originalScrollToElement(element, smooth);
            // Reset flag after a short delay to allow for scroll completion
            setTimeout(() => { isProgrammaticScroll = false; }, 100);
        };
    }


    // Ensure consistent initial scroll position
    const initializeScrollPosition = () => {
        if (window.location.hash) {
            const targetElement = document.querySelector(window.location.hash);
            if (targetElement) {
                scrollToElement(targetElement);
            }
            // If hash element not found, don't force scroll position
        }
        // If no hash, don't force scroll position - let browser handle natural position
    };

    // Initialize scroll position
    initializeScrollPosition();
    
    // Focus main content for immediate keyboard scrolling
    mainContent.focus();
});

// Fallback: Remove loading state when window is fully loaded
window.addEventListener('load', () => {
    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (sidebarToggle && sidebarToggle.classList.contains('button-loading')) {
        sidebarToggle.classList.remove('button-loading');
        sidebarToggle.classList.remove('loading-spinner');
        sidebarToggle.title = 'Show sidebar';
        sidebarToggle.setAttribute('aria-label', 'Show sidebar');
        const svg = sidebarToggle.querySelector('svg');
        if (svg) {
            svg.classList.remove('loading-spinner');
        }
    }
});
// --- END: Application Logic ---