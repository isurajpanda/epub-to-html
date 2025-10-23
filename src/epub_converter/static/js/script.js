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
    left.appendChild(makeIconButton('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-list" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5"/></svg>', 'Show sidebar', onSidebar));
    left.appendChild(makeIconButton('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-left-short" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M12 8a.5.5 0 0 1-.5.5H5.707l2.147 2.146a.5.5 0 0 1-.708.708l-3-3a.5.5 0 0 1 0-.708l3-3a.5.5 0 1 1 .708.708L5.707 7.5H11.5a.5.5 0 0 1 .5.5"/></svg>', 'Previous Chapter', onPrev));
    left.appendChild(makeIconButton('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-right-short" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M4 8a.5.5 0 0 1 .5-.5h5.793L8.146 5.354a.5.5 0 1 1 .708-.708l3 3a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708-.708L10.293 8.5H4.5A.5.5 0 0 1 4 8"/></svg>', 'Next Chapter', onNext));
    bar.appendChild(left);
    const right = document.createElement('div');
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

    const FONT_SIZES = ['tiny', 'small', 'normal', 'big', 'extra-big'];
    let currentFontIndex = 2; // Start with 'normal'
    const toggleFontSize = () => {
        document.body.classList.remove(`font-size-${FONT_SIZES[currentFontIndex]}`);
        currentFontIndex = (currentFontIndex + 1) % FONT_SIZES.length;
        document.body.classList.add(`font-size-${FONT_SIZES[currentFontIndex]}`);
    };

    const toggleFullscreen = () => {
        const topbarContainer = document.getElementById('topbar-container');
        const mainContent = document.getElementById('main-content');
        
        if (!document.fullscreenElement && 
            !document.webkitFullscreenElement && 
            !document.mozFullScreenElement && 
            !document.msFullscreenElement) {
            // Enter fullscreen
            if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen();
            } else if (document.documentElement.webkitRequestFullscreen) {
                document.documentElement.webkitRequestFullscreen();
            } else if (document.documentElement.mozRequestFullScreen) {
                document.documentElement.mozRequestFullScreen();
            } else if (document.documentElement.msRequestFullscreen) {
                document.documentElement.msRequestFullscreen();
            }
            topbarContainer.classList.add('fullscreen-hidden');
            mainContent.style.paddingTop = '0';
        } else {
            // Exit fullscreen
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
            topbarContainer.classList.remove('fullscreen-hidden');
            mainContent.style.paddingTop = '20px';
        }
    };

    // Handle fullscreen change events
    const handleFullscreenChange = () => {
        const topbarContainer = document.getElementById('topbar-container');
        const mainContent = document.getElementById('main-content');
        const isFullscreen = !!(document.fullscreenElement || 
                                      document.webkitFullscreenElement || 
                                      document.mozFullScreenElement || 
                                      document.msFullscreenElement);
        
        if (isFullscreen) {
            topbarContainer.classList.add('fullscreen-hidden');
            mainContent.style.paddingTop = '0';
        } else {
            topbarContainer.classList.remove('fullscreen-hidden');
            mainContent.style.paddingTop = '20px';
        }
    };

    // Add event listeners for all fullscreen change events
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

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

    // --- Keyboard Controls ---
    let scrollAnimation = null;
    let keyRepeatInterval = null;
    let isKeyHeld = false;
    const scrollSpeed = 25; // Increased pixels per frame for faster scrolling
    const scrollAmount = 300; // Pixels to scroll per key press
    const topbarHeight = topbarContainer.offsetHeight;

    const smoothScrollTo = (targetY) => {
        if (scrollAnimation) {
            cancelAnimationFrame(scrollAnimation);
        }
        
        const startY = mainContent.scrollTop;
        const distance = targetY - startY;
        const duration = 300; // Animation duration in ms
        const startTime = performance.now();
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function for smooth animation
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            
            const currentY = startY + (distance * easeOutQuart);
            mainContent.scrollTop = currentY;
            
            if (progress < 1) {
                scrollAnimation = requestAnimationFrame(animate);
            }
        };
        
        scrollAnimation = requestAnimationFrame(animate);
    };

    const smoothScrollBy = (deltaY) => {
        const targetY = mainContent.scrollTop + deltaY;
        smoothScrollTo(targetY);
    };

    const startContinuousScroll = (direction) => {
        if (keyRepeatInterval) return;
        
        const scrollStep = () => {
            if (direction === 'up') {
                mainContent.scrollBy(0, -scrollSpeed);
            } else if (direction === 'down') {
                mainContent.scrollBy(0, scrollSpeed);
            }
        };
        
        // Initial scroll
        scrollStep();
        
        // Start continuous scrolling with no FPS restriction
        keyRepeatInterval = setInterval(scrollStep, 0);
    };

    const stopContinuousScroll = () => {
        if (keyRepeatInterval) {
            clearInterval(keyRepeatInterval);
            keyRepeatInterval = null;
        }
        isKeyHeld = false;
    };

    const handleKeyDown = (event) => {
        // Don't handle keyboard shortcuts when typing in input fields
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.contentEditable === 'true') {
            return;
        }

        const key = event.key.toLowerCase();
        
        // Prevent default for all our keys
        if (['w', 's', 'a', 'd', 'f', 't', ' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'pageup', 'pagedown', 'home', 'end'].includes(key)) {
            event.preventDefault();
        }

        // If key is already being held, don't repeat the action
        if (isKeyHeld) return;
        
        isKeyHeld = true;

        switch (key) {
            case 'w':
            case 'arrowup':
                smoothScrollBy(-scrollAmount);
                startContinuousScroll('up');
                break;
            case 's':
            case 'arrowdown':
                smoothScrollBy(scrollAmount);
                startContinuousScroll('down');
                break;
            case 'a':
            case 'arrowleft':
                navigateChapter('prev');
                break;
            case 'd':
            case 'arrowright':
                navigateChapter('next');
                break;
            case 'f':
                toggleFullscreen();
                break;
            case 't':
                toggleFontSize();
                break;
            case ' ': // Spacebar for page down
                const viewportHeight = mainContent.clientHeight;
                smoothScrollBy(viewportHeight * 0.8);
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
        const key = event.key.toLowerCase();
        
        // Stop continuous scrolling for scroll keys
        if (['w', 's', 'arrowup', 'arrowdown'].includes(key)) {
            stopContinuousScroll();
        }
        
        // Reset key held state for non-scroll keys
        if (['a', 'd', 'f', 't', ' ', 'arrowleft', 'arrowright', 'pageup', 'pagedown', 'home', 'end'].includes(key)) {
            isKeyHeld = false;
        }
    };

    // Add keyboard event listeners
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    
    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
        if (scrollAnimation) {
            cancelAnimationFrame(scrollAnimation);
        }
        if (keyRepeatInterval) {
            clearInterval(keyRepeatInterval);
        }
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

    // --- Scrollspy for URL Hash ---
    const scrollTargets = Array.from(document.querySelectorAll('div.chapter[id], h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]'));
    let scrollTimeout;
    function updateHash() {
      const buffer = window.innerHeight * 0.3;
      let closestTarget = null;
      for (let i = scrollTargets.length - 1; i >= 0; i--) {
        if (scrollTargets[i].getBoundingClientRect().top < buffer) {
          closestTarget = scrollTargets[i];
          break;
        }
      }
      if (closestTarget === null && scrollTargets.length > 0) { closestTarget = scrollTargets[0]; }
      if (closestTarget && location.hash !== '#' + closestTarget.id) {
        history.replaceState(null, '', '#' + closestTarget.id);
      }
    }
    mainContent.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(updateHash, 150);
    }, {passive: true});
    updateHash();
});
// --- END: Application Logic ---