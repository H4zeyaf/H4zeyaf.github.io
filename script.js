/**
 * AI.DEV Portfolio - Main JavaScript
 * Optimized for performance, accessibility, and maintainability
 */

// ============================================================================
// Configuration
// ============================================================================
const CONFIG = {
    animation: {
        typewriterSpeed: { min: 80, max: 150 },
        typewriterPause: 3000,
        carouselSpeed: 0.015,
        carouselTransitionDuration: 800,
        skillCardStagger: 80,
        decryptIterations: 12,
        decryptInterval: 40
    },
    selectors: {
        carouselTrack: '.carousel-track',
        carouselCards: '.carousel-card',
        projectItems: '.project-item',
        tabButtons: '.tab-btn',
        tabPanels: '.tab-panel',
        skillCards: '.skill-card',
        mobileMenu: '#mobile-menu',
        menuToggle: '.menu-toggle'
    }
};

// ============================================================================
// Utility Functions
// ============================================================================
const Utils = {
    /**
     * Throttle function execution
     */
    throttle(callback, limit) {
        let ticking = false;
        return function(...args) {
            if (!ticking) {
                requestAnimationFrame(() => {
                    callback.apply(this, args);
                    ticking = false;
                });
                ticking = true;
            }
        };
    },

    /**
     * Easing function for smooth transitions
     */
    easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    },

    /**
     * Check if user prefers reduced motion
     */
    prefersReducedMotion() {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    },

    /**
     * Safely query DOM elements
     */
    $(selector, context = document) {
        return context.querySelector(selector);
    },

    /**
     * Safely query all DOM elements
     */
    $$(selector, context = document) {
        return Array.from(context.querySelectorAll(selector));
    }
};

// ============================================================================
// Component: Decryption Tooltip
// ============================================================================
class DecryptTooltip {
    constructor() {
        this.tooltip = null;
        this.activeTarget = null;
        this.chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        this.init();
    }

    init() {
        // Create tooltip element
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'decrypt-tooltip';
        this.tooltip.setAttribute('role', 'tooltip');
        document.body.appendChild(this.tooltip);

        // Attach event listeners
        const targets = Utils.$$('.nav-link[data-tooltip]');
        targets.forEach(target => {
            target.addEventListener('mouseenter', (e) => this.show(e.target));
            target.addEventListener('mouseleave', () => this.hide());
            target.addEventListener('mousemove', (e) => this.move(e));
            target.addEventListener('focus', (e) => this.show(e.target));
            target.addEventListener('blur', () => this.hide());
        });
    }

    show(target) {
        const text = target.dataset.tooltip;
        this.activeTarget = target;
        this.tooltip.classList.add('visible');
        this.decrypt(text);
    }

    hide() {
        this.tooltip.classList.remove('visible');
        this.activeTarget = null;
    }

    move(event) {
        if (!this.activeTarget) return;
        const x = event.clientX + 15;
        const y = event.clientY + 25;
        this.tooltip.style.left = `${x}px`;
        this.tooltip.style.top = `${y}px`;
    }

    decrypt(finalText) {
        if (Utils.prefersReducedMotion()) {
            this.tooltip.textContent = finalText;
            return;
        }

        let iteration = 0;
        const maxIterations = CONFIG.animation.decryptIterations;
        const interval = CONFIG.animation.decryptInterval;

        const decryptInterval = setInterval(() => {
            if (!this.activeTarget) {
                clearInterval(decryptInterval);
                return;
            }

            this.tooltip.textContent = finalText
                .split('')
                .map((char, index) => {
                    if (char === ' ') return ' ';
                    if (index < iteration) return finalText[index];
                    return this.chars[Math.floor(Math.random() * this.chars.length)];
                })
                .join('');

            if (iteration >= finalText.length) {
                clearInterval(decryptInterval);
                this.tooltip.textContent = finalText;
            }

            iteration += 0.5;
        }, interval);
    }
}

// ============================================================================
// Component: Typewriter Effect
// ============================================================================
class Typewriter {
    constructor() {
        this.element = Utils.$('.typewriter');
        this.text = "Creative Technologist";
        this.index = 0;
        this.isWaiting = false;
        
        if (this.element) {
            this.init();
        }
    }

    init() {
        // Accessibility: Update aria-label after typing completes
        setTimeout(() => this.type(), 800);
    }

