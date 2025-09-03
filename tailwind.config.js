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
                // Moonlit brand colors - correct brand palette
                moonlit: {
                    navy: '#091747',      // Primary navy text color
                    brown: '#BF9C73',     // Primary brown accent/button color
                    'brown-hover': '#A8865F', // Brown hover state
                    cream: '#FEF8F1',     // Background cream color
                    orange: '#E67A47',    // Secondary accent orange
                    peach: '#F6B398',     // Additional brand peach color
                }
            },
            fontFamily: {
                sans: ['Newsreader', 'system-ui', 'serif'], // Brand typography
            },
        },
    },
    plugins: [],
}