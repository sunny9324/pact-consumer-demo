const { PactV3 } = require('@pact-foundation/pact');
const axios = require('axios');
const path = require('path');

// 1. Configure the mock server using PactV3
const provider = new PactV3({
  consumer: 'FrontendClient',
  provider: 'UserService',
  dir: path.resolve(process.cwd(), 'pacts'),
});

describe('User Service Pact', () => {
  it('generates a contract for fetching a user', () => {
    
    // 2. Define the contract rules
    provider
      .given('user 1 exists')
      .uponReceiving('a request to get user 1')
      .withRequest({
        method: 'GET',
        path: '/users/1',
      })
      .willRespondWith({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: { id: 1, name: 'Jane Doe', role: 'admin' },
      });

    // 3. Act & Assert inside executeTest
    // This block automatically starts the mock server, runs your test, and cleanly shuts it down (replacing finalize)
    return provider.executeTest(async (mockServer) => {
      const response = await axios.get(`${mockServer.url}/users/1`);
      
      expect(response.data.name).toBe('Jane Doe');
      expect(response.status).toBe(200);
    });
  });
});