// src/views/notFound.js
import { Layout } from '../components/Layout.js';

export class NotFoundView {
  constructor() {
    this.layout = new Layout('Page Not Found');
  }
  
  async render() {
    const content = document.createElement('div');
    content.className = 'max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8';
    
    content.innerHTML = `
      <div class="text-center">
        <h1 class="text-6xl font-bold text-primary-600 mb-4">404</h1>
        <h2 class="text-3xl font-semibold text-gray-900 mb-4">Page Not Found</h2>
        <p class="text-lg text-gray-600 mb-8">The page you are looking for doesn't exist or has been moved.</p>
        <a href="/" data-link class="btn btn-primary">
          Go Home
        </a>
      </div>
    `;
    
    return this.layout.render(content);
  }
}