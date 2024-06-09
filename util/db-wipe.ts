import { Client } from 'pg';

const DB_NAME = 'postgres';
const DB_USER = 'postgres';
const DB_PASSWORD = 'postgres';
const DB_HOST = 'localhost'; // or your database host
const DB_PORT = 5432; // or your database port

const client = new Client({
  user: DB_USER,
  host: DB_HOST,
  database: DB_NAME,
  password: DB_PASSWORD,
  port: DB_PORT,
});

const dropAllTables = async () => {
  try {
    await client.connect();
    console.log(`Connected to database ${DB_NAME}`);

    // Get all tables in the public schema
    const tablesRes = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
    const tables = tablesRes.rows.map((row: { tablename: any; }) => row.tablename);

    // Drop all tables
    for (const table of tables) {
      console.log(`Dropping table: ${table}`);
      await client.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
    }

    // Optional: Drop all sequences
    const sequencesRes = await client.query("SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public'");
    const sequences = sequencesRes.rows.map((row: { sequence_name: any; }) => row.sequence_name);

    for (const sequence of sequences) {
      console.log(`Dropping sequence: ${sequence}`);
      await client.query(`DROP SEQUENCE IF EXISTS ${sequence} CASCADE`);
    }

    // Optional: Drop all views
    const viewsRes = await client.query("SELECT table_name FROM information_schema.views WHERE table_schema = 'public'");
    const views = viewsRes.rows.map((row: { table_name: any; }) => row.table_name);

    for (const view of views) {
      console.log(`Dropping view: ${view}`);
      await client.query(`DROP VIEW IF EXISTS ${view} CASCADE`);
    }

    console.log(`All tables, sequences, and views dropped in database ${DB_NAME}`);
  } catch (error) {
    console.error('Error dropping tables:', error);
  } finally {
    await client.end();
    console.log(`Disconnected from database ${DB_NAME}`);
  }
};

dropAllTables();
