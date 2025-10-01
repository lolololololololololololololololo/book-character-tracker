import React from 'react';
import { Chapter } from '../types';

interface ChapterSidebarProps {
  chapters: Chapter[];
  selectedChapter: number | null;
  onChapterSelect: (chapterIndex: number) => void;
  onAddChapter: () => void;
  onRemoveChapter: (chapterIndex: number) => void;
  onChapterTitleChange: (chapterIndex: number, title: string) => void;
}

const ChapterSidebar: React.FC<ChapterSidebarProps> = ({
  chapters,
  selectedChapter,
  onChapterSelect,
  onAddChapter,
  onRemoveChapter,
  onChapterTitleChange
}) => {
  const getChapterStatus = (chapter: Chapter) => {
    if (chapter.startPage && chapter.endPage) {
      return 'complete';
    } else if (chapter.startPage) {
      return 'partial';
    }
    return 'empty';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete':
        return 'bg-green-100 border-green-300 text-green-800';
      case 'partial':
        return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      default:
        return 'bg-gray-100 border-gray-300 text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return '✓';
      case 'partial':
        return '◐';
      default:
        return '○';
    }
  };

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Chapter Overview</h2>
        <button
          onClick={onAddChapter}
          className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          + Add Chapter
        </button>
      </div>

      {/* Chapter List */}
      <div className="flex-1 overflow-y-auto">
        {chapters.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <p>No chapters added yet.</p>
            <p className="text-sm mt-1">Click "Add Chapter" to start.</p>
          </div>
        ) : (
          <div className="p-2">
            {chapters.map((chapter, index) => {
              const status = getChapterStatus(chapter);
              const isSelected = selectedChapter === index;
              
              return (
                <div
                  key={index}
                  className={`mb-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => onChapterSelect(index)}
                >
                  {/* Chapter Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${getStatusColor(status)}`}>
                        {getStatusIcon(status)}
                      </span>
                      <span className="text-sm font-medium text-gray-600">
                        Chapter {index + 1}
                      </span>
                    </div>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveChapter(index);
                      }}
                      className="text-red-500 hover:text-red-700 text-xs p-1"
                      title="Remove chapter"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Chapter Title Input */}
                  <input
                    type="text"
                    value={chapter.title}
                    onChange={(e) => {
                      e.stopPropagation();
                      onChapterTitleChange(index, e.target.value);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    placeholder={`Chapter ${index + 1} Title`}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                  />

                  {/* Chapter Pages Info */}
                  <div className="mt-2 text-xs text-gray-500">
                    {chapter.startPage && chapter.endPage ? (
                      <span>Pages {chapter.startPage}-{chapter.endPage}</span>
                    ) : chapter.startPage ? (
                      <span>Starts: Page {chapter.startPage}</span>
                    ) : (
                      <span>No pages set</span>
                    )}
                  </div>

                  {/* Progress Indicator */}
                  <div className="mt-2">
                    <div className="flex gap-1">
                      <div className={`w-2 h-2 rounded-full ${chapter.startPage ? 'bg-green-400' : 'bg-gray-300'}`} />
                      <div className={`w-2 h-2 rounded-full ${chapter.endPage ? 'bg-green-400' : 'bg-gray-300'}`} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <h3 className="text-sm font-medium text-gray-700 mb-2">How to use:</h3>
        <ul className="text-xs text-gray-600 space-y-1">
          <li>1. Select a chapter from the list</li>
          <li>2. Navigate to the first page in the PDF</li>
          <li>3. Click "Set Chapter Start"</li>
          <li>4. Navigate to the last page</li>
          <li>5. Click "Set Chapter End"</li>
        </ul>
      </div>
    </div>
  );
};

export default ChapterSidebar;