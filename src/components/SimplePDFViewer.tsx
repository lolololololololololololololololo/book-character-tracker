import React, { useState, useEffect, useRef } from 'react';
import { Chapter } from '../types';

interface SimplePDFViewerProps {
  pdfBlob: Blob;
  chapters: Chapter[];
  selectedChapter: number | null;
  onChapterBoundarySet: (chapterIndex: number, type: 'start' | 'end', pageNumber: number) => void;
}

const SimplePDFViewer: React.FC<SimplePDFViewerProps> = ({
  pdfBlob,
  chapters,
  selectedChapter,
  onChapterBoundarySet
}) => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [viewerMode, setViewerMode] = useState<'object' | 'iframe'>('object');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const objectRef = useRef<HTMLObjectElement>(null);

  useEffect(() => {
    // Create object URL for the PDF blob
    const url = URL.createObjectURL(pdfBlob);
    setPdfUrl(url);

    // Try to detect total pages using PDF.js if available
    detectTotalPages(pdfBlob);

    // Cleanup function to revoke the object URL
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [pdfBlob]);

  // Add keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only handle keys when not typing in an input
      if (e.target instanceof HTMLInputElement) return;
      
      switch (e.key) {
        case 'ArrowLeft':
        case 'h':
          e.preventDefault();
          navigateToPage(currentPage - 1);
          break;
        case 'ArrowRight':
        case 'l':
          e.preventDefault();
          navigateToPage(currentPage + 1);
          break;
        case 's':
          if (selectedChapter !== null) {
            e.preventDefault();
            handleSetChapterStart();
          }
          break;
        case 'e':
          if (selectedChapter !== null) {
            e.preventDefault();
            handleSetChapterEnd();
          }
          break;
        case 'Home':
          e.preventDefault();
          navigateToPage(1);
          break;
        case 'End':
          e.preventDefault();
          if (totalPages > 0) {
            navigateToPage(totalPages);
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [currentPage, totalPages, selectedChapter]);

  const detectTotalPages = async (blob: Blob) => {
    try {
      // Try to use PDF.js to get total pages if available
      const pdfjsLib = (window as any).pdfjsLib;
      if (pdfjsLib) {
        const arrayBuffer = await blob.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        setTotalPages(pdf.numPages);
      }
    } catch (error) {
      console.log('Could not detect total pages:', error);
      // Fallback: estimate based on file size (very rough)
      setTotalPages(Math.max(10, Math.floor(blob.size / 50000)));
    }
  };

  const navigateToPage = (page: number) => {
    const validPage = Math.max(1, Math.min(page, totalPages || 999));
    setCurrentPage(validPage);
    
    // Update the PDF viewer to show the specific page
    if (pdfUrl) {
      const newUrl = `${pdfUrl}#page=${validPage}&toolbar=1&navpanes=0&scrollbar=1`;
      
      if (viewerMode === 'object' && objectRef.current) {
        objectRef.current.data = newUrl;
      } else if (viewerMode === 'iframe' && iframeRef.current) {
        iframeRef.current.src = newUrl;
      }
    }
  };

  const handleSetChapterStart = () => {
    if (selectedChapter !== null) {
      onChapterBoundarySet(selectedChapter, 'start', currentPage);
      // Show confirmation
      const chapterInfo = chapters[selectedChapter];
      alert(`Set start of "${chapterInfo?.title}" to page ${currentPage}`);
    }
  };

  const handleSetChapterEnd = () => {
    if (selectedChapter !== null) {
      onChapterBoundarySet(selectedChapter, 'end', currentPage);
      // Show confirmation
      const chapterInfo = chapters[selectedChapter];
      alert(`Set end of "${chapterInfo?.title}" to page ${currentPage}`);
    }
  };

  const handleQuickPageInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const page = parseInt(e.currentTarget.value);
      if (!isNaN(page)) {
        navigateToPage(page);
      }
    }
  };

  const getSelectedChapterInfo = () => {
    if (selectedChapter !== null && chapters[selectedChapter]) {
      return chapters[selectedChapter];
    }
    return null;
  };

  const selectedChapterInfo = getSelectedChapterInfo();

  if (!pdfUrl) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading PDF...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-100">
      {/* Controls */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          {/* Page Navigation */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => navigateToPage(currentPage - 1)}
                disabled={currentPage <= 1}
                className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Previous page"
              >
                ←
              </button>
              
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Page:</span>
                <input
                  type="number"
                  value={currentPage}
                  onChange={(e) => {
                    const page = parseInt(e.target.value) || 1;
                    setCurrentPage(page);
                  }}
                  onKeyPress={handleQuickPageInput}
                  onBlur={(e) => {
                    const page = parseInt(e.target.value) || 1;
                    navigateToPage(page);
                  }}
                  className="w-16 px-2 py-1 border border-gray-300 rounded text-center"
                  min="1"
                  max={totalPages || 999}
                />
                {totalPages > 0 && (
                  <span className="text-sm text-gray-600">of {totalPages}</span>
                )}
              </div>
              
              <button
                onClick={() => navigateToPage(currentPage + 1)}
                disabled={totalPages > 0 && currentPage >= totalPages}
                className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Next page"
              >
                →
              </button>
            </div>
            
            {/* Quick page jumps */}
            <div className="flex items-center space-x-1">
              <button
                onClick={() => navigateToPage(1)}
                disabled={currentPage === 1}
                className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Go to first page"
              >
                First
              </button>
              {totalPages > 0 && (
                <button
                  onClick={() => navigateToPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Go to last page"
                >
                  Last
                </button>
              )}
            </div>
          </div>

          {/* Chapter Actions */}
          <div className="flex items-center space-x-4">
            {selectedChapterInfo && (
              <div className="text-sm text-gray-600">
                <span className="font-medium">{selectedChapterInfo.title}</span>
                {selectedChapterInfo.startPage && selectedChapterInfo.endPage ? (
                  <span className="ml-2">
                    (Pages {selectedChapterInfo.startPage}-{selectedChapterInfo.endPage})
                  </span>
                ) : selectedChapterInfo.startPage ? (
                  <span className="ml-2">
                    (Start: Page {selectedChapterInfo.startPage})
                  </span>
                ) : (
                  <span className="ml-2 text-orange-600">(Not set)</span>
                )}
              </div>
            )}
            
            <div className="flex space-x-2">
              <button
                onClick={handleSetChapterStart}
                disabled={selectedChapter === null}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                Set Chapter Start
              </button>
              
              <button
                onClick={handleSetChapterEnd}
                disabled={selectedChapter === null}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                Set Chapter End
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* PDF Display */}
      <div className="flex-1 p-4">
        <div className="h-full bg-white rounded-lg shadow-sm overflow-hidden relative">
          {/* Current page indicator */}
          <div className="absolute top-2 right-2 z-10 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-sm">
            Page {currentPage}{totalPages > 0 && ` of ${totalPages}`}
          </div>
          
          {/* PDF Viewer with fallback */}
          {viewerMode === 'object' ? (
            <object
              ref={objectRef}
              data={`${pdfUrl}#page=${currentPage}&toolbar=1&navpanes=0&scrollbar=1&view=FitH`}
              type="application/pdf"
              className="w-full h-full"
              onError={() => setViewerMode('iframe')}
            >
              {/* Fallback to iframe if object fails */}
              <iframe
                ref={iframeRef}
                src={`${pdfUrl}#page=${currentPage}&toolbar=1&navpanes=0&scrollbar=1&view=FitH`}
                className="w-full h-full"
                title="PDF Viewer"
              />
            </object>
          ) : (
            <iframe
              ref={iframeRef}
              src={`${pdfUrl}#page=${currentPage}&toolbar=1&navpanes=0&scrollbar=1&view=FitH`}
              className="w-full h-full"
              title="PDF Viewer"
            />
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-gray-50 border-t border-gray-200 p-3">
        <div className="text-sm text-gray-600">
          {selectedChapter !== null ? (
            <div className="text-center">
              <div className="font-medium text-gray-800 mb-1">
                Setting boundaries for: {selectedChapterInfo?.title}
              </div>
              <div>
                Use page navigation above → Navigate to desired page → Click "Set Chapter Start" or "Set Chapter End"
              </div>
              {selectedChapterInfo?.startPage && (
                <div className="mt-1 text-green-600">
                  ✓ Start: Page {selectedChapterInfo.startPage}
                  {selectedChapterInfo.endPage && ` | End: Page ${selectedChapterInfo.endPage}`}
                </div>
              )}
              <div className="mt-2 text-xs text-gray-500">
                Keyboard shortcuts: ← → (or h l) to navigate pages | s = set start | e = set end
              </div>
            </div>
          ) : (
            <div className="text-center">
              <span className="font-medium text-gray-800">Select a chapter from the sidebar</span>
              <span className="block">to start setting its page boundaries</span>
              <div className="mt-2 text-xs text-gray-500">
                Keyboard shortcuts: ← → (or h l) to navigate pages | Home/End for first/last page
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SimplePDFViewer;