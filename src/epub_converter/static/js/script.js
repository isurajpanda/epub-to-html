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
    const tocOverlay = document.getElementById('toc-overlay');
    
    if (appContainer) {
        const isOpen = appContainer.classList.toggle('sidebar-open');
        
        // Toggle overlay shield (mobile only)
        if (tocOverlay && window.innerWidth < 768) {
            if (isOpen) {
                tocOverlay.classList.add('active');
            } else {
                tocOverlay.classList.remove('active');
            }
        }
    }
};


const toggleFontSize = () => {
    const contentBody = document.querySelector('.content-body');
    if (!contentBody) return;
    
    const sizeClasses = ['text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl'];
    const currentClass = sizeClasses.find(cls => contentBody.classList.contains(cls)) || 'text-base';
    const currentIndex = sizeClasses.indexOf(currentClass);
    const nextIndex = (currentIndex + 1) % sizeClasses.length;
    
    // Remove all size classes
    sizeClasses.forEach(cls => contentBody.classList.remove(cls));
    // Add the new size class
    contentBody.classList.add(sizeClasses[nextIndex]);
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

const downloadEpub = () => {
    // Get the EPUB filename from the app data
    const appDataElement = document.getElementById('app-data');
    if (!appDataElement) return;
    
    const appData = JSON.parse(appDataElement.textContent);
    const epubFilename = appData.epub_filename;
    
    if (!epubFilename) {
        console.log('No EPUB filename found in metadata');
        return;
    }
    
    // Create download link pointing to the EPUB file in the parent directory
    const downloadLink = document.createElement('a');
    downloadLink.href = '../' + epubFilename;
    downloadLink.download = epubFilename;
    downloadLink.style.display = 'none';
    
    // Add to DOM, trigger download, then remove
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
};

const navigateChapter = (direction) => {
    const chapters = Array.from(document.querySelectorAll('.chapter'));
    if (chapters.length === 0) return;
    
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
            
            // If this chapter starts before the current viewport, it's a valid previous chapter
            // Use a small buffer (50px) to make navigation more forgiving
            if (chapterTop < visibleTop - 50) {
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
        // Use CSS scroll-padding-top instead of manual calculation
        const scrollPosition = Math.max(0, targetChapter.offsetTop);
        mainContent.scrollTo(0, scrollPosition);
    }
};

// Image Modal Functionality (Mobile Only)
let savedScrollPosition = 0;

const openImageModal = (imageSrc, imageAlt) => {
    // Only work on mobile devices
    if (window.innerWidth > 768) return;
    
    const modal = document.getElementById('image-modal');
    const modalImage = document.getElementById('modal-image');
    const mainContent = document.getElementById('main-content');
    
    if (!modal || !modalImage || !mainContent) return;
    
    // Save current scroll position
    savedScrollPosition = mainContent.scrollTop;
    
    modalImage.src = imageSrc;
    modalImage.alt = imageAlt || 'Image';
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
};

const closeImageModal = () => {
    const modal = document.getElementById('image-modal');
    const mainContent = document.getElementById('main-content');
    
    if (!modal || !mainContent) return;
    
    // Reset viewport zoom to 1.0 to prevent staying zoomed
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
        // After a short delay, re-enable user scaling for normal reading
        setTimeout(() => {
            viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes');
        }, 100);
    }
    
    modal.classList.remove('active');
    document.body.style.overflow = ''; // Restore scrolling
    
    // Restore scroll position after a short delay to ensure modal is closed
    setTimeout(() => {
        mainContent.scrollTo(0, savedScrollPosition);
    }, 100);
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
        case 'download-epub':
            event.preventDefault();
            downloadEpub();
            break;
        case 'fullscreen-toggle':
            event.preventDefault();
            toggleFullscreen();
            break;
        case 'modal-close':
            event.preventDefault();
            closeImageModal();
            break;
    }
});

// Image click handler - overlay handles TOC blocking
document.addEventListener('click', (event) => {
    // Only work on mobile devices
    if (window.innerWidth > 768) return;
    
    const img = event.target.closest('img');
    if (!img || !img.closest('.content-body')) return;
    
    // Open modal - overlay will prevent this from being reached if TOC is open
    event.preventDefault();
    event.stopPropagation();
    openImageModal(img.src, img.alt);
});

// Handle modal background clicks to close
document.addEventListener('click', (event) => {
    const modal = document.getElementById('image-modal');
    if (event.target === modal) {
        closeImageModal();
    }
});

// Handle keyboard shortcuts for modal (mobile only)
document.addEventListener('keydown', (event) => {
    // Only work on mobile devices
    if (window.innerWidth > 768) return;
    
    const modal = document.getElementById('image-modal');
    if (!modal || !modal.classList.contains('active')) return;
    
    if (event.key === 'Escape') {
        closeImageModal();
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

    // Close TOC when clicking on the overlay shield
    const tocOverlay = document.getElementById('toc-overlay');
    if (tocOverlay) {
        tocOverlay.addEventListener('click', (event) => {
            // Don't close TOC if clicking on the sidebar itself
            if (event.target.closest('#sidebar-container')) {
                return;
            }
            
            // Close the TOC when overlay is clicked
            if (appContainer && appContainer.classList.contains('sidebar-open')) {
                event.preventDefault();
                event.stopPropagation();
                toggleSidebar();
            }
        });
    }

    // Utility function for instant navigation without scrolling
    let scrollToElement = (element, smooth = false) => {
        if (!element) return;
        
        // Use CSS scroll-padding-top instead of manual calculation
        // The CSS already handles the topbar offset with scroll-padding-top
        const scrollPosition = Math.max(0, element.offsetTop);
        
        // Instant scroll without animation
        mainContent.scrollTo(0, scrollPosition);
    };

    const contentIdMapping = APP_DATA.content_id_mapping || {};
    
    // --- Handlers ---


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
            if (topToolbar) {
                topToolbar.classList.remove('fullscreen-hidden');
                // Force visibility restoration on mobile
                topToolbar.style.opacity = '1';
                topToolbar.style.visibility = 'visible';
                topToolbar.style.pointerEvents = 'auto';
            }
            // ensure any polling is stopped when we detect exit
            stopFullscreenPoll();
        }
        
        // Force a reflow to ensure the UI updates correctly, especially on mobile
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
        // Only set src if it's not already set in the HTML (server-side rendered)
        if (!bookCover.src || bookCover.src === '') {
            bookCover.src = APP_DATA.cover_image_url;
        }
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
    let activeHashId = null;
    let isProgrammaticScroll = false; // Guard flag
    let isInitialLoad = true; // Flag to prevent unwanted scrolling on first load

    // Disable scroll override - no automatic scrolling behavior
    // scrollToElement remains as the original function without any overrides

    // Disable automatic hash updates - no auto-scrolling behavior
    // The intersection observer is disabled to prevent automatic scrolling


    // Completely disable all scroll initialization - let browser handle everything naturally
    // No scroll manipulation at all
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