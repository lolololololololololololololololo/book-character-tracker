# Book Character Tracker

A Progressive Web App (PWA) that helps readers track book characters chapter-by-chapter without spoilers. The app visualizes character relationships as an interactive node map and provides character information only up to the currently selected chapter.

## Features

- **PDF Upload & Processing**: Upload PDF books and automatically detect chapters
- **AI Character Extraction**: Uses Gemini AI to extract characters from each chapter
- **Interactive Character Map**: Visualize character relationships using D3.js force-directed graphs
- **Spoiler-Free Design**: Only shows character information up to your current reading progress
- **Multiple Book Support**: Manage a library of multiple books
- **Offline Functionality**: Works offline after initial character analysis
- **PWA Installation**: Install on your device like a native app

## How It Works

1. **Upload a Book**: Select a PDF file and provide title/author information
2. **Chapter Detection**: The app automatically detects chapters in your book
3. **Read and Analyze**: As you read, analyze each chapter to extract character data
4. **Visualize Relationships**: See character connections in an interactive map
5. **Track Progress**: Navigate chapters without spoilers from future content

## Technology Stack

- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Visualization**: D3.js force-directed graphs
- **PDF Processing**: PDF.js
- **AI Integration**: Google Gemini API
- **Data Storage**: IndexedDB (via Dexie.js)
- **PWA Features**: Service Worker + Web App Manifest

## Getting Started

### Development

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open your browser to `http://localhost:5173`

### Building for Production

```bash
npm run build
```

### Deployment to GitHub Pages

This project is configured for GitHub Pages deployment:

1. Build the project: `npm run build`
2. Deploy the `dist` folder to your GitHub Pages repository
3. The app will be available at your GitHub Pages URL

## Usage Guide

### Uploading a Book

1. Click "Upload New Book" on the library page
2. Select a PDF file from your device
3. Enter the book title and author
4. The app will automatically detect chapters (or allow manual setup)
5. Click "Upload Book" to add it to your library

### Analyzing Characters

1. Open a book from your library
2. Navigate to the chapter you want to analyze
3. Click "Analyze Chapter" 
4. Wait 10-20 seconds for AI processing
5. View the extracted characters in the relationship map

### Navigating Chapters

- Use the arrow buttons to move between chapters
- Only move forward after reading each chapter to avoid spoilers
- The progress bar shows your reading progress

### Character Details

- Click any character node in the map to view detailed information
- See relationships, status, and chapter history
- All information is filtered to your current chapter position

## Character Relationship Types

The app categorizes relationships using color coding:

- **Family** (Blue): Parent, child, sibling, married to
- **Romantic** (Red): Lovers, engaged, dating
- **Conflict** (Dark Red): Enemies, rivals, fighting
- **Professional** (Green): Colleagues, mentor/student, boss
- **Friendship** (Yellow): Friends, allies, companions
- **Other** (Gray): Miscellaneous connections

## PWA Installation

### On Mobile (iOS/Android)

1. Open the app in your browser
2. Look for "Add to Home Screen" prompt
3. Follow the installation prompts
4. Access the app from your home screen

### On Desktop

1. Open the app in Chrome/Edge
2. Look for the install icon in the address bar
3. Click to install as a desktop app

## Offline Functionality

- Character analysis requires internet connection (uses Gemini AI API)
- Once analyzed, all data is stored locally using IndexedDB
- View character maps and details offline
- Upload new books offline (analysis when connection restored)

## Privacy & Data

- All book content and character data is stored locally on your device
- No book content is permanently stored on external servers
- Only chapter text is temporarily sent to Gemini API for analysis
- No user accounts or cloud storage required

## Browser Compatibility

- Modern browsers supporting:
  - ES2020 features
  - IndexedDB
  - Service Workers
  - File API
- Recommended: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

## Performance Notes

- Large PDFs may take longer to process
- Complex chapters with many characters may increase analysis time
- Recommended: Books with 10-50 chapters work best
- Character maps with 100+ characters may impact performance

## Troubleshooting

### Chapter Detection Issues
- Try manual chapter setup if automatic detection fails
- Ensure PDF has clear chapter markers or formatting

### Analysis Errors
- Check internet connection for AI processing
- Retry analysis if it fails (API rate limiting possible)
- Very short chapters may not have enough content

### Performance Issues
- Clear browser data if app becomes slow
- Reduce character visualization complexity
- Try smaller PDF files

## Contributing

This is an open-source project. Contributions welcome for:

- Bug fixes and improvements
- New visualization features
- Additional AI providers
- Mobile optimizations
- Accessibility improvements

## License

MIT License - See LICENSE file for details

## Acknowledgments

- [PDF.js](https://mozilla.github.io/pdf.js/) for PDF processing
- [D3.js](https://d3js.org/) for data visualization
- [Google Gemini](https://ai.google.dev/) for AI character extraction
- [Dexie.js](https://dexie.org/) for IndexedDB management