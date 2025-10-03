window.addEventListener('load', () => {
  chrome.storage.local.get('bookDataForGenerator', async ({ bookDataForGenerator }) => {
    const statusElement = document.getElementById('status');

    if (bookDataForGenerator) {
      try {
        // --- MODIFIED: Show icon on download start ---
        statusElement.innerHTML = `
            <div class="generator-main">
                <img src="${chrome.runtime.getURL("img/logo.webp")}" class="success-icon" alt="Logo">
                <h1>Generating PDF...</h1>
                <p>Fetching images and fonts. This may take a moment.</p>
            </div>`;

        const pdfBytes = await createPdf(bookDataForGenerator);
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        const filename = bookDataForGenerator.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.pdf';
        link.download = filename;
        link.click();
        
        URL.revokeObjectURL(link.href);
        
        // --- UPDATED SUCCESS MESSAGE WITH NEW LAYOUT AND ICON ---
        statusElement.innerHTML = `
            <div class="generator-main">
                <img src="${chrome.runtime.getURL("img/logo.webp")}" class="success-icon" alt="Download Icon">
                <h1>Download Complete!</h1>
            </div>
            <div class="generator-footer">
                <a href="https://buymeacoffee.com/galore" target="_blank" rel="noopener noreferrer">
                    Support us <img src="${chrome.runtime.getURL("img/heart.png")}" class="heart-icon" alt="Heart">
                </a>
            </div>
        `;
        // Add a class to the container to trigger new styles
        statusElement.classList.add('success');

      } catch (err) {
        console.error("PDF generation failed:", err);
        statusElement.innerHTML = `<h1>Error</h1><p>Could not generate PDF. ${err.message}</p><p>Please check the console for details.</p>`;
      } finally {
        chrome.storage.local.remove('bookDataForGenerator');
      }
    } else {
      statusElement.innerHTML = '<h1>Error</h1><p>Could not find storybook data. Please go back and try extracting again.</p>';
    }
  });
});

async function createPdf(bookData) {
    const { PDFDocument, rgb, PageSizes } = PDFLib;
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    const poppinsRegularBytes = await fetch(chrome.runtime.getURL('fonts/poppins-latin-400-normal.ttf')).then(res => res.arrayBuffer());
    const poppinsBoldBytes = await fetch(chrome.runtime.getURL('fonts/poppins-latin-500-normal.ttf')).then(res => res.arrayBuffer());
    const poppinsRegular = await pdfDoc.embedFont(poppinsRegularBytes);
    const poppinsBold = await pdfDoc.embedFont(poppinsBoldBytes);

    const [pageWidth, pageHeight] = PageSizes.Letter;
    const margin = 72;

    const fetchAndEmbedImage = async (url) => {
        const response = await chrome.runtime.sendMessage({ type: 'fetchImage', url });
        if (!response || !response.success) throw new Error(`Failed to fetch image: ${url}`);
        const dataUrl = response.dataUrl;
        const imageBytes = await fetch(dataUrl).then(res => res.arrayBuffer());
        if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) {
            return await pdfDoc.embedJpg(imageBytes);
        }
        return await pdfDoc.embedPng(imageBytes);
    };
    
    if (bookData.imageUrls.length > 0) {
        const coverImage = await fetchAndEmbedImage(bookData.imageUrls[0]);
        const coverPage = pdfDoc.addPage(PageSizes.Letter);
        const { width, height } = coverPage.getSize();
        coverPage.drawImage(coverImage, { x: 0, y: 0, width, height });
    }

    pdfDoc.addPage(PageSizes.Letter);
    const titlePage = pdfDoc.addPage(PageSizes.Letter);
    drawText(bookData.title, { page: titlePage, font: poppinsBold, size: 48, y: pageHeight / 2 + 50, color: rgb(0, 0, 0), maxWidth: pageWidth - (margin * 2) });
    drawText(bookData.author, { page: titlePage, font: poppinsRegular, size: 24, y: pageHeight / 2 - 20, color: rgb(0.2, 0.2, 0.2), maxWidth: pageWidth - (margin * 2) });
    
    for (let i = 1; i < bookData.imageUrls.length; i++) {
        const textIndex = i - 1;

        const illustrationImage = await fetchAndEmbedImage(bookData.imageUrls[i]);
        const illustrationPage = pdfDoc.addPage(PageSizes.Letter);
        const { width, height } = illustrationPage.getSize();
        illustrationPage.drawImage(illustrationImage, { x: 0, y: 0, width, height });
        
        if (textIndex < bookData.textContents.length) {
            const textPage = pdfDoc.addPage(PageSizes.Letter);
            drawText(bookData.textContents[textIndex], {
                page: textPage,
                font: poppinsRegular,
                size: 21,
                y: pageHeight / 2,
                color: rgb(0, 0, 0),
                lineHeight: 36,
                maxWidth: pageWidth - (margin * 2)
            });
            const pageNumStr = String(i);
            const numWidth = poppinsRegular.widthOfTextAtSize(pageNumStr, 12);
            textPage.drawText(pageNumStr, {
                x: pageWidth - margin - numWidth,
                y: margin - 20,
                font: poppinsRegular,
                size: 12,
                color: rgb(0.4, 0.4, 0.4)
            });
        }
    }

    return await pdfDoc.save();
}

function drawText(text, options) {
    const { page, font, size, color, y, lineHeight, maxWidth } = options;
    const { width: pageWidth } = page.getSize();
    const lines = wrapText(text, font, size, maxWidth);
    const totalTextHeight = lines.length * (lineHeight || size);
    let currentY = y + (totalTextHeight / 2) - size;
    lines.forEach(line => {
        const textWidth = font.widthOfTextAtSize(line, size);
        page.drawText(line, {
            x: (pageWidth - textWidth) / 2, y: currentY, font, size, color, lineHeight
        });
        currentY -= (lineHeight || size);
    });
}

function wrapText(text, font, size, maxWidth) {
    if (!text) return [''];
    if (!maxWidth) return text.split('\n');
    const words = text.replace(/\n/g, ' \n ').split(' ');
    let line = '';
    const lines = [];
    for (const word of words) {
        if (word === '\n') {
            lines.push(line);
            line = '';
            continue;
        }
        const testLine = line + (line ? ' ' : '') + word;
        const width = font.widthOfTextAtSize(testLine, size);
        if (width > maxWidth) {
            lines.push(line);
            line = word;
        } else {
            line = testLine;
        }
    }
    lines.push(line);
    return lines;
}