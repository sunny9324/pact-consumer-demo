const { PactV3, MatchersV3 } = require('@pact-foundation/pact');
const axios = require('axios');
const path = require('path');

// Extract the matchers we want to use
const { like, integer } = MatchersV3;

// 1. Configure the mock server with the exact names from PactFlow
const provider = new PactV3({
  consumer: 'petstore-consumer',
  provider: 'petstore-api',
  dir: path.resolve(process.cwd(), 'pacts'),
});

describe('Petstore API Pact', () => {
  it('generates a contract for fetching a pet by ID', () => {
    
    // 2. Define the contract rules
    provider
      .given('pet 1 exists')
      .uponReceiving('a request to get pet 1')
      .withRequest({
        method: 'GET',
        path: '/pet/1',
      })
      .willRespondWith({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          id: integer(1),            // Expect any integer, but mock '1'
          name: like('Doggie'),      // Expect any string, but mock 'Doggie'
          status: like('available')  // Expect any string, but mock 'available'
        },
      });

    // 3. Act & Assert
    return provider.executeTest(async (mockServer) => {
      const response = await axios.get(`${mockServer.url}/pet/1`);
      
      expect(response.status).toBe(200);
      expect(typeof response.data.name).toBe('string');
      expect(response.data.id).toBe(1);
    });
  });
});