import { useState } from 'react'

interface AdminMenuProps {
  onResetDatabase: () => void
  onForceCleanDatabase: () => void
}

export default function AdminMenu({ onResetDatabase, onForceCleanDatabase }: AdminMenuProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="admin-menu">
      <button 
        className="admin-menu-toggle"
        onClick={() => setIsOpen(!isOpen)}
        title={isOpen ? "Hide admin menu" : "Show admin menu"}
      >
        <svg 
          className="w-5 h-5 text-gray-600 transition-transform" 
          style={{ transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)' }}
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
      
      {isOpen && (
        <div className="flex gap-2">
          <button
            onClick={() => {
              onForceCleanDatabase()
              setIsOpen(false)
            }}
            className="admin-menu-button warning"
            title="Force clean database and cache (for persistent issues)"
          >
            Force Clean
          </button>
          <button
            onClick={() => {
              onResetDatabase()
              setIsOpen(false)
            }}
            className="admin-menu-button danger"
            title="Reset database (delete all data)"
          >
            Reset Database
          </button>
        </div>
      )}
    </div>
  )
}