    type() {
        if (this.isWaiting) return;

        const currentText = this.text.substring(0, this.index);
        this.element.textContent = currentText;

        if (this.index < this.text.length) {
            this.index++;
            const speed = CONFIG.animation.typewriterSpeed.min + 
                Math.random() * (CONFIG.animation.typewriterSpeed.max - CONFIG.animation.typewriterSpeed.min);
            setTimeout(() => this.type(), speed);
        } else {
            this.isWaiting = true;
            setTimeout(() => {
                this.isWaiting = false;
            }, CONFIG.animation.typewriterPause);
        }
    }
}

// ============================================================================
// Component: 3D Carousel
// ============================================================================
class Carousel3D {
    constructor() {
        this.track = Utils.$(CONFIG.selectors.carouselTrack);
        this.cards = Utils.$$(CONFIG.selectors.carouselCards);
        this.projectItems = Utils.$$(CONFIG.selectors.projectItems);
        this.indicators = Utils.$$('.indicator');
        this.prevBtn = Utils.$('.carousel-btn.prev');
        this.nextBtn = Utils.$('.carousel-btn.next');
        
        if (!this.track || this.cards.length === 0) return;

        this.currentRotation = 0;
        this.isPaused = false;
        this.isTransitioning = false;
        this.transitionQueue = null;
        this.lastTime = 0;
        this.cardCount = this.cards.length;
        this.anglePerCard = 360 / this.cardCount;
        this.radius = window.innerWidth <= 768 ? 280 : 420;

        this.init();
    }

    init() {
        this.positionCards();
        this.attachEventListeners();
        requestAnimationFrame((t) => this.animate(t));
        this.updateActiveProject();
    }

    positionCards() {
        this.cards.forEach((card, index) => {
            const angle = index * this.anglePerCard;
            card.style.setProperty('--rotation', `${angle}deg`);
            card.style.transform = `rotateY(${angle}deg) translateZ(${this.radius}px)`;
            card.dataset.angle = angle;
            card.dataset.index = index;
        });
    }

