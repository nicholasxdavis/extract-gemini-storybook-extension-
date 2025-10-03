chrome.action.onClicked.addListener(async (tab) => {
  try {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: createUI,
    });
  } catch (err) {
    console.error("Error injecting script:", err);
  }
});

function createUI() {
  const extractStorybookData = () => {
    const bookData = {
        title: document.querySelector('.cover-title')?.textContent || 'Untitled Storybook',
        author: document.querySelector('.cover-subtitle')?.textContent || 'by AI',
        imageUrls: [],
        textContents: []
    };
    const contentElements = document.querySelectorAll([
        '.cover-image-container img', '.cover-art img', '.page:not([class*="cover"]) img',
        'storybook-page img', 'storybook-image-page-content img', 'div.story-text-container p',
        'p.story-text'
    ].join(', '));
    const addedImageUrls = new Set();
    const addedTextContent = new Set();
    for (const el of contentElements) {
        if (el.tagName === 'IMG') {
            const src = el.src;
            if (src && !addedImageUrls.has(src)) {
                bookData.imageUrls.push(src);
                addedImageUrls.add(src);
            }
        } else if (el.tagName === 'P') {
            const text = el.textContent.trim();
            if (text && !addedTextContent.has(text)) {
                bookData.textContents.push(text);
                addedTextContent.add(text);
            }
        }
    }
    return bookData;
  };

  const bookData = extractStorybookData();

  if (!bookData || bookData.imageUrls.length === 0) {
    alert("Storybook Extractor: Could not find storybook content on this page.");
    return;
  }

  const existingOverlay = document.getElementById('storybook-extractor-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }

  const overlay = document.createElement('div');
  overlay.id = 'storybook-extractor-overlay';
  const container = document.createElement('div');
  container.id = 'storybook-extractor-container';
  const titleElement = document.createElement('h1');
  titleElement.textContent = bookData.title;
  const coverPreview = document.createElement('img');
  coverPreview.src = bookData.imageUrls[0];
  coverPreview.id = 'storybook-extractor-cover-preview';
  const closeIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
  const downloadButton = document.createElement('button');
  downloadButton.textContent = 'Download PDF';
  downloadButton.id = 'storybook-extractor-download-btn';
  const closeButton = document.createElement('button');
  closeButton.innerHTML = closeIconSVG;
  closeButton.id = 'storybook-extractor-close-btn';

  downloadButton.addEventListener('click', () => {
    downloadButton.textContent = 'Generating...';
    downloadButton.disabled = true;
    chrome.storage.local.set({ bookDataForGenerator: bookData }, () => {
      window.open(chrome.runtime.getURL('generator.html'), '_blank');
      setTimeout(() => { overlay.remove(); }, 1000);
    });
  });

  closeButton.addEventListener('click', () => { overlay.remove(); });

  container.appendChild(closeButton);
  container.appendChild(titleElement);
  container.appendChild(coverPreview);
  container.appendChild(downloadButton);
  overlay.appendChild(container);
  document.body.appendChild(overlay);

  const styleId = 'storybook-extractor-styles';
  if (!document.getElementById(styleId)) {
      const link = document.createElement('link');
      link.id = styleId;
      link.rel = 'stylesheet';
      link.type = 'text/css';
      link.href = chrome.runtime.getURL('style.css');
      document.head.appendChild(link);
  }
}

function fetchAsDataURL(url) {
  return new Promise(async (resolve, reject) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    } catch (error) {
      reject(error);
    }
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'fetchImage') {
    fetchAsDataURL(message.url)
      .then(dataUrl => { sendResponse({ success: true, dataUrl }); })
      .catch(error => {
        console.error(`Failed to fetch ${message.url}:`, error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});