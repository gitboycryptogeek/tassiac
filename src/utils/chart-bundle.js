// src/utils/chart-bundle.js
window.Chart = null;
window.ApexCharts = null;

// Implementation of a minimal charting solution
class SimpleChart {
  constructor(element, config) {
    this.element = element;
    this.config = config;
    // Normalize config structure to handle different formats
    this.normalizeConfig();
    this.render();
  }

  normalizeConfig() {
    // Handle different config formats between Chart.js and ApexCharts
    if (!this.config.data) {
      // If using ApexCharts format, convert to Chart.js format
      if (this.config.series) {
        this.config.data = {
          labels: this.config.xaxis?.categories || [],
          datasets: this.config.series.map((series, index) => ({
            label: series.name || `Series ${index + 1}`,
            data: series.data || [],
            borderColor: this.config.colors?.[index] || '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.2)'
          }))
        };
      } else {
        // Create default structure to prevent errors
        this.config.data = {
          labels: [],
          datasets: [{
            label: 'Data',
            data: [],
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.2)'
          }]
        };
      }
    } else if (!this.config.data.datasets) {
      // Create datasets if not present
      this.config.data.datasets = [{
        label: 'Data',
        data: Array.isArray(this.config.data) ? this.config.data : [],
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.2)'
      }];
    }
  }

  render() {
    if (!this.element || !this.element.parentNode) return;
    
    const container = this.element.parentNode;
    const chartDiv = document.createElement('div');
    chartDiv.style.width = '100%';
    chartDiv.style.height = '100%';
    chartDiv.style.display = 'flex';
    chartDiv.style.flexDirection = 'column';
    chartDiv.style.background = 'rgba(30, 41, 59, 0.4)';
    chartDiv.style.borderRadius = '8px';
    chartDiv.style.padding = '15px';
    
    // Create header with title
    const header = document.createElement('div');
    header.style.marginBottom = '10px';
    header.style.fontSize = '14px';
    header.style.fontWeight = 'bold';
    header.style.color = '#f1f5f9';
    
    // Use the first dataset label as the chart title
    const datasets = this.config.data.datasets;
    header.textContent = datasets && datasets.length > 0 && datasets[0].label ? 
                         datasets[0].label : 'Data';
    
    // Create chart visualization
    const chartArea = document.createElement('div');
    chartArea.style.flex = '1';
    chartArea.style.display = 'flex';
    chartArea.style.alignItems = 'flex-end';
    chartArea.style.gap = '2px';
    chartArea.style.position = 'relative';
    
    // Get data from first dataset
    const data = datasets && datasets.length > 0 ? datasets[0].data || [] : [];
    const labels = this.config.data.labels || [];
    const color = datasets && datasets.length > 0 ? datasets[0].borderColor || '#3b82f6' : '#3b82f6';
    
    // Create bars based on dataset
    if (data.length > 0) {
      // Find max value for scaling
      const maxValue = Math.max(...data.filter(val => !isNaN(val)));
      
      data.forEach((value, index) => {
        const barContainer = document.createElement('div');
        barContainer.style.flex = '1';
        barContainer.style.height = '100%';
        barContainer.style.display = 'flex';
        barContainer.style.flexDirection = 'column';
        barContainer.style.alignItems = 'center';
        barContainer.style.justifyContent = 'flex-end';
        
        // Calculate height based on max value (protect against division by zero)
        const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
        
        const bar = document.createElement('div');
        bar.style.width = '70%';
        bar.style.height = `${percentage}%`;
        bar.style.backgroundColor = color;
        bar.style.borderRadius = '4px 4px 0 0';
        bar.style.transition = 'height 1s ease';
        bar.style.position = 'relative';
        bar.style.minHeight = '4px';
        
        // Label
        const label = document.createElement('div');
        label.style.fontSize = '10px';
        label.style.color = '#94a3b8';
        label.style.marginTop = '5px';
        label.style.textAlign = 'center';
        label.style.whiteSpace = 'nowrap';
        label.style.overflow = 'hidden';
        label.style.textOverflow = 'ellipsis';
        label.style.maxWidth = '100%';
        label.textContent = labels[index] || '';
        
        // Value tooltip on hover
        bar.addEventListener('mouseenter', () => {
          const tooltip = document.createElement('div');
          tooltip.style.position = 'absolute';
          tooltip.style.top = '-30px';
          tooltip.style.left = '50%';
          tooltip.style.transform = 'translateX(-50%)';
          tooltip.style.backgroundColor = 'rgba(15, 23, 42, 0.9)';
          tooltip.style.color = '#f1f5f9';
          tooltip.style.padding = '4px 8px';
          tooltip.style.borderRadius = '4px';
          tooltip.style.fontSize = '12px';
          tooltip.style.zIndex = '10';
          tooltip.style.whiteSpace = 'nowrap';
          tooltip.textContent = `KES ${value.toLocaleString()}`;
          bar.appendChild(tooltip);
        });
        
        bar.addEventListener('mouseleave', () => {
          const tooltip = bar.querySelector('div');
          if (tooltip) bar.removeChild(tooltip);
        });
        
        barContainer.appendChild(bar);
        barContainer.appendChild(label);
        chartArea.appendChild(barContainer);
      });
    } else {
      // No data state
      const noDataMsg = document.createElement('div');
      noDataMsg.style.position = 'absolute';
      noDataMsg.style.top = '50%';
      noDataMsg.style.left = '50%';
      noDataMsg.style.transform = 'translate(-50%, -50%)';
      noDataMsg.style.color = '#94a3b8';
      noDataMsg.style.fontSize = '14px';
      noDataMsg.textContent = 'No data available';
      chartArea.appendChild(noDataMsg);
    }
    
    chartDiv.appendChild(header);
    chartDiv.appendChild(chartArea);
    
    // Replace the canvas with our custom chart
    container.innerHTML = '';
    container.appendChild(chartDiv);
  }
  
  destroy() {
    // Clean up any resources or event listeners if needed
    if (this.element && this.element.parentNode) {
      const container = this.element.parentNode;
      container.innerHTML = '';
      container.appendChild(this.element);
    }
  }
}

// Expose global SimpleChart as both Chart and ApexCharts
window.Chart = SimpleChart;
window.ApexCharts = SimpleChart;

export { SimpleChart };