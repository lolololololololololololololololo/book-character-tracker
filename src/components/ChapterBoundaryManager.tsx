import React, { useState, useEffect } from 'react';
import { Chapter } from '../types';
import ChapterSidebar from './ChapterSidebar';
import PDFViewer from './PDFViewer';

interface ChapterBoundaryManagerProps {
  pdfDocument: any;
  initialChapters?: Chapter[];
  onChaptersUpdated: (chapters: Chapter[]) => void;
  onComplete: (chapters: Chapter[]) => void;
  onCancel: () => void;
}

const ChapterBoundaryManager: React.FC<ChapterBoundaryManagerProps> = ({
  pdfDocument,
  initialChapters = [],
  onChaptersUpdated,
  onComplete,
  onCancel
}) => {
  const [chapters, setChapters] = useState<Chapter[]>(initialChapters);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);

  // Initialize with default chapters if none provided
  useEffect(() => {
    if (initialChapters.length === 0 && pdfDocument) {
      const defaultChapters: Chapter[] = [
        { index: 0, title: 'Chapter 1', isComplete: false },
        { index: 1, title: 'Chapter 2', isComplete: false },
        { index: 2, title: 'Chapter 3', isComplete: false }
      ];
      setChapters(defaultChapters);
    }
  }, [initialChapters, pdfDocument]);

  // Update parent component when chapters change
  useEffect(() => {
    onChaptersUpdated(chapters);
  }, [chapters, onChaptersUpdated]);

  const handleAddChapter = () => {
    const newChapter: Chapter = {
      index: chapters.length,
      title: `Chapter ${chapters.length + 1}`,
      isComplete: false
    };
    setChapters(prev => [...prev, newChapter]);
  };

  const handleRemoveChapter = (chapterIndex: number) => {
    if (chapters.length <= 1) {
      alert('You must have at least one chapter');
      return;
    }

    setChapters(prev => {
      const updated = prev.filter((_, index) => index !== chapterIndex);
      // Reindex chapters
      return updated.map((chapter, index) => ({
        ...chapter,
        index
      }));
    });

    // Update selected chapter if it was removed
    if (selectedChapter === chapterIndex) {
      setSelectedChapter(null);
    } else if (selectedChapter !== null && selectedChapter > chapterIndex) {
      setSelectedChapter(selectedChapter - 1);
    }
  };

  const handleChapterTitleChange = (chapterIndex: number, title: string) => {
    setChapters(prev => prev.map((chapter, index) => 
      index === chapterIndex 
        ? { ...chapter, title }
        : chapter
    ));
  };

  const handleChapterSelect = (chapterIndex: number) => {
    setSelectedChapter(chapterIndex);
  };

  const handleChapterBoundarySet = (chapterIndex: number, type: 'start' | 'end', pageNumber: number) => {
    setChapters(prev => {
      const updated = [...prev];
      
      if (type === 'start') {
        updated[chapterIndex] = {
          ...updated[chapterIndex],
          startPage: pageNumber
        };
      } else if (type === 'end') {
        updated[chapterIndex] = {
          ...updated[chapterIndex],
          endPage: pageNumber
        };

        // Automatically set the next chapter's start page
        if (chapterIndex < updated.length - 1) {
          const nextChapterIndex = chapterIndex + 1;
          updated[nextChapterIndex] = {
            ...updated[nextChapterIndex],
            startPage: pageNumber + 1
          };
        }
      }

      // Update completion status
      updated[chapterIndex] = {
        ...updated[chapterIndex],
        isComplete: Boolean(updated[chapterIndex].startPage && updated[chapterIndex].endPage)
      };

      return updated;
    });
  };

  const handleComplete = () => {
    // Validate that all chapters have at least start pages
    const incompleteChapters = chapters.filter(chapter => !chapter.startPage);
    
    if (incompleteChapters.length > 0) {
      const chapterNames = incompleteChapters.map(c => c.title).join(', ');
      alert(`Please set start pages for: ${chapterNames}`);
      return;
    }

    onComplete(chapters);
  };

  const getCompletionStats = () => {
    const complete = chapters.filter(c => c.isComplete).length;
    const withStart = chapters.filter(c => c.startPage).length;
    return { complete, withStart, total: chapters.length };
  };

  const stats = getCompletionStats();

  return (
    <div className="flex h-full w-full bg-gray-100">
      {/* Sidebar */}
      <ChapterSidebar
        chapters={chapters}
        selectedChapter={selectedChapter}
        onChapterSelect={handleChapterSelect}
        onAddChapter={handleAddChapter}
        onRemoveChapter={handleRemoveChapter}
        onChapterTitleChange={handleChapterTitleChange}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Chapter Boundary Editor</h1>
              <p className="text-sm text-gray-600 mt-1">
                Define where each chapter starts and ends in your PDF
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Progress Stats */}
              <div className="text-sm text-gray-600">
                <span className="font-medium">{stats.complete}</span> complete, 
                <span className="font-medium ml-1">{stats.withStart}</span> with start pages
                <span className="ml-1">of {stats.total} chapters</span>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={onCancel}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                
                <button
                  onClick={handleComplete}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Continue to Analysis
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* PDF Viewer */}
        <div className="flex-1">
          <PDFViewer
            pdfDocument={pdfDocument}
            chapters={chapters}
            selectedChapter={selectedChapter}
            onChapterBoundarySet={handleChapterBoundarySet}
          />
        </div>
      </div>
    </div>
  );
};

export default ChapterBoundaryManager;