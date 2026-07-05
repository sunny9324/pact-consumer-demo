// ============================================================================
// TECH STACK EXPLANATION (Why we are importing these specific packages)
// ============================================================================

// 1. @pact-foundation/pact (PactV3, MatchersV3)
// WHY: This is the official Pact library for Node.js. 
// - 'PactV3' is the core engine. We use it to spin up a local mock HTTP server 
//   that intercepts our frontend's requests and generates the JSON contract file.
// - 'MatchersV3' is a utility that allows us to test the "shape" of the data 
//   (e.g., checking if a value is a string or a number) instead of hardcoding 
//   exact values. This makes our tests resilient to database data changes.
const { PactV3, MatchersV3 } = require('@pact-foundation/pact');

// 2. axios
// WHY: Axios is a popular promise-based HTTP client for Node.js and browsers. 
// In this test, it simulates our frontend application making actual network 
// requests to the Pact mock server. We use it to trigger the 'Act' phase of our test.
const axios = require('axios');

// 3. path
// WHY: 'path' is a built-in Node.js module used for handling and transforming file paths.
// We use it to dynamically resolve exactly where the generated JSON contract 
// should be saved (the 'pacts' folder), ensuring the code works perfectly on 
// both Windows and macOS/Linux machines without path formatting errors.
const path = require('path');

// Extract the matchers we want to use to validate schemas
const { like, integer, eachLike } = MatchersV3;

// ============================================================================
// PACT CONFIGURATION
// ============================================================================
// WHY: We initialize a new PactV3 instance to define the exact relationship 
// between the consumer and the provider. The names used here MUST exactly 
// match the names we intend to use in the PactFlow broker.
const provider = new PactV3({
  consumer: 'petstore-consumer',
  provider: 'petstore-api',
  dir: path.resolve(process.cwd(), 'pacts'), // Safely points to the current directory + /pacts
});

describe('Advanced Petstore API Contract Tests', () => {
  
  // ============================================================================
  // SCENARIO 1: POST Request (Payload Validation)
  // ============================================================================
  it('creates a new pet successfully', () => {
    
    // INTERVIEW TALKING POINT: 
    // "Testing a POST request proves I can enforce the structure of the payload 
    // being sent from the frontend to the backend, preventing bad data ingestion."
    const newPetPayload = {
      id: 10,
      name: 'Buddy',
      status: 'available'
    };

    provider
      .given('the API is ready to accept a new pet')
      .uponReceiving('a request to create a new pet')
      .withRequest({
        method: 'POST',
        path: '/pet',
        headers: { 'Content-Type': 'application/json' },
        body: newPetPayload // We expect the frontend to send this exact shape
      })
      .willRespondWith({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          id: integer(10),
          name: like('Buddy'),
          status: like('available')
        },
      });

    return provider.executeTest(async (mockServer) => {
      // Act: Simulate the frontend making the POST request
      const response = await axios.post(`${mockServer.url}/pet`, newPetPayload, {
        headers: { 'Content-Type': 'application/json' }
      });
      // Assert: Verify the mock server responded as expected
      expect(response.status).toBe(200);
      expect(response.data.name).toBe('Buddy');
    });
  });

  // ============================================================================
  // SCENARIO 2: GET with Query Parameters (Array Validation)
  // ============================================================================
  it('fetches all available pets using query parameters', () => {
    
    // INTERVIEW TALKING POINT: 
    // "I use the 'eachLike' matcher here. If an API returns an array of 100 items, 
    // I don't want to mock 100 objects. 'eachLike' tells the contract that the array 
    // should contain AT LEAST ONE item, and EVERY item must match this schema."
    provider
      .given('there are available pets in the system')
      .uponReceiving('a request to find pets by status')
      .withRequest({
        method: 'GET',
        path: '/pet/findByStatus',
        query: { status: 'available' } // Validates URL queries like ?status=available
      })
      .willRespondWith({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: eachLike({
          id: integer(1),
          name: like('Doggie'),
          status: like('available')
        }),
      });

    return provider.executeTest(async (mockServer) => {
      // Act: Simulate the frontend requesting the list of available pets
      const response = await axios.get(`${mockServer.url}/pet/findByStatus?status=available`);
      
      // Assert: Verify we got a 200 status and an array containing the expected schema
      expect(response.status).toBe(200);
      expect(Array.isArray(response.data)).toBe(true);
      expect(response.data[0].status).toBe('available');
    });
  });

  // ============================================================================
  // SCENARIO 3: Negative Path (404 Error Handling)
  // ============================================================================
  it('handles a 404 error when a pet does not exist', () => {
    
    // INTERVIEW TALKING POINT: 
    // "Contracts must define how systems fail, not just how they succeed. 
    // Testing the 404 path ensures the frontend knows exactly what error schema 
    // to expect so it can render a graceful error message to the user."
    provider
      .given('pet 9999 does not exist')
      .uponReceiving('a request for a non-existent pet')
      .withRequest({
        method: 'GET',
        path: '/pet/9999',
      })
      .willRespondWith({
        status: 404,
        headers: { 'Content-Type': 'application/json' },
        body: {
          code: integer(1),
          type: like('error'),
          message: like('Pet not found')
        },
      });

    return provider.executeTest(async (mockServer) => {
      try {
        // Act: Attempt to fetch a pet that we declared does not exist
        await axios.get(`${mockServer.url}/pet/9999`);
      } catch (error) {
        // Assert: We assert against the error object thrown by Axios for 4xx responses
        expect(error.response.status).toBe(404);
        expect(error.response.data.message).toBe('Pet not found');
      }
    });
  });

  // ============================================================================
  // SCENARIO 4: PUT Request (Data Mutation)
  // ============================================================================
  it('updates an existing pet successfully', () => {
    
    // INTERVIEW TALKING POINT: 
    // "A PUT request tests idempotent mutations. It ensures the frontend includes 
    // the required identifier (ID) in the payload, and that the backend acknowledges 
    // the mutated state in its response."
    const updatePayload = {
      id: 1,
      name: 'Doggie',
      status: 'sold' // Changing status from available to sold
    };

    provider
      .given('pet 1 exists and is available')
      .uponReceiving('a request to update pet 1 to sold')
      .withRequest({
        method: 'PUT',
        path: '/pet',
        headers: { 'Content-Type': 'application/json' },
        body: updatePayload
      })
      .willRespondWith({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          id: integer(1),
          name: like('Doggie'),
          status: like('sold') // The contract expects the updated status back
        },
      });

    return provider.executeTest(async (mockServer) => {
      // Act: Simulate the frontend updating the pet's status
      const response = await axios.put(`${mockServer.url}/pet`, updatePayload, {
        headers: { 'Content-Type': 'application/json' }
      });
      // Assert: Verify the status successfully updated
      expect(response.status).toBe(200);
      expect(response.data.status).toBe('sold');
    });
  });

});