    attachEventListeners() {
        // Pause on hover
        this.track.addEventListener('mouseenter', () => {
            this.isPaused = true;
        });

        this.track.addEventListener('mouseleave', () => {
            this.isPaused = false;
            this.lastTime = 0;
        });

        // Click on cards
        this.cards.forEach((card, index) => {
            card.addEventListener('click', () => this.rotateTo(index));
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.rotateTo(index);
                }
            });
        });

        // Click on project items
        this.projectItems.forEach((item, index) => {
            item.addEventListener('click', () => this.rotateTo(index));
            item.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.rotateTo(index);
                }
            });
        });

        // Control buttons
        if (this.prevBtn) {
            this.prevBtn.addEventListener('click', () => this.rotatePrev());
        }
        if (this.nextBtn) {
            this.nextBtn.addEventListener('click', () => this.rotateNext());
        }

        // Indicators
        this.indicators.forEach((indicator, index) => {
            indicator.addEventListener('click', () => this.rotateTo(index));
        });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') this.rotatePrev();
            if (e.key === 'ArrowRight') this.rotateNext();
        });
    }

    animate(currentTime) {
        if (!this.lastTime) this.lastTime = currentTime;
        const deltaTime = currentTime - this.lastTime;

        if (!this.isPaused && !Utils.prefersReducedMotion()) {
            const rotationSpeed = CONFIG.animation.carouselSpeed;
            this.currentRotation -= rotationSpeed * deltaTime;
            this.currentRotation = this.currentRotation % 360;
            this.track.style.transform = `rotateY(${this.currentRotation}deg)`;
            this.updateActiveProject();
            this.applyCurvature();
        }

        this.lastTime = currentTime;
        requestAnimationFrame((t) => this.animate(t));
    }

    applyCurvature() {
        this.cards.forEach((card) => {
            const cardAngle = (parseFloat(card.dataset.angle) + this.currentRotation) % 360;
            const normalizedAngle = cardAngle < 0 ? cardAngle + 360 : cardAngle;

            let distanceFromFront = Math.abs(normalizedAngle);
            if (distanceFromFront > 180) {
                distanceFromFront = 360 - distanceFromFront;
            }

            const scale = 1 - (distanceFromFront / 360) * 0.3;
            const opacity = 1 - (distanceFromFront / 180) * 0.6;

            card.style.opacity = Math.max(0.3, opacity);

            const tilt = (normalizedAngle > 180 ? normalizedAngle - 360 : normalizedAngle) * 0.05;
            const inner = card.querySelector('.card-inner');
            if (inner) {
                inner.style.transform = `scale(${scale}) perspective(1000px) rotateY(${tilt * -0.5}deg)`;
            }
        });
    }

    updateActiveProject() {
        let closestIndex = 0;
        let closestDistance = Infinity;

        this.cards.forEach((card, index) => {
            const cardAngle = (parseFloat(card.dataset.angle) + this.currentRotation) % 360;
            const normalizedAngle = cardAngle < 0 ? cardAngle + 360 : cardAngle;

            let distance = Math.abs(normalizedAngle);
            if (distance > 180) distance = 360 - distance;

            if (distance < closestDistance) {
                closestDistance = distance;
                closestIndex = index;
            }
        });

        this.setActiveIndex(closestIndex);
    }

    setActiveIndex(index) {
        this.projectItems.forEach((item, i) => {
            const isActive = i === index;
            item.classList.toggle('active', isActive);
            item.setAttribute('aria-selected', isActive);
        });

        this.indicators.forEach((indicator, i) => {
            const isActive = i === index;
            indicator.classList.toggle('active', isActive);
            indicator.setAttribute('aria-selected', isActive);
        });
    }

    rotateTo(index) {
        // If already transitioning, queue the next target
        if (this.isTransitioning) {
            this.transitionQueue = index;
            return;
        }
        
        const targetAngle = -index * this.anglePerCard;
        this.isTransitioning = true;
        this.smoothTransition(targetAngle, () => {
            this.setActiveIndex(index);
            this.isTransitioning = false;
            
            // Process queued transition if any
            if (this.transitionQueue !== null) {
                const queuedIndex = this.transitionQueue;
                this.transitionQueue = null;
                setTimeout(() => this.rotateTo(queuedIndex), 50);
            }
        });
    }

    rotatePrev() {
        const currentIndex = this.getCurrentIndex();
        const newIndex = (currentIndex - 1 + this.cardCount) % this.cardCount;
        this.rotateTo(newIndex);
    }

    rotateNext() {
        const currentIndex = this.getCurrentIndex();
        const newIndex = (currentIndex + 1) % this.cardCount;
        this.rotateTo(newIndex);
    }

    getCurrentIndex() {
        let closestIndex = 0;
        let closestDistance = Infinity;

        this.cards.forEach((card, index) => {
            const cardAngle = (parseFloat(card.dataset.angle) + this.currentRotation) % 360;
            const normalizedAngle = cardAngle < 0 ? cardAngle + 360 : cardAngle;

            let distance = Math.abs(normalizedAngle);
            if (distance > 180) distance = 360 - distance;

            if (distance < closestDistance) {
                closestDistance = distance;
                closestIndex = index;
            }
        });

        return closestIndex;
    }

    smoothTransition(targetAngle, onComplete) {
        this.isPaused = true;
        const startRotation = this.currentRotation;
        
        // Find shortest rotation direction
        let diff = targetAngle - startRotation;
        while (diff > 180) diff -= 360;
        while (diff < -180) diff += 360;
        
        const duration = CONFIG.animation.carouselTransitionDuration;
        const startTime = performance.now();

        const transition = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeProgress = Utils.easeOutCubic(progress);

            this.currentRotation = startRotation + diff * easeProgress;
            this.track.style.transform = `rotateY(${this.currentRotation}deg)`;
            this.applyCurvature();
            this.updateActiveProject();

            if (progress < 1) {
                requestAnimationFrame(transition);
            } else {
                this.isPaused = false;
                this.lastTime = 0;
                if (onComplete) onComplete();
            }
        };

        requestAnimationFrame(transition);
    }
}

// ============================================================================
// Component: Tabs
// ============================================================================
class Tabs {
    constructor() {
        this.buttons = Utils.$$(CONFIG.selectors.tabButtons);
        this.panels = Utils.$$(CONFIG.selectors.tabPanels);
        
        if (this.buttons.length === 0) return;

        this.init();
    }

    init() {
        this.buttons.forEach(button => {
            button.addEventListener('click', () => this.switchTab(button));
            button.addEventListener('keydown', (e) => this.handleKeydown(e));
        });
    }

