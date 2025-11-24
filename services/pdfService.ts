import { PDFDocument } from 'pdf-lib';
import html2canvas from 'html2canvas';
import { Attachment } from '../types';

export const generateDownloadablePDF = async (elementId: string, attachments: Attachment[], filename: string) => {
  try {
    // 1. Capture the HTML content (Request Details + Audit Trail)
    const element = document.getElementById(elementId);
    if (!element) throw new Error('Content element not found');

    // Temporarily adjust styles for better capture (remove scrollbars, full height)
    const originalOverflow = element.style.overflow;
    element.style.overflow = 'visible';
    
    // Create high-res canvas
    const canvas = await html2canvas(element, {
      scale: 2, // Higher quality
      logging: false,
      useCORS: true, // For loading images if any
      backgroundColor: '#ffffff'
    });

    element.style.overflow = originalOverflow; // Restore styles

    const imgData = canvas.toDataURL('image/png');

    // 2. Create a new PDF Document
    const pdfDoc = await PDFDocument.create();
    
    // Calculate dimensions to fit A4 or keep ratio
    // A4 is approx 595 x 842 points
    const pageWidth = 595.28;
    const pageHeight = 842.38;
    
    // Scale image to fit width
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * pageWidth) / canvas.width;

    // If content is very long, we might need multiple pages for the HTML content itself
    // For simplicity in this version, we resize or let it be one long page (PDF-Lib allows custom page sizes)
    // Let's make the page height dynamic to fit the content if it's longer than A4
    const finalPageHeight = Math.max(pageHeight, imgHeight);
    
    const page = pdfDoc.addPage([pageWidth, finalPageHeight]);
    const embeddedImage = await pdfDoc.embedPng(imgData);
    
    page.drawImage(embeddedImage, {
      x: 0,
      y: finalPageHeight - imgHeight, // Draw from top
      width: imgWidth,
      height: imgHeight,
    });

    // 3. Append Attachments
    for (const file of attachments) {
      if (file.type === 'application/pdf') {
        try {
          // Load the attached PDF
          const attachedPdfBytes = base64ToUint8Array(file.data);
          const attachedPdf = await PDFDocument.load(attachedPdfBytes);
          
          // Copy all pages
          const copiedPages = await pdfDoc.copyPages(attachedPdf, attachedPdf.getPageIndices());
          
          copiedPages.forEach((cp) => {
            pdfDoc.addPage(cp);
          });
        } catch (e) {
          console.error(`Failed to merge PDF ${file.name}`, e);
        }
      } else if (file.type.startsWith('image/')) {
        // If it's an image, add a new page and draw it
        try {
           const imageBytes = base64ToUint8Array(file.data);
           let embeddedImg;
           if (file.type === 'image/png') {
             embeddedImg = await pdfDoc.embedPng(imageBytes);
           } else {
             embeddedImg = await pdfDoc.embedJpg(imageBytes);
           }
           
           const imgDims = embeddedImg.scale(1);
           // Scale down if too big for A4
           let w = imgDims.width;
           let h = imgDims.height;
           const maxW = pageWidth - 40;
           const maxH = pageHeight - 40;
           
           const scale = Math.min(maxW / w, maxH / h, 1);
           w = w * scale;
           h = h * scale;

           const newPage = pdfDoc.addPage([pageWidth, pageHeight]);
           newPage.drawImage(embeddedImg, {
             x: (pageWidth - w) / 2,
             y: (pageHeight - h) / 2,
             width: w,
             height: h
           });
        } catch (e) {
           console.error(`Failed to merge Image ${file.name}`, e);
        }
      }
    }

    // 4. Save and Trigger Download
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

  } catch (error) {
    console.error('PDF Generation Error:', error);
    alert('Failed to generate PDF. Please try again.');
  }
};

function base64ToUint8Array(base64: string) {
  // Handle standard base64 strings possibly including metadata prefix
  const base64Data = base64.split(',')[1] || base64;
  const binaryString = window.atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
