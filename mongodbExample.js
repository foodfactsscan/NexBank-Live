/**
 * mongodbExample.js
 * 
 * Instructions to run:
 * 1. Install driver: npm install mongodb
 * 2. Set your URI: $env:MONGODB_URI="your_full_connection_string"
 * 3. Run script: node mongodbExample.js
 */

const { MongoClient, ObjectId } = require('mongodb');

async function run() {
  // 1. Read MONGODB_URI from environment variables
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('❌ Error: Please set the MONGODB_URI environment variable.');
    process.exit(1);
  }

  // Create a new MongoClient
  const client = new MongoClient(uri);

  try {
    console.log('⏳ Connecting to MongoDB Atlas...');
    await client.connect();
    console.log('✅ Connected successfully!');

    // 2. Select Database and Collection
    const db = client.db('test_lab');
    const collection = db.collection('activity_feed');

    // Clean up previous runs
    await collection.deleteMany({});

    // 3. Insert 10 realistic documents
    console.log('📥 Inserting 10 activity records...');
    const activities = [
      { user: 'Alice', action: 'Login', status: 'success', timestamp: new Date('2024-05-01T10:00:00Z') },
      { user: 'Bob', action: 'Transfer', status: 'pending', timestamp: new Date('2024-05-01T11:30:00Z') },
      { user: 'Charlie', action: 'Password Change', status: 'success', timestamp: new Date('2024-05-01T12:15:00Z') },
      { user: 'Alice', action: 'Withdrawal', status: 'failed', timestamp: new Date('2024-05-01T14:05:00Z') },
      { user: 'Dave', action: 'Account Created', status: 'success', timestamp: new Date('2024-05-01T08:00:00Z') },
      { user: 'Bob', action: 'Login', status: 'success', timestamp: new Date('2024-05-01T09:45:00Z') },
      { user: 'Eve', action: 'Deposit', status: 'success', timestamp: new Date('2024-05-01T16:20:00Z') },
      { user: 'Charlie', action: 'Login', status: 'success', timestamp: new Date('2024-05-01T15:00:00Z') },
      { user: 'Alice', action: 'Logout', status: 'success', timestamp: new Date('2024-05-01T17:10:00Z') },
      { user: 'Dave', action: 'Profile Update', status: 'success', timestamp: new Date('2024-05-01T13:40:00Z') }
    ];

    const result = await collection.insertMany(activities);
    console.log(`✅ Inserted ${result.insertedCount} documents.`);

    // 4. Sort and Print 5 most recent documents
    console.log('\n🔍 Reading 5 most recent activities:');
    const recentDocs = await collection.find()
      .sort({ timestamp: -1 })
      .limit(5)
      .toArray();

    recentDocs.forEach((doc, index) => {
      console.log(`${index + 1}. [${doc.timestamp.toISOString()}] ${doc.user}: ${doc.action} (${doc.status})`);
    });

    // 5. Read one document by _id (using the first one inserted)
    const firstId = result.insertedIds[0];
    console.log(`\n🆔 Fetching specific document by ID: ${firstId}`);
    const singleDoc = await collection.findOne({ _id: firstId });
    console.log('Result:', JSON.stringify(singleDoc, null, 2));

  } catch (err) {
    console.error('❌ Database Operation Error:', err.message);
  } finally {
    // 6. Close the connection
    console.log('\n🔌 Closing connection...');
    await client.close();
    console.log('✅ Connection closed.');
  }
}

run().catch(console.dir);