    switchTab(activeButton) {
        const targetTab = activeButton.dataset.tab;

        // Update button states
        this.buttons.forEach(btn => {
            const isActive = btn === activeButton;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-selected', isActive);
        });

        // Update panel visibility with animation
        const currentPanel = Utils.$('.tab-panel.active');
        const targetPanel = Utils.$(`[data-panel="${targetTab}"]`);

        if (currentPanel && currentPanel !== targetPanel) {
            currentPanel.style.animation = 'fadeOut 0.3s ease forwards';

            setTimeout(() => {
                currentPanel.classList.remove('active');
                currentPanel.hidden = true;
                
                targetPanel.classList.add('active');
                targetPanel.hidden = false;
                targetPanel.style.animation = 'fadeIn 0.5s ease forwards';
            }, 300);
        } else if (targetPanel) {
            targetPanel.classList.add('active');
            targetPanel.hidden = false;
        }
    }

    handleKeydown(event) {
        const currentIndex = this.buttons.indexOf(event.target);
        let newIndex;

        switch (event.key) {
            case 'ArrowLeft':
                newIndex = (currentIndex - 1 + this.buttons.length) % this.buttons.length;
                break;
            case 'ArrowRight':
                newIndex = (currentIndex + 1) % this.buttons.length;
                break;
            case 'Home':
                newIndex = 0;
                break;
            case 'End':
                newIndex = this.buttons.length - 1;
                break;
            default:
                return;
        }

        event.preventDefault();
        this.buttons[newIndex].focus();
        this.switchTab(this.buttons[newIndex]);
    }
}

// ============================================================================
// Component: Skill Cards
// ============================================================================
class SkillCards {
    constructor() {
        this.cards = Utils.$$(CONFIG.selectors.skillCards);
        
        if (this.cards.length === 0) return;

        this.init();
    }

    init() {
        this.cards.forEach((card, index) => {
            // Initial animation
            card.style.opacity = '0';
            card.style.transform = 'translateY(40px) rotateX(20deg)';

            setTimeout(() => {
                card.style.transition = `all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)`;
                card.style.opacity = '1';
                card.style.transform = 'translateY(0) rotateX(0)';
            }, index * CONFIG.animation.skillCardStagger);

            // Hover effects
            card.addEventListener('mouseenter', () => this.onHover(card));
            card.addEventListener('mouseleave', () => this.onLeave(card));
            card.addEventListener('focus', () => this.onHover(card));
            card.addEventListener('blur', () => this.onLeave(card));
        });
    }

    onHover(card) {
        if (Utils.prefersReducedMotion()) return;
        const randomRotation = (Math.random() - 0.5) * 10;
        card.style.transform = `perspective(500px) rotateX(10deg) rotateY(${-10 + randomRotation}deg) scale(1.1)`;
    }

    onLeave(card) {
        card.style.transform = 'perspective(500px) rotateX(0) rotateY(0) scale(1)';
    }
}

// ============================================================================
// Component: Skills Category Mobile
// Mobile-only category filter for skills
// ============================================================================
class SkillsCategoryMobile {
    constructor() {
        this.categoryButtons = Utils.$$('.skill-category-btn');
        this.skillCards = Utils.$$('.skill-card');
        
        if (this.categoryButtons.length === 0 || this.skillCards.length === 0) return;
        
        // Only initialize on mobile (check if category buttons are visible)
        this.isMobile = window.innerWidth <= 768;
        
        this.init();
        
        // Handle resize to switch between mobile/desktop modes
        window.addEventListener('resize', Utils.throttle(() => {
            const nowMobile = window.innerWidth <= 768;
            if (nowMobile !== this.isMobile) {
                this.isMobile = nowMobile;
                if (this.isMobile) {
                    this.filterSkills('frontend');
                } else {
                    this.showAllSkills();
                }
            }
        }, 200));
    }
    
    init() {
        if (this.isMobile) {
            // Show only frontend skills by default on mobile
            this.filterSkills('frontend');
        }
        
        this.categoryButtons.forEach(btn => {
            btn.addEventListener('click', () => this.onCategoryClick(btn));
        });
    }
    
    onCategoryClick(button) {
        const category = button.dataset.category;
        
        // Update active button
        this.categoryButtons.forEach(btn => {
            btn.classList.remove('active');
            btn.setAttribute('aria-selected', 'false');
        });
        button.classList.add('active');
        button.setAttribute('aria-selected', 'true');
        
        // Filter skills with animation
        this.filterSkills(category);
    }
    
