# **App Name**: WebGenius

## Core Features:

- Website Generation: Generate multiple static websites from a single text prompt. The number of sites created is configurable.
- Directory Structure: Each generated website will have its own directory named after its domain (e.g., coffeetime.com), containing index.html, styles/style.css, scripts/main.js, and assets/images/.
- Automatic Resource Inclusion: Automatically include Tailwind CSS via CDN, and FontAwesome or Lucide icons via CDN, directly in the index.html file.
- Section Generation: Automatically generate standard website sections: Hero, About, Services, and Contact. A tool will determine the proper way to lay out the section according to context.
- Automatic Image Population: Automatically populate each section with a relevant image fetched from Unsplash API or AI-generated, and stored in assets/images/ with proper HTML references.
- Basic Interactivity: Include basic JavaScript interactions in main.js: burger menu, smooth scrolling, and form validation.
- ZIP Archive Creation: Create a ZIP archive containing all generated websites, ready for download.

## Style Guidelines:

- Primary color: Deep purple (#673AB7), to evoke a sense of creativity and digital sophistication.
- Background color: Light gray (#F0F0F0), a soft, desaturated version of the primary, providing a clean backdrop.
- Accent color: Vivid cyan (#00BCD4), to highlight interactive elements.
- Headline font: 'Space Grotesk', a modern sans-serif with a tech-forward feel. Body font: 'Inter', a grotesque sans-serif used for longer blocks of text.
- Use a set of modern line icons from Lucide to maintain a clean and consistent style across all sites.
- Each website section will be designed with a balance of text and images, utilizing white space to improve readability.
- Implement subtle animations, like smooth scrolling and hover effects, to enhance the user experience without being intrusive.