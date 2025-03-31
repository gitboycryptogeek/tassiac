// server/utils/receiptUtils.js

// Generate a unique receipt number
const generateReceiptNumber = (paymentType) => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    // Generate a random component
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    
    // Create a type code based on payment type
    let typeCode;
    switch (paymentType) {
      case 'TITHE':
        typeCode = 'TH';
        break;
      case 'OFFERING':
        typeCode = 'OF';
        break;
      case 'DONATION':
        typeCode = 'DN';
        break;
      case 'EXPENSE':
        typeCode = 'EX';
        break;
      default:
        typeCode = 'OT'; // Other
    }
    
    // Format: TYPE/YYYYMMDD/RANDOM
    return `${typeCode}/${year}${month}${day}/${random}`;
  };
  
  // Format amount with currency
  const formatCurrency = (amount, currency = 'KES') => {
    return `${currency} ${parseFloat(amount).toFixed(2)}`;
  };
  
  // Format date in a readable format
  const formatDate = (date) => {
    const options = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    
    return new Date(date).toLocaleDateString('en-US', options);
  };
  
  // Generate receipt content for HTML display
  const generateReceiptHtml = (receiptData) => {
    const {
      receiptNumber,
      amount,
      paymentType,
      paymentMethod,
      description,
      userDetails,
      churchDetails,
      transactionDetails,
      paymentDate,
      issuedDate,
      titheDistribution
    } = receiptData;
    
    let transactionHtml = '';
    if (transactionDetails) {
      transactionHtml = '<div class="transaction-details">';
      transactionHtml += '<h3>Transaction Details</h3>';
      
      Object.keys(transactionDetails).forEach(key => {
        if (transactionDetails[key]) {
          const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
          transactionHtml += `<p><strong>${formattedKey}:</strong> ${transactionDetails[key]}</p>`;
        }
      });
      
      transactionHtml += '</div>';
    }
    
    // Generate tithe distribution HTML if applicable
    let titheHtml = '';
    if (titheDistribution) {
      titheHtml = '<div class="tithe-distribution">';
      titheHtml += '<h3>Tithe Distribution</h3>';
      
      Object.entries(titheDistribution).forEach(([key, value]) => {
        if (value > 0 && key !== 'otherSpecification') {
          const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
          titheHtml += `<p><strong>${formattedKey}:</strong> ${formatCurrency(value)}</p>`;
        }
      });
      
      if (titheDistribution.other > 0 && titheDistribution.otherSpecification) {
        titheHtml += `<p><strong>Other (${titheDistribution.otherSpecification}):</strong> ${formatCurrency(titheDistribution.other)}</p>`;
      } else if (titheDistribution.other > 0) {
        titheHtml += `<p><strong>Other:</strong> ${formatCurrency(titheDistribution.other)}</p>`;
      }
      
      titheHtml += '</div>';
    }
    
    return `
      <div class="receipt">
        <div class="receipt-header">
          <h1>${churchDetails.name}</h1>
          <h2>Official Receipt</h2>
        </div>
        
        <div class="receipt-details">
          <p><strong>Receipt Number:</strong> ${receiptNumber}</p>
          <p><strong>Date:</strong> ${formatDate(issuedDate)}</p>
        </div>
        
        <div class="user-details">
          <h3>User Details</h3>
          <p><strong>Name:</strong> ${userDetails.name}</p>
          <p><strong>Phone:</strong> ${userDetails.phone}</p>
          ${userDetails.email ? `<p><strong>Email:</strong> ${userDetails.email}</p>` : ''}
        </div>
        
        <div class="payment-details">
          <h3>Payment Details</h3>
          <p><strong>Payment Type:</strong> ${paymentType}</p>
          <p><strong>Payment Method:</strong> ${paymentMethod}</p>
          <p><strong>Amount:</strong> ${formatCurrency(amount)}</p>
          ${description ? `<p><strong>Description:</strong> ${description}</p>` : ''}
          <p><strong>Payment Date:</strong> ${formatDate(paymentDate)}</p>
        </div>
        
        ${titheHtml}
        
        ${transactionHtml}
        
        <div class="receipt-footer">
          <p>Thank you for your contribution to ${churchDetails.name}.</p>
          <p>This is an official receipt. Please keep it for your records.</p>
        </div>
        
        <div class="signature">
          <div class="signature-line"></div>
          <p>Authorized Signature</p>
        </div>
      </div>
    `;
  };
  
  module.exports = {
    generateReceiptNumber,
    formatCurrency,
    formatDate,
    generateReceiptHtml
  };