// File: src/lib/templates.ts

// Этот JavaScript будет встроен в каждую страницу для 100% надежности
const embeddedMainJs = `
document.addEventListener('DOMContentLoaded', function () {
    // --- Mobile Menu Logic ---
    const burgerMenu = document.getElementById('burger-menu');
    const burgerIcon = document.getElementById('burger-icon');
    const mobileNav = document.getElementById('mobile-nav');
    if (burgerMenu && mobileNav && burgerIcon) {
        const toggleMenu = () => {
            const isNavOpen = mobileNav.classList.contains('mobile-nav-visible');
            mobileNav.classList.toggle('mobile-nav-visible', !isNavOpen);
            mobileNav.classList.toggle('mobile-nav-hidden', isNavOpen);
            burgerIcon.classList.toggle('fa-bars', isNavOpen);
            burgerIcon.classList.toggle('fa-times', !isNavOpen);
            document.body.classList.toggle('overflow-hidden', !isNavOpen);
        };
        burgerMenu.addEventListener('click', toggleMenu);
        mobileNav.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', toggleMenu);
        });
    }

    // --- Cookie Banner Logic ---
    const cookieBanner = document.getElementById('cookie-banner');
    const acceptCookiesBtn = document.getElementById('accept-cookies');
    if (cookieBanner && acceptCookiesBtn) {
        const cookieName = 'user_has_accepted_cookies';
        const hideBanner = () => {
            cookieBanner.style.transform = 'translateY(100%)';
        };
        if (localStorage.getItem(cookieName)) {
            cookieBanner.style.display = 'none';
        } else {
            setTimeout(() => {
                cookieBanner.style.transform = 'translateY(0)';
            }, 1500);
        }
        acceptCookiesBtn.addEventListener('click', () => {
            localStorage.setItem(cookieName, 'true');
            hideBanner();
        }, { once: true });
    }

    // --- Smooth Scroll for Anchor Links ---
    document.querySelectorAll('a[href]').forEach(anchor => {
        const href = anchor.getAttribute('href') || '';
        const isHashLink = href.startsWith('#') || href.startsWith('/#') || href.startsWith('./#');
        if (!isHashLink) return;
        anchor.addEventListener('click', function (e) {
            const raw = this.getAttribute('href') || '';
            if (!raw) return;
            e.preventDefault();
            const selector = raw.replace(/^([./]+)/, '');
            const targetElement =
                document.getElementById(selector.replace('#', '')) ||
                document.querySelector(selector.startsWith('#') ? selector : '#' + selector);
            if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    // --- Header Shadow on Scroll ---
    const header = document.getElementById('header');
    if (header) {
        window.addEventListener('scroll', () => {
            header.classList.toggle('shadow-lg', window.scrollY > 10);
        });
    }
});
`;

// Главный шаблон сайта
export const getIndexHtmlTemplate = (title: string, metaDescription: string, allSectionsHtml: string, websiteTypes: string[] = []) => `
<!DOCTYPE html>
<html lang="en" class="scroll-smooth">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="${metaDescription}">
    <link rel="icon" href="favicon.ico" type="image/x-icon">
    <title>${title}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Space+Grotesk:wght@400;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" integrity="sha512-SnH5WK+bZxgPHs44uWIX+LLJAJ9/2PkfQKb4Z1Z8S+9C0Q5K5jEJQWv5GqQKZ0fZkqG6Yc4nV7YhZ+YB+mwkDw==" crossorigin="anonymous" referrerpolicy="no-referrer" />
    <link rel="stylesheet" href="styles/style.css">
</head>
<body class="bg-slate-900 text-gray-200 font-sans">
    <header id="header" class="bg-slate-900/80 backdrop-blur-sm fixed top-0 left-0 right-0 z-40">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex items-center justify-between h-16">
                <a href="index.html" class="text-white font-bold text-xl">${title}</a>
                <nav class="hidden md:block">
                    <div class="ml-10 flex items-baseline space-x-4">
                        <a href="index.html" class="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium">Home</a>
                        ${websiteTypes.includes('Game') ? '<a href="game.html" class="text-indigo-400 font-bold hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm">Play Game!</a>' : ''}
                        <a href="#features" class="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium">Features</a>
                        <a href="#contact" class="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium">Contact</a>
                    </div>
                </nav>
                <div class="-mr-2 flex md:hidden">
                    <button type="button" id="burger-menu" class="p-2 inline-flex items-center justify-center rounded-md text-gray-400 hover:text-white focus:outline-none"><i id="burger-icon" class="fas fa-bars text-xl"></i></button>
                </div>
            </div>
        </div>
    </header>
    <div id="mobile-nav" class="mobile-nav-hidden">
        <nav class="flex flex-col items-center justify-center h-full gap-y-8">
            <a href="index.html" class="text-gray-300 hover:text-white text-3xl font-bold">Home</a>
            ${websiteTypes.includes('Game') ? '<a href="game.html" class="text-indigo-400 hover:text-white text-3xl font-bold">Play Game!</a>' : ''}
            <a href="#features" class="text-gray-300 hover:text-white text-3xl font-bold">Features</a>
            <a href="#contact" class="text-gray-300 hover:text-white text-3xl font-bold">Contact</a>
        </nav>
    </div>
    <main class="pt-16">${allSectionsHtml}</main>
    <footer class="bg-slate-800">
      <div class="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 text-center text-gray-400">
            <div class="flex justify-center items-center space-x-4 md:space-x-6 mb-4">
                <a href="terms.html" class="text-sm hover:text-indigo-400">Terms & Conditions</a>
                <span class="text-gray-500">|</span>
                <a href="privacy.html" class="text-sm hover:text-indigo-400">Privacy Policy</a>
                <span class="text-gray-500">|</span>
                <a href="responsible-gaming.html" class="text-sm hover:text-indigo-400">Responsible Gaming</a>
            </div>
            <p class="text-xs max-w-3xl mx-auto mb-4 text-gray-500">
                This is a social gaming platform intended for an adult audience (18+) for amusement purposes only. The games do not offer "real money gambling" or an opportunity to win real money or prizes. Practice or success at social casino gaming does not imply future success at "real money gambling."
            </p>
            <p class="text-sm">&copy; ${new Date().getFullYear()} ${title}. All rights reserved.</p>
        </div>
    </footer>
    <div id="cookie-banner" class="fixed bottom-0 left-0 right-0 bg-slate-800/90 backdrop-blur-sm p-4 z-50 transform translate-y-full transition-transform"><div class="max-w-7xl mx-auto flex items-center justify-between gap-4"><p class="text-sm text-gray-300">We use cookies to enhance your experience.</p><button id="accept-cookies" class="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-500">Accept</button></div></div>
    <script>${embeddedMainJs}</script>
</body>
</html>
`;