    filterSkills(category) {
        this.skillCards.forEach(card => {
            const cardCategory = card.dataset.category;
            
            if (cardCategory === category) {
                card.classList.add('active');
                // Animate in
                card.style.opacity = '0';
                card.style.transform = 'translateY(20px) scale(0.9)';
                
                setTimeout(() => {
                    card.style.transition = 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
                    card.style.opacity = '1';
                    card.style.transform = 'translateY(0) scale(1)';
                }, 50);
            } else {
                card.classList.remove('active');
                card.style.opacity = '0';
                card.style.transform = 'translateY(20px) scale(0.9)';
            }
        });
    }
    
    showAllSkills() {
        this.skillCards.forEach((card, index) => {
            card.classList.remove('active');
            card.style.opacity = '0';
            card.style.transform = 'translateY(40px) rotateX(20deg)';
            
            setTimeout(() => {
                card.style.transition = `all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)`;
                card.style.opacity = '1';
                card.style.transform = 'translateY(0) rotateX(0)';
            }, index * 80);
        });
    }
}

// ============================================================================
// Component: Mobile Menu
// ============================================================================
class MobileMenu {
    constructor() {
        this.toggle = Utils.$(CONFIG.selectors.menuToggle);
        this.menu = Utils.$(CONFIG.selectors.mobileMenu);
        
        if (!this.toggle || !this.menu) return;

        this.init();
    }

    init() {
        this.toggle.addEventListener('click', () => this.toggleMenu());
        
        // Close menu on link click
        const links = Utils.$$('.mobile-nav-link', this.menu);
        links.forEach(link => {
            link.addEventListener('click', () => this.close());
        });

        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen()) {
                this.close();
            }
        });

        // Close on click outside
        this.menu.addEventListener('click', (e) => {
            if (e.target === this.menu) {
                this.close();
            }
        });
    }

    isOpen() {
        return this.toggle.getAttribute('aria-expanded') === 'true';
    }

    toggleMenu() {
        if (this.isOpen()) {
            this.close();
        } else {
            this.open();
        }
    }

    open() {
        this.toggle.setAttribute('aria-expanded', 'true');
        this.menu.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        
        // Focus first link
        const firstLink = Utils.$('.mobile-nav-link', this.menu);
        if (firstLink) firstLink.focus();
    }

    close() {
        this.toggle.setAttribute('aria-expanded', 'false');
        this.menu.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        this.toggle.focus();
    }
}

// ============================================================================
// Component: Smooth Scroll
// ============================================================================
class SmoothScroll {
    constructor() {
        this.init();
    }

    init() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', (e) => this.handleClick(e));
        });
    }

    handleClick(event) {
        const href = event.currentTarget.getAttribute('href');
        if (href === '#') return;

        const target = document.querySelector(href);
        if (target) {
            event.preventDefault();
            const offset = 80;
            const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - offset;

            window.scrollTo({
                top: targetPosition,
                behavior: Utils.prefersReducedMotion() ? 'auto' : 'smooth'
            });
        }
    }
}

// ============================================================================
// Component: Navbar Scroll Effect
// ============================================================================
class NavbarScroll {
    constructor() {
        this.navbar = Utils.$('.navbar');
        if (!this.navbar) return;

        this.init();
    }

    init() {
        window.addEventListener('scroll', Utils.throttle(() => {
            const currentScroll = window.pageYOffset;
            
            if (currentScroll > 50) {
                this.navbar.style.background = 'rgba(0, 0, 0, 0.95)';
                this.navbar.style.backdropFilter = 'blur(20px)';
                this.navbar.style.webkitBackdropFilter = 'blur(20px)';
            } else {
                this.navbar.style.background = 'linear-gradient(to bottom, rgba(0,0,0,0.9), transparent)';
                this.navbar.style.backdropFilter = 'blur(10px)';
                this.navbar.style.webkitBackdropFilter = 'blur(10px)';
            }
        }, 100));
    }
}

// ============================================================================
// Component: Glow Effect
// ============================================================================
class GlowEffect {
    constructor() {
        this.heroLeft = Utils.$('.hero-left');
        this.glow = Utils.$('.glow-effect');
        
        if (!this.heroLeft || !this.glow || Utils.prefersReducedMotion()) return;

        this.mouseX = 0;
        this.mouseY = 0;
        this.currentX = 0;
        this.currentY = 0;
        this.isHovering = false;
        this.requestId = null;

        this.init();
    }

