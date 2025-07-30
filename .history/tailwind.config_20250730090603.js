// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
                // Moonlit brand colors extracted from Figma designs
                moonlit: {
                    coral: '#D4A574', // Main coral/salmon button color
                    'coral-hover': '#C49660',
                    'coral-light': '#E8C4A0', // Lighter coral for backgrounds
                    sage: '#9CA3AF', // Neutral sage for text
                    stone: '#78716C', // Dark stone for headings
                }
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
        },
    },
    plugins: [],
}