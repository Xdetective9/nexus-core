// NEXUSCORE ANIMATION ENGINE

class AnimationEngine {
    constructor() {
        this.animations = new Map();
        this.particles = [];
        this.isAnimating = false;
        this.init();
    }

    init() {
        // Initialize Intersection Observer for scroll animations
        this.initScrollObserver();
        
        // Initialize hover effects
        this.initHoverEffects();
        
        // Initialize parallax
        this.initParallax();
        
        // Initialize typing effects
        this.initTypingEffects();
        
        // Start animation loop
        this.startAnimationLoop();
        
        console.log('🎬 Animation Engine initialized');
    }

    // Scroll Animations
    initScrollObserver() {
        const observerOptions = {
            root: null,
            rootMargin: '0px',
            threshold: 0.1
        };

        this.scrollObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.animateOnScroll(entry.target);
                }
            });
        }, observerOptions);

        // Observe all elements with animation classes
        document.querySelectorAll('[data-animate]').forEach(el => {
            this.scrollObserver.observe(el);
        });
    }

    animateOnScroll(element) {
        const animationType = element.dataset.animate;
        const delay = element.dataset.delay || 0;
        const duration = element.dataset.duration || 800;

        setTimeout(() => {
            element.classList.add('animate-' + animationType);
            
            // Add event listener for animation end
            element.addEventListener('animationend', () => {
                element.classList.remove('animate-' + animationType);
                element.classList.add('animated');
            }, { once: true });
        }, delay);
    }

    // Hover Effects
    initHoverEffects() {
        // Card hover effects
        document.querySelectorAll('.hover-card').forEach(card => {
            card.addEventListener('mouseenter', (e) => this.cardHoverEnter(e, card));
            card.addEventListener('mouseleave', (e) => this.cardHoverLeave(e, card));
        });

        // Button hover effects
        document.querySelectorAll('.btn').forEach(btn => {
            btn.addEventListener('mouseenter', (e) => this.buttonHoverEnter(e, btn));
            btn.addEventListener('mouseleave', (e) => this.buttonHoverLeave(e, btn));
        });

        // Link hover effects
        document.querySelectorAll('a').forEach(link => {
            link.addEventListener('mouseenter', (e) => this.linkHoverEnter(e, link));
            link.addEventListener('mouseleave', (e) => this.linkHoverLeave(e, link));
        });
    }

    cardHoverEnter(event, card) {
        card.classList.add('hover-active');
        
        // Add floating effect
        card.style.transform = 'translateY(-10px)';
        card.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.3)';
        
        // Add shine effect
        const shine = document.createElement('div');
        shine.className = 'card-shine';
        card.appendChild(shine);
        
        // Remove shine after animation
        setTimeout(() => shine.remove(), 600);
    }

    cardHoverLeave(event, card) {
        card.classList.remove('hover-active');
        card.style.transform = '';
        card.style.boxShadow = '';
    }

    buttonHoverEnter(event, button) {
        const rect = button.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // Create ripple effect
        const ripple = document.createElement('span');
        ripple.className = 'ripple-effect';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        
        button.appendChild(ripple);
        
        // Remove ripple after animation
        setTimeout(() => ripple.remove(), 600);
        
        // Add scale effect
        button.style.transform = 'scale(1.05)';
    }

    buttonHoverLeave(event, button) {
        button.style.transform = '';
    }

    linkHoverEnter(event, link) {
        // Add underline animation
        const underline = document.createElement('span');
        underline.className = 'link-underline';
        link.appendChild(underline);
        
        // Animate underline
        setTimeout(() => underline.classList.add('active'), 10);
    }

    linkHoverLeave(event, link) {
        const underline = link.querySelector('.link-underline');
        if (underline) {
            underline.classList.remove('active');
            setTimeout(() => underline.remove(), 300);
        }
    }

    // Parallax Effects
    initParallax() {
        const parallaxElements = document.querySelectorAll('[data-parallax]');
        
        if (parallaxElements.length === 0) return;
        
        window.addEventListener('scroll', () => {
            const scrolled = window.pageYOffset;
            
            parallaxElements.forEach(el => {
                const speed = parseFloat(el.dataset.parallaxSpeed) || 0.5;
                const yPos = -(scrolled * speed);
                
                if (el.dataset.parallaxAxis === 'x') {
                    el.style.transform = `translateX(${yPos}px)`;
                } else {
                    el.style.transform = `translateY(${yPos}px)`;
                }
            });
        });
    }

    // Typing Effects
    initTypingEffects() {
        document.querySelectorAll('[data-typing]').forEach(element => {
            const text = element.dataset.typing;
            const speed = parseInt(element.dataset.typingSpeed) || 50;
            const cursor = element.dataset.typingCursor !== 'false';
            
            this.typeText(element, text, speed, cursor);
        });
    }

    typeText(element, text, speed, cursor) {
        element.textContent = '';
        
        if (cursor) {
            const cursorSpan = document.createElement('span');
            cursorSpan.className = 'typing-cursor';
            cursorSpan.textContent = '|';
            element.appendChild(cursorSpan);
        }
        
        let i = 0;
        const type = () => {
            if (i < text.length) {
                const charSpan = document.createElement('span');
                charSpan.className = 'typing-char';
                charSpan.textContent = text.charAt(i);
                
                if (cursor) {
                    element.insertBefore(charSpan, element.querySelector('.typing-cursor'));
                } else {
                    element.appendChild(charSpan);
                }
                
                i++;
                setTimeout(type, speed + Math.random() * 50);
            } else if (cursor) {
                // Blink cursor at the end
                const cursorEl = element.querySelector('.typing-cursor');
                setInterval(() => {
                    cursorEl.style.opacity = cursorEl.style.opacity === '0' ? '1' : '0';
                }, 500);
            }
        };
        
        type();
    }

    // Particle System
    createParticles(count = 50, element = document.body) {
        const colors = ['#6366f1', '#8b5cf6', '#10b981', '#0ea5e9'];
        
        for (let i = 0; i < count; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            
            // Random properties
            const size = Math.random() * 5 + 2;
            const color = colors[Math.floor(Math.random() * colors.length)];
            const duration = Math.random() * 10 + 10;
            const delay = Math.random() * 5;
            
            // Set styles
            particle.style.width = `${size}px`;
            particle.style.height = `${size}px`;
            particle.style.background = color;
            particle.style.borderRadius = '50%';
            particle.style.position = 'absolute';
            particle.style.pointerEvents = 'none';
            
            // Random position
            const x = Math.random() * window.innerWidth;
            const y = Math.random() * window.innerHeight;
            
            particle.style.left = `${x}px`;
            particle.style.top = `${y}px`;
            
            // Add to DOM
            element.appendChild(particle);
            
            // Store particle
            this.particles.push({
                element: particle,
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 2,
                vy: (Math.random() - 0.5) * 2,
                size: size,
                color: color
            });
        }
    }

    updateParticles() {
        this.particles.forEach(particle => {
            // Update position
            particle.x += particle.vx;
            particle.y += particle.vy;
            
            // Bounce off walls
            if (particle.x <= 0 || particle.x >= window.innerWidth) {
                particle.vx *= -1;
            }
            if (particle.y <= 0 || particle.y >= window.innerHeight) {
                particle.vy *= -1;
            }
            
            // Apply position
            particle.element.style.left = `${particle.x}px`;
            particle.element.style.top = `${particle.y}px`;
            
            // Add floating effect
            particle.y += Math.sin(Date.now() / 1000 + particle.x) * 0.5;
        });
    }

    // Animation Loop
    startAnimationLoop() {
        if (this.isAnimating) return;
        
        this.isAnimating = true;
        
        const animate = () => {
            // Update particles
            if (this.particles.length > 0) {
                this.updateParticles();
            }
            
            // Continue loop
            requestAnimationFrame(animate);
        };
        
        animate();
    }

    // Progress Bars
    animateProgressBars() {
        document.querySelectorAll('.progress-bar').forEach(bar => {
            const targetWidth = bar.style.width || bar.dataset.width || '0%';
            bar.style.width = '0%';
            
            setTimeout(() => {
                bar.style.width = targetWidth;
            }, 300);
        });
    }

    // Counter Animation
    animateCounter(element, target, duration = 2000) {
        const start = parseInt(element.textContent) || 0;
        const increment = target / (duration / 16); // 60fps
        let current = start;
        
        const update = () => {
            current += increment;
            if (current >= target) {
                element.textContent = target.toLocaleString();
                return;
            }
            
            element.textContent = Math.floor(current).toLocaleString();
            requestAnimationFrame(update);
        };
        
        update();
    }

    // Morphing Shapes
    createMorphingShape(element) {
        let morph = 0;
        const points = [];
        
        for (let i = 0; i < 10; i++) {
            points.push({
                x: Math.cos((i / 10) * Math.PI * 2) * 50 + 50,
                y: Math.sin((i / 10) * Math.PI * 2) * 50 + 50
            });
        }
        
        const animate = () => {
            morph += 0.01;
            
            let path = 'M';
            points.forEach((point, i) => {
                const angle = (i / points.length) * Math.PI * 2 + morph;
                const x = point.x + Math.cos(angle) * 20;
                const y = point.y + Math.sin(angle) * 20;
                path += `${x},${y} `;
            });
            path += 'Z';
            
            element.setAttribute('d', path);
            requestAnimationFrame(animate);
        };
        
        animate();
    }

    // Wave Effect
    createWave(element) {
        const canvas = element;
        const ctx = canvas.getContext('2d');
        
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        
        const waves = [];
        for (let i = 0; i < 3; i++) {
            waves.push({
                y: canvas.height / 2,
                length: 0.01,
                amplitude: 50 + i * 20,
                frequency: 0.01 + i * 0.005
            });
        }
        
        let increment = 0;
        
        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            waves.forEach((wave, i) => {
                ctx.beginPath();
                ctx.moveTo(0, canvas.height / 2);
                
                for (let x = 0; x < canvas.width; x++) {
                    ctx.lineTo(
                        x,
                        wave.y + 
                        Math.sin(x * wave.length + increment) * 
                        wave.amplitude * 
                        Math.sin(increment * wave.frequency)
                    );
                }
                
                ctx.strokeStyle = `rgba(99, 102, 241, ${0.3 - i * 0.1})`;
                ctx.lineWidth = 2;
                ctx.stroke();
            });
            
            increment += 0.05;
            requestAnimationFrame(animate);
        };
        
        animate();
    }

    // Confetti Effect
    createConfetti(count = 150, duration = 3000) {
        const colors = ['#6366f1', '#8b5cf6', '#10b981', '#0ea5e9', '#f59e0b', '#ef4444'];
        const confetti = [];
        
        for (let i = 0; i < count; i++) {
            const piece = document.createElement('div');
            piece.className = 'confetti-piece';
            
            // Random properties
            const size = Math.random() * 10 + 5;
            const color = colors[Math.floor(Math.random() * colors.length)];
            const x = Math.random() * window.innerWidth;
            const y = -20;
            
            // Set styles
            piece.style.width = `${size}px`;
            piece.style.height = `${size}px`;
            piece.style.background = color;
            piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
            piece.style.position = 'fixed';
            piece.style.left = `${x}px`;
            piece.style.top = `${y}px`;
            piece.style.zIndex = '9999';
            piece.style.pointerEvents = 'none';
            piece.style.transform = `rotate(${Math.random() * 360}deg)`;
            
            document.body.appendChild(piece);
            
            confetti.push({
                element: piece,
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 10,
                vy: Math.random() * 5 + 5,
                rotation: Math.random() * 10,
                rotationSpeed: (Math.random() - 0.5) * 20
            });
        }
        
        // Animate confetti
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / duration;
            
            if (progress >= 1) {
                // Remove all confetti
                confetti.forEach(c => c.element.remove());
                return;
            }
            
            confetti.forEach(c => {
                // Update physics
                c.vy += 0.1; // Gravity
                c.x += c.vx;
                c.y += c.vy;
                c.rotation += c.rotationSpeed;
                
                // Apply transformations
                c.element.style.left = `${c.x}px`;
                c.element.style.top = `${c.y}px`;
                c.element.style.transform = `rotate(${c.rotation}deg)`;
                c.element.style.opacity = 1 - progress;
            });
            
            requestAnimationFrame(animate);
        };
        
        animate();
    }

    // Stagger Animation
    staggerAnimation(selector, animationClass, stagger = 100) {
        const elements = document.querySelectorAll(selector);
        
        elements.forEach((el, i) => {
            setTimeout(() => {
                el.classList.add(animationClass);
                
                el.addEventListener('animationend', () => {
                    el.classList.remove(animationClass);
                }, { once: true });
            }, i * stagger);
        });
    }

    // Page Transition
    async pageTransition(url, transitionClass = 'page-transition') {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = transitionClass;
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: var(--bg-darker);
            z-index: 9999;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        
        document.body.appendChild(overlay);
        
        // Fade in
        setTimeout(() => overlay.style.opacity = '1', 10);
        
        // Wait for animation
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Navigate
        window.location.href = url;
    }

    // Utility Methods
    pauseAllAnimations() {
        document.querySelectorAll('*').forEach(el => {
            if (el.style.animationPlayState !== 'paused') {
                el.style.animationPlayState = 'paused';
            }
        });
    }

    resumeAllAnimations() {
        document.querySelectorAll('*').forEach(el => {
            if (el.style.animationPlayState === 'paused') {
                el.style.animationPlayState = 'running';
            }
        });
    }

    stopAllAnimations() {
        document.querySelectorAll('*').forEach(el => {
            el.style.animation = 'none';
        });
    }
}

// Initialize Animation Engine
let animationEngine;

document.addEventListener('DOMContentLoaded', () => {
    animationEngine = new AnimationEngine();
    
    // Make it globally available
    window.AnimationEngine = animationEngine;
    
    // Auto-animate progress bars on page load
    setTimeout(() => {
        animationEngine.animateProgressBars();
    }, 1000);
    
    // Animate counters
    document.querySelectorAll('[data-counter]').forEach(el => {
        const target = parseInt(el.dataset.counter);
        if (!isNaN(target)) {
            animationEngine.animateCounter(el, target);
        }
    });
    
    // Initialize wave effects
    document.querySelectorAll('.wave-canvas').forEach(canvas => {
        animationEngine.createWave(canvas);
    });
});

// Export for modules
export default AnimationEngine;
