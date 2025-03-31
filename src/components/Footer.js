// src/components/Footer.js
export class Footer {
  render() {
    const currentYear = new Date().getFullYear();
    const footer = document.createElement('footer');
    
    try {
      footer.innerHTML = `
        <div class="container">
          <div class="footer-content">
            <div>
              <div class="footer-logo">TASSIAC Church</div>
              <p class="mb-2">Transforming lives through faith and community</p>
            </div>
            
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <h4 class="text-lg font-semibold mb-3">Links</h4>
                <ul class="flex flex-col gap-2">
                  <li><a href="/" data-link class="footer-link">Home</a></li>
                  <li><a href="/dashboard" data-link class="footer-link">Dashboard</a></li>
                  <li><a href="/payments" data-link class="footer-link">Payments</a></li>
                </ul>
              </div>
              
              <div>
                <h4 class="text-lg font-semibold mb-3">Resources</h4>
                <ul class="flex flex-col gap-2">
                  <li><a href="/about" data-link class="footer-link">About Us</a></li>
                  <li><a href="/contact" data-link class="footer-link">Contact</a></li>
                  <li><a href="/help" data-link class="footer-link">Help</a></li>
                </ul>
              </div>
            </div>
          </div>
          
          <div class="footer-copyright">
            &copy; ${currentYear} TASSIAC Church. All rights reserved.
          </div>
        </div>
      `;
      
      return footer;
    } catch (error) {
      console.error('Error rendering footer:', error);
      
      footer.innerHTML = `
        <div class="container py-4">
          <p class="text-center text-light">
            &copy; ${currentYear} TASSIAC Church. All rights reserved.
          </p>
        </div>
      `;
      
      return footer;
    }
  }
}