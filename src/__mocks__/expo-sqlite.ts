const mockResultSet = {
  insertId: 1,
  rowsAffected: 1,
  rows: {
    length: 0,
    item: () => null,
    _array: [],
  },
};

const mockTx = {
  executeSql: jest.fn((sql, params, success, error) => {
    if (success) success(mockTx, mockResultSet);
    return mockTx;
  }),
};

const mockDb = {
  transaction: jest.fn((callback) => {
    callback(mockTx);
  }),
};

export const openDatabase = jest.fn(() => mockDb);
