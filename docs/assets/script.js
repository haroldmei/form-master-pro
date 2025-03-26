// Main JavaScript for FormMasterPro website

document.addEventListener('DOMContentLoaded', function() {
  // Highlight current page in navigation
  const currentLocation = window.location.pathname;
  const navLinks = document.querySelectorAll('nav a');
  
  navLinks.forEach(link => {
    const linkPath = link.getAttribute('href');
    
    if (currentLocation.endsWith(linkPath) || 
       (currentLocation.endsWith('/') && linkPath === 'index.html')) {
      link.classList.add('active');
    }
  });
  
  // Smooth scrolling for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      
      const targetId = this.getAttribute('href');
      const targetElement = document.querySelector(targetId);
      
      if (targetElement) {
        window.scrollTo({
          top: targetElement.offsetTop - 100,
          behavior: 'smooth'
        });
      }
    });
  });
  
  // Mobile navigation toggle
  const mobileNavToggle = document.getElementById('mobile-nav-toggle');
  if (mobileNavToggle) {
    mobileNavToggle.addEventListener('click', function() {
      const nav = document.querySelector('nav ul');
      nav.classList.toggle('show');
    });
  }
  
  // Demo screenshots carousel
  const carousel = document.querySelector('.carousel');
  if (carousel) {
    const slides = carousel.querySelectorAll('.carousel-slide');
    const dots = carousel.querySelectorAll('.carousel-dot');
    let currentSlide = 0;
    
    function showSlide(index) {
      slides.forEach((slide, i) => {
        slide.style.display = i === index ? 'block' : 'none';
      });
      
      dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === index);
      });
      
      currentSlide = index;
    }
    
    // Set up dot navigation
    dots.forEach((dot, i) => {
      dot.addEventListener('click', () => showSlide(i));
    });
    
    // Auto-rotate slides
    if (slides.length > 1) {
      setInterval(() => {
        let nextSlide = (currentSlide + 1) % slides.length;
        showSlide(nextSlide);
      }, 5000);
    }
    
    // Initialize first slide
    if (slides.length > 0) {
      showSlide(0);
    }
  }
});
