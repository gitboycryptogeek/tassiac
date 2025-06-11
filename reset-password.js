// reset-password.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function resetAdminPassword() {
  try {
    console.log('🔄 Resetting password for admin user...');
    
    // Find the admin user
    const adminUser = await prisma.user.findUnique({
      where: { username: 'admin' }
    });
    
    if (!adminUser) {
      console.log('❌ Admin user not found!');
      return;
    }
    
    console.log('✅ Found admin user:', {
      id: adminUser.id,
      username: adminUser.username,
      isAdmin: adminUser.isAdmin,
      isActive: adminUser.isActive
    });
    
    // Hash the new password
    const newPassword = 'Admin123!';
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update the user's password
    await prisma.user.update({
      where: { username: 'admin' },
      data: { 
        password: hashedPassword,
        isActive: true // Ensure user is active
      }
    });
    
    console.log('✅ Password reset successfully!');
    console.log('\n🎉 You can now login with:');
    console.log('Username: admin');
    console.log('Password: Admin123!');
    
    // Test the new password
    console.log('\n🔍 Testing new password...');
    const updatedUser = await prisma.user.findUnique({
      where: { username: 'admin' }
    });
    
    const passwordMatches = await bcrypt.compare(newPassword, updatedUser.password);
    console.log(`✅ Password verification: ${passwordMatches ? 'SUCCESS' : 'FAILED'}`);
    
  } catch (error) {
    console.error('❌ Error resetting password:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetAdminPassword();