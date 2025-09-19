// File: src/lib/templates.ts

// Цей шаблон залишається без змін, він головний
export const getIndexHtmlTemplate = (title: string, allSectionsHtml: string, websiteTypes: string[] = []) => `
<!DOCTYPE html>
<html lang="en" class="scroll-smooth">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Space+Grotesk:wght@400;700&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" integrity="sha512-SnH5WK+bZxgPHs44uWIX+LLJAJ9/2PkfQKb4Z1Z8S+9C0Q5K5jEJQWv5GqQKZ0fZkqG6Yc4nV7YhZ+YB+mwkDw==" crossorigin="anonymous" referrerpolicy="no-referrer" />
    <link rel="stylesheet" href="styles/style.css">
</head>
<body class="bg-slate-900 text-gray-200 font-sans">
    <header id="header" class="bg-slate-900/80 backdrop-blur-sm fixed top-0 left-0 right-0 z-40 transition-shadow duration-300">
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
                    <button type="button" id="burger-menu" class="p-2 inline-flex items-center justify-center rounded-md text-gray-400 hover:text-white focus:outline-none">
                        <span class="sr-only">Open main menu</span>
                        <i id="burger-icon" class="fas fa-bars text-xl"></i>
                    </button>
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

    <main class="pt-16">
        ${allSectionsHtml}
    </main>

    <footer class="bg-slate-800">
        <div class="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 text-center text-gray-400">
            <p>&copy; ${new Date().getFullYear()} ${title}. All rights reserved.</p>
            <a href="privacy-policy.html" class="text-sm hover:text-indigo-400">Privacy Policy</a>
        </div>
    </footer>

    <div id="cookie-banner" class="fixed bottom-0 left-0 right-0 bg-slate-800/90 backdrop-blur-sm p-4 z-50 transform translate-y-full transition-transform duration-300 ease-in-out">
      <div class="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <p class="text-sm text-gray-300">We use cookies to enhance your experience. By accepting, you agree to our use of cookies.</p>
        <button id="accept-cookies" class="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-500 transition">Accept</button>
      </div>
    </div>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/ScrollTrigger.min.js"></script>
    <script src="scripts/main.js"></script>
</body>
</html>
`;

