class WalletValidationService {
  
    static validateWithdrawalAmount(wallet, requestedAmount) {
      const availableBalance = parseFloat(wallet.balance.toString());
      const amount = parseFloat(requestedAmount);
      
      if (amount <= 0) {
        throw new Error('Withdrawal amount must be greater than zero');
      }
      
      if (amount > availableBalance) {
        throw new Error(`Insufficient funds. Available: KES ${availableBalance.toFixed(2)}, Requested: KES ${amount.toFixed(2)}`);
      }
      
      // Minimum withdrawal check (configurable)
      const minimumWithdrawal = parseFloat(process.env.MINIMUM_WITHDRAWAL_AMOUNT || '10');
      if (amount < minimumWithdrawal) {
        throw new Error(`Minimum withdrawal amount is KES ${minimumWithdrawal.toFixed(2)}`);
      }
      
      return true;
    }
    
    static validateWithdrawalDestination(method, destinationAccount, destinationPhone) {
      switch (method) {
        case 'BANK_TRANSFER':
          if (!destinationAccount || destinationAccount.length < 8) {
            throw new Error('Valid bank account number is required for bank transfers');
          }
          break;
          
        case 'MPESA':
          if (!destinationPhone) {
            throw new Error('Phone number is required for M-Pesa transfers');
          }
          // Validate Kenyan phone number format
          const phonePattern = /^(\+254|0)?[17]\d{8}$/;
          if (!phonePattern.test(destinationPhone)) {
            throw new Error('Invalid Kenyan phone number format. Use format: 0712345678 or +254712345678');
          }
          break;
          
        case 'CASH':
          // No additional validation required for cash withdrawals
          break;
          
        default:
          throw new Error('Invalid withdrawal method');
      }
      
      return true;
    }
    
    static validateBusinessHours() {
      const now = new Date();
      const hour = now.getHours();
      const day = now.getDay(); // 0 = Sunday, 6 = Saturday
      
      // Business hours: Monday-Friday 8AM-6PM, Saturday 9AM-3PM, Sunday closed
      const isWeekday = day >= 1 && day <= 5;
      const isSaturday = day === 6;
      const isSunday = day === 0;
      
      if (isSunday) {
        throw new Error('Withdrawals are not processed on Sundays');
      }
      
      if (isWeekday && (hour < 8 || hour >= 18)) {
        throw new Error('Withdrawals can only be processed during business hours (8:00 AM - 6:00 PM, Monday-Friday)');
      }
      
      if (isSaturday && (hour < 9 || hour >= 15)) {
        throw new Error('Saturday withdrawals can only be processed between 9:00 AM - 3:00 PM');
      }
      
      return true;
    }
    
    static validateDailyWithdrawalLimit(userId, requestedAmount, existingWithdrawalsToday) {
      const dailyLimit = parseFloat(process.env.DAILY_WITHDRAWAL_LIMIT || '50000'); // KES 50,000 default
      const amount = parseFloat(requestedAmount);
      
      const todayTotal = existingWithdrawalsToday.reduce((sum, withdrawal) => {
        return sum + parseFloat(withdrawal.amount.toString());
      }, 0);
      
      if ((todayTotal + amount) > dailyLimit) {
        const remaining = dailyLimit - todayTotal;
        throw new Error(`Daily withdrawal limit exceeded. Daily limit: KES ${dailyLimit.toFixed(2)}, Used today: KES ${todayTotal.toFixed(2)}, Remaining: KES ${remaining.toFixed(2)}`);
      }
      
      return true;
    }
  }
  
  module.exports = WalletValidationService;