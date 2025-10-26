// Helper functions for Artillery load tests

const jwt = require('jsonwebtoken');

// Generate a test JWT token
function generateAuth(context, events, done) {
  const testUser = {
    id: `test-user-${Math.floor(Math.random() * 1000)}`,
    email: `test${Math.floor(Math.random() * 1000)}@example.com`,
    username: `testuser${Math.floor(Math.random() * 1000)}`,
  };

  const secret = process.env.JWT_SECRET || 'your-secret-key-change-this';
  const token = jwt.sign(testUser, secret, { expiresIn: '1h' });

  context.vars.authToken = token;
  context.vars.userId = testUser.id;

  return done();
}

module.exports = {
  generateAuth,
};