    init() {
        this.heroLeft.addEventListener('mouseenter', () => {
            this.isHovering = true;
            if (!this.requestId) {
                this.animate();
            }
        });

        this.heroLeft.addEventListener('mouseleave', () => {
            this.isHovering = false;
        });

        this.heroLeft.addEventListener('mousemove', (e) => {
            const rect = this.heroLeft.getBoundingClientRect();
            this.mouseX = ((e.clientX - rect.left) / rect.width - 0.5) * 60;
            this.mouseY = ((e.clientY - rect.top) / rect.height - 0.5) * 60;
        });
    }

    animate() {
        this.currentX += (this.mouseX - this.currentX) * 0.1;
        this.currentY += (this.mouseY - this.currentY) * 0.1;

        this.glow.style.transform = `translate(${this.currentX}px, ${this.currentY}px)`;

        if (this.isHovering || Math.abs(this.mouseX - this.currentX) > 0.1) {
            this.requestId = requestAnimationFrame(() => this.animate());
        } else {
            this.requestId = null;
        }
    }
}

// ============================================================================
// Component: Parallax Effect
// ============================================================================
class ParallaxEffect {
    constructor() {
        this.megaText = Utils.$('.mega-text');
        this.heroDescription = Utils.$('.hero-description');
        
        if (Utils.prefersReducedMotion()) return;

        this.init();
    }

    init() {
        window.addEventListener('scroll', Utils.throttle(() => {
            const scrolled = window.pageYOffset;
            
            if (this.megaText) {
                this.megaText.style.transform = `translateY(${scrolled * 0.4}px)`;
            }
            
            if (this.heroDescription) {
                this.heroDescription.style.transform = `translateY(${scrolled * 0.1}px)`;
            }
        }, 50));
    }
}

// ============================================================================
// Component: Scroll Animations (Intersection Observer)
// ============================================================================
class ScrollAnimations {
    constructor() {
        this.options = {
            root: null,
            rootMargin: '0px',
            threshold: 0.1
        };

        this.init();
    }

    init() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-in');
                    observer.unobserve(entry.target);
                }
            });
        }, this.options);

        document.querySelectorAll('.project-item, .about-heading, .footer-column')
            .forEach(el => observer.observe(el));
    }
}

// ============================================================================
// Component: Image Preloader
// ============================================================================
class ImagePreloader {
    constructor() {
        this.init();
    }

    init() {
        // Use requestIdleCallback for non-critical preloading
        const preload = () => {
            const images = document.querySelectorAll('.carousel-card img');
            images.forEach(img => {
                const src = img.getAttribute('src');
                if (src) {
                    const preloadImg = new Image();
                    preloadImg.src = src;
                }
            });
        };

        if ('requestIdleCallback' in window) {
            requestIdleCallback(preload);
        } else {
            setTimeout(preload, 1000);
        }
    }
}

// ============================================================================
// Component: Marquee Animation Control
// ============================================================================
class MarqueeController {
    constructor() {
        this.track = Utils.$('.marquee-track');
        if (!this.track) return;

        this.init();
    }

    init() {
        // Set consistent animation speed
        this.track.style.animationDuration = '25s';
        
        // Pause on hover (optional accessibility feature)
        this.track.addEventListener('mouseenter', () => {
            this.track.style.animationPlayState = 'paused';
        });
        
        this.track.addEventListener('mouseleave', () => {
            this.track.style.animationPlayState = 'running';
        });
    }
}

// ============================================================================
// Add CSS Animations Dynamically
// ============================================================================
function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeOut {
            from { opacity: 1; transform: translateY(0); }
            to { opacity: 0; transform: translateY(-10px); }
        }
    `;
    document.head.appendChild(style);
}

// ============================================================================
// Initialize Application
// ============================================================================
function initApp() {
    injectStyles();

    // Initialize components
    new DecryptTooltip();
    new Typewriter();
    new Carousel3D();
    new Tabs();
    new SkillCards();
    new SkillsCategoryMobile();
    new MobileMenu();
    new SmoothScroll();
    new NavbarScroll();
    new GlowEffect();
    new ParallaxEffect();
    new ScrollAnimations();
    new ImagePreloader();
    new MarqueeController();
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// Handle visibility change to pause animations when tab is hidden
document.addEventListener('visibilitychange', () => {
    document.body.classList.toggle('tab-inactive', document.hidden);
});
