import React, { useState, useEffect, useRef } from 'react';
import { Chapter } from '../types';

interface PDFViewerProps {
  pdfDocument: any;
  chapters: Chapter[];
  onChapterBoundarySet: (chapterIndex: number, type: 'start' | 'end', pageNumber: number) => void;
  selectedChapter: number | null;
}

const PDFViewer: React.FC<PDFViewerProps> = ({
  pdfDocument,
  chapters,
  onChapterBoundarySet,
  selectedChapter
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pageImage, setPageImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (pdfDocument) {
      setTotalPages(pdfDocument.numPages);
    }
  }, [pdfDocument]);

  useEffect(() => {
    if (pdfDocument && currentPage > 0 && currentPage <= totalPages) {
      renderPage(currentPage);
    }
  }, [pdfDocument, currentPage, totalPages]);

  const renderPage = async (pageNumber: number) => {
    if (!pdfDocument || !canvasRef.current) return;
    
    setIsLoading(true);
    try {
      const page = await pdfDocument.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.5 });
      
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      // Add null check for context
      if (!context) {
        console.error('Failed to get 2D context from canvas');
        return;
      }
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      
      await page.render(renderContext).promise;
      
      // Convert canvas to image URL for easier styling
      const imageUrl = canvas.toDataURL();
      setPageImage(imageUrl);
    } catch (error) {
      console.error('Error rendering page:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const getCurrentChapterInfo = () => {
    if (selectedChapter === null) return null;
    return chapters[selectedChapter];
  };

  const canSetChapterStart = () => {
    if (selectedChapter === null) return false;
    const chapter = chapters[selectedChapter];
    return !chapter.startPage || chapter.startPage !== currentPage;
  };

  const canSetChapterEnd = () => {
    if (selectedChapter === null) return false;
    const chapter = chapters[selectedChapter];
    return chapter.startPage && (!chapter.endPage || chapter.endPage !== currentPage);
  };

  const handleSetChapterStart = () => {
    if (selectedChapter !== null && canSetChapterStart()) {
      onChapterBoundarySet(selectedChapter, 'start', currentPage);
    }
  };

  const handleSetChapterEnd = () => {
    if (selectedChapter !== null && canSetChapterEnd()) {
      onChapterBoundarySet(selectedChapter, 'end', currentPage);
    }
  };

  const getPageInputValue = () => {
    return currentPage.toString();
  };

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value >= 1 && value <= totalPages) {
      setCurrentPage(value);
    }
  };

  if (!pdfDocument) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100">
        <p className="text-gray-600">No PDF document loaded</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Chapter Action Buttons */}
      <div className="flex justify-center gap-4 p-4 bg-gray-50 border-b">
        {selectedChapter !== null && (
          <>
            <button
              onClick={handleSetChapterStart}
              disabled={!canSetChapterStart()}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                canSetChapterStart()
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Set Chapter Start (Page {currentPage})
            </button>
            
            <button
              onClick={handleSetChapterEnd}
              disabled={!canSetChapterEnd()}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                canSetChapterEnd()
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Set Chapter End (Page {currentPage})
            </button>
          </>
        )}
        
        {selectedChapter === null && (
          <p className="text-gray-600 py-2">Select a chapter from the sidebar to set boundaries</p>
        )}
      </div>

      {/* PDF Page Display */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading page {currentPage}...</span>
          </div>
        ) : (
          <div className="max-w-full max-h-full">
            <canvas
              ref={canvasRef}
              className="shadow-lg border border-gray-300 max-w-full max-h-full"
              style={{ display: pageImage ? 'none' : 'block' }}
            />
            {pageImage && (
              <img
                src={pageImage}
                alt={`Page ${currentPage}`}
                className="shadow-lg border border-gray-300 max-w-full max-h-full"
              />
            )}
          </div>
        )}
      </div>

      {/* Page Navigation */}
      <div className="flex items-center justify-between p-4 bg-gray-50 border-t">
        <button
          onClick={goToPreviousPage}
          disabled={currentPage <= 1}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
        >
          ← Previous
        </button>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Page</span>
          <input
            type="number"
            min="1"
            max={totalPages}
            value={getPageInputValue()}
            onChange={handlePageInputChange}
            className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm"
          />
          <span className="text-sm text-gray-600">of {totalPages}</span>
        </div>

        <button
          onClick={goToNextPage}
          disabled={currentPage >= totalPages}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
        >
          Next →
        </button>
      </div>

      {/* Current Chapter Info */}
      {getCurrentChapterInfo() && (
        <div className="px-4 py-2 bg-blue-50 border-t text-sm">
          <span className="font-medium text-blue-900">
            {getCurrentChapterInfo()?.title}
          </span>
          {getCurrentChapterInfo()?.startPage && (
            <span className="text-blue-700 ml-2">
              Start: Page {getCurrentChapterInfo()?.startPage}
            </span>
          )}
          {getCurrentChapterInfo()?.endPage && (
            <span className="text-blue-700 ml-2">
              End: Page {getCurrentChapterInfo()?.endPage}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default PDFViewer;