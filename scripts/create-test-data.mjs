#!/usr/bin/env node

import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { latLngToCell } from 'h3-js';

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();

async function createTestData() {
  const pollId = 'test-poll-001';
  const questionId = 'test-question-001';
  
  // Create test poll
  await db.doc(`polls/${pollId}`).set({
    title: 'Test Poll for Maps',
    description: 'A test poll to generate map data',
    createdBy: 'test-user',
    createdAt: FieldValue.serverTimestamp(),
    dueDate: '2025-12-31',
    state: 'open'
  });

  // Create test question
  await db.doc(`polls/${pollId}/questions/${questionId}`).set({
    text: 'How do you feel about this test?',
    order: 1,
    createdAt: FieldValue.serverTimestamp()
  });

  // Create test submissions with various locations
  const testLocations = [
    { lat: 40.7128, lng: -74.0060, city: 'New York', state: 'NY', zip: '10001' }, // NYC
    { lat: 34.0522, lng: -118.2437, city: 'Los Angeles', state: 'CA', zip: '90210' }, // LA
    { lat: 41.8781, lng: -87.6298, city: 'Chicago', state: 'IL', zip: '60601' }, // Chicago
    { lat: 29.7604, lng: -95.3698, city: 'Houston', state: 'TX', zip: '77001' }, // Houston
    { lat: 39.9526, lng: -75.1652, city: 'Philadelphia', state: 'PA', zip: '19101' }, // Philly
  ];

  for (let i = 0; i < testLocations.length; i++) {
    const loc = testLocations[i];
    const userId = `test-user-${i + 1}`;
    const value = Math.floor(Math.random() * 21) - 10; // Random value -10 to 10
    const h3id = latLngToCell(loc.lat, loc.lng, 8);

    // Create submission
    await db.doc(`submissions/${pollId}__${userId}__${questionId}`).set({
      pollId,
      userId,
      questionId,
      value,
      submitted: true,
      location: {
        city: loc.city,
        state: loc.state,
        zip: loc.zip,
        h3: { id: h3id, res: 8 }
      },
      updatedAt: FieldValue.serverTimestamp()
    });

    // Create status doc
    await db.doc(`submissions/${pollId}__${userId}__status`).set({
      pollId,
      userId,
      createdAt: FieldValue.serverTimestamp(),
      submittedAt: FieldValue.serverTimestamp()
    });
  }

  console.log(`Created test poll ${pollId} with ${testLocations.length} submissions`);
  console.log('Now run the rollup function to generate aggregates');
}

createTestData().catch(console.error);