  // Mobile Menu Toggle
        const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
        const mobileMenu = document.querySelector('.mobile-menu');
        const closeMenu = document.querySelector('.close-menu');
        const overlay = document.querySelector('.overlay');
        
        mobileMenuBtn.addEventListener('click', () => {
            mobileMenu.classList.add('active');
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
        
        closeMenu.addEventListener('click', () => {
            mobileMenu.classList.remove('active');
            overlay.classList.remove('active');
            document.body.style.overflow = 'auto';
        });
        
        overlay.addEventListener('click', () => {
            mobileMenu.classList.remove('active');
            overlay.classList.remove('active');
            document.body.style.overflow = 'auto';
        });
        
        // Smooth scroll for anchor links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                
                const targetId = this.getAttribute('href');
                if (targetId === '#') return;
                
                const targetElement = document.querySelector(targetId);
                if (targetElement) {
                    window.scrollTo({
                        top: targetElement.offsetTop - 80,
                        behavior: 'smooth'
                    });
                    
                    // Close mobile menu if open
                    mobileMenu.classList.remove('active');
                    overlay.classList.remove('active');
                    document.body.style.overflow = 'auto';
                }
            });
        });
        
        // CTA buttons functionality
       // document.querySelectorAll('.btn-accent, .cta .btn').forEach(button => {
           // button.addEventListener('click', function() {
                // In a real app, this would redirect to the resume builder
               // alert('Перенаправление в конструктор резюме...');
                // window.location.href = '/builder';
           // });
        //});

    // кнопки
    const loginBtn = document.querySelector('.btn-outline');
    const regBtn = document.querySelectorAll('.btn-accent');
    const useBtn = document.querySelectorAll('.btn-use');

    loginBtn.addEventListener('click', () => {
            window.location.href = 'login.html';
    });

    regBtn.forEach(button => {
        button.addEventListener('click', function() {
            window.location.href = 'registration.html';
        });
    });

     useBtn.forEach(button => {
        button.addEventListener('click', function() {
            window.location.href = 'registration.html';
        });
    });