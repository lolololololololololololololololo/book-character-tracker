/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        relationship: {
          family: '#3B82F6',     // Blue
          romantic: '#EF4444',   // Red
          conflict: '#991B1B',   // Dark Red
          professional: '#10B981', // Green
          friendship: '#F59E0B',  // Yellow/Amber
          other: '#6B7280'       // Gray
        }
      }
    },
  },
  plugins: [],
}