// Оновлено: шаблон для ігрової сторінки
export const getGamePageTemplate = (title: string, gamePageTitle: string, gameIframePath: string, disclaimerHtml: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${gamePageTitle} - ${title}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Space+Grotesk:wght@400;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" />
    <link rel="stylesheet" href="styles/style.css">
</head>
<body class="bg-slate-900 text-gray-200 font-sans flex flex-col min-h-screen">
    


    <main class="flex-grow flex flex-col items-center justify-center p-4">
        <h1 class="text-3xl md:text-5xl font-bold text-center text-white mb-6">${gamePageTitle}</h1>
        <div class="w-full max-w-5xl aspect-video bg-black rounded-lg shadow-2xl overflow-hidden border-2 border-slate-700">
            <iframe src="${gameIframePath}" frameborder="0" class="w-full h-full"></iframe>
        </div>
        <div class="mt-8 w-full max-w-5xl">
            ${disclaimerHtml}
        </div>
    </main>

  
    <div id="cookie-banner" class="fixed bottom-0 left-0 right-0 bg-slate-800/90 backdrop-blur-sm p-4 z-50 transform translate-y-full transition-transform duration-300 ease-in-out">
      <div class="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <p class="text-sm text-gray-300">We use cookies to enhance your experience. By accepting, you agree to our use of cookies.</p>
        <button id="accept-cookies" class="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-500 transition">Accept</button>
      </div>
    </div>
    <script src="scripts/main.js"></script>
</body>
</html>
`;

// Оновлено: шаблон для сторінки політики
export const getPrivacyPolicyTemplate = (title: string, domain: string, policyContentHtml: string) => {
  const contactEmail = `contact@${domain}`;
  const menuItems = Array.from(policyContentHtml.matchAll(/<h2 id="([^"]+)"[^>]*>(.*?)<\/h2>/g))
    .map(match => ({ id: match[1], title: match[2] }));

  return `
<!DOCTYPE html>
<html lang="en" class="scroll-smooth">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Privacy Policy - ${title}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="styles/style.css">
</head>
<body class="bg-slate-900 text-gray-300 font-sans">
    
    

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-12">
            <main class="md:col-span-3 prose prose-invert lg:prose-lg max-w-none">
                <h1 class="text-4xl sm:text-5xl font-extrabold text-white !mb-8">Privacy Policy</h1>
                ${policyContentHtml}
                <section id="contact-us">
                  <h2 id="contact" class="text-3xl font-bold text-white !mt-12 !mb-4">Contact Us</h2>
                  <p>If you have any questions about this Privacy Policy, please contact us at: 
                  <a href="mailto:${contactEmail}" class="text-indigo-400 font-semibold hover:underline">${contactEmail}</a></p>
                </section>
            </main>
            <aside class="md:col-span-1">
                <div class="sticky top-24">
                    <h3 class="font-bold text-white mb-4">On this page</h3>
                    <nav id="policy-nav">
                        <ul class="space-y-2">
                            ${menuItems.map(item => `<li><a href="#${item.id}" class="block text-gray-400 hover:text-indigo-400 transition-colors duration-200" data-nav-link="${item.id}">${item.title}</a></li>`).join('\n')}
                            <li><a href="#contact" class="block text-gray-400 hover:text-indigo-400 transition-colors duration-200" data-nav-link="contact">Contact Us</a></li>
                        </ul>
                    </nav>
                </div>
            </aside>
        </div>
    </div>
    
    
    <div id="cookie-banner" class="fixed bottom-0 left-0 right-0 bg-slate-800/90 backdrop-blur-sm p-4 z-50 transform translate-y-full transition-transform duration-300 ease-in-out">
      <div class="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <p class="text-sm text-gray-300">We use cookies to enhance your experience. By accepting, you agree to our use of cookies.</p>
        <button id="accept-cookies" class="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-500 transition">Accept</button>
      </div>
    </div>
    <script src="scripts/main.js"></script>
</body>
</html>`;
};

// ... (mainJsTemplate та stylesCssTemplate залишаються без змін) ...
export const mainJsTemplate = `
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
            cookieBanner.style.pointerEvents = 'none';
            setTimeout(() => { cookieBanner.style.display = 'none'; }, 400);
        };
        if (!localStorage.getItem(cookieName)) {
            setTimeout(() => {
                cookieBanner.style.transform = 'translateY(0)';
            }, 500);
        } else {
            hideBanner();
        }
        acceptCookiesBtn.addEventListener('click', () => {
            localStorage.setItem(cookieName, 'true');
            hideBanner();
        }, { once: true });
    }

    // --- Smooth Scroll for Anchor Links ---
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href.length > 1) {
                e.preventDefault();
                const targetElement = document.querySelector(href);
                if (targetElement) {
                    targetElement.scrollIntoView({ behavior: 'smooth' });
                }
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
    
    // --- Logic for Policy Page Navigation ---
    const policyNav = document.getElementById('policy-nav');
    if (policyNav) {
        const navLinks = policyNav.querySelectorAll('a[data-nav-link]');
        const sections = Array.from(navLinks).map(link => {
            const id = link.getAttribute('data-nav-link');
            return document.getElementById(id);
        }).filter(Boolean);
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.getAttribute('id');
                    const navLink = policyNav.querySelector(\`a[data-nav-link="\${id}"]\`);
                    navLinks.forEach(link => link.classList.remove('text-indigo-400', 'font-bold'));
                    if (navLink) {
                        navLink.classList.add('text-indigo-400', 'font-bold');
                    }
                }
            });
        }, { rootMargin: '-40% 0px -60% 0px', threshold: 0 });
        sections.forEach(section => {
            if (section) observer.observe(section);
        });
    }
});
`;

export const stylesCssTemplate = `
body.overflow-hidden { overflow: hidden; }
.mobile-nav-hidden {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100vh;
    background-color: rgba(15, 23, 42, 0.98);
    backdrop-filter: blur(8px);
    z-index: 30;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease-in-out;
}
.mobile-nav-visible { opacity: 1; pointer-events: auto; }
`;
