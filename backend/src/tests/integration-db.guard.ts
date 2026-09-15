export function requireTestDatabaseName(name = process.env.TEST_DB_NAME) {
  if (!name || !name.endsWith('_test')) {
    throw new Error('Integration tests require TEST_DB_NAME ending in _test.');
  }
  return name;
}