// Универсальный шаблон для всех юридических страниц (Privacy, Terms, Responsible Gaming)
export const getLegalPageTemplate = (title: string, metaDescription: string, pageTitle: string, contentHtml: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="${metaDescription}">
    <link rel="icon" href="favicon.ico" type="image/x-icon">
    <title>${pageTitle} - ${title}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="styles/style.css">
</head>
<body class="bg-slate-900 text-gray-200 font-sans">
    <header class="bg-slate-800 shadow-md">
        <nav class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <a href="index.html" class="text-xl font-bold text-white">${title}</a>
            <a href="index.html" class="text-indigo-400 hover:text-indigo-300 font-semibold">&larr; Back to Home</a>
        </nav>
    </header>
    <main class="max-w-4xl mx-auto px-4 py-16">
        <div class="prose prose-invert lg:prose-lg">
            ${contentHtml}
        </div>
    </main>
    <div id="cookie-banner" class="fixed bottom-0 left-0 right-0 bg-slate-800/90 backdrop-blur-sm p-4 z-50 transform translate-y-full transition-transform"><div class="max-w-7xl mx-auto flex items-center justify-between gap-4"><p class="text-sm text-gray-300">We use cookies to enhance your experience.</p><button id="accept-cookies" class="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-500">Accept</button></div></div>
    <script>${embeddedMainJs}</script>
</body>
</html>
`;

// Шаблон игровой страницы
export const getGamePageTemplate = (title: string, metaDescription: string, gamePageTitle: string, gameIframePath: string, disclaimerHtml: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="${metaDescription}">
    <link rel="icon" href="favicon.ico" type="image/x-icon">
    <title>${gamePageTitle} - ${title}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Space+Grotesk:wght@400;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" />
    <link rel="stylesheet" href="styles/style.css">
</head>
<body class="bg-slate-900 text-gray-200 font-sans flex flex-col min-h-screen">
    <header class="bg-slate-800 shadow-md">
       <nav class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <a href="index.html" class="text-xl font-bold text-white">${title}</a>
            <a href="index.html" class="text-indigo-400 hover:text-indigo-300 font-semibold">&larr; Back to Home</a>
        </nav>
    </header>
    <main class="flex-grow flex flex-col items-center justify-center p-4">
        <h1 class="text-3xl md:text-5xl font-bold text-center text-white mb-6">${gamePageTitle}</h1>
        <div class="w-full max-w-5xl aspect-video bg-black rounded-lg shadow-2xl overflow-hidden border-2 border-slate-700">
            <iframe src="${gameIframePath}" frameborder="0" class="w-full h-full"></iframe>
        </div>
        <div class="mt-8 w-full max-w-5xl">
            ${disclaimerHtml}
        </div>
    </main>
    <div id="cookie-banner" class="fixed bottom-0 left-0 right-0 bg-slate-800/90 backdrop-blur-sm p-4 z-50 transform translate-y-full transition-transform"><div class="max-w-7xl mx-auto flex items-center justify-between gap-4"><p class="text-sm text-gray-300">We use cookies to enhance your experience.</p><button id="accept-cookies" class="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-500">Accept</button></div></div>
    <script>${embeddedMainJs}</script>
</body>
</html>
`;

export const stylesCssTemplate = `
body.overflow-hidden { overflow: hidden; }
.mobile-nav-hidden {
    position: fixed; top: 0; left: 0; width: 100%; height: 100vh;
    background-color: rgba(15, 23, 42, 0.98);
    backdrop-filter: blur(8px);
    z-index: 30; display: flex; align-items: center; justify-content: center;
    opacity: 0; pointer-events: none;
    transition: opacity 0.3s ease-in-out;
}
.mobile-nav-visible { opacity: 1; pointer-events: auto; }
